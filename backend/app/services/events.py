from __future__ import annotations

from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """Project rooms: collab state, presence, chat, and exclusive edit locks."""

    def __init__(self) -> None:
        self.rooms: dict[str, list[WebSocket]] = {}
        self.meta: dict[int, dict[str, Any]] = {}
        self.presence: dict[str, dict[str, dict[str, Any]]] = {}
        self.locks: dict[str, dict[str, dict[str, str]]] = {}
        self.chat: dict[str, list[dict[str, Any]]] = {}

    async def connect(self, project_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms.setdefault(project_id, []).append(websocket)
        self.meta[id(websocket)] = {"project_id": project_id, "client_id": None}

    def disconnect(self, project_id: str, websocket: WebSocket) -> None:
        conns = self.rooms.get(project_id, [])
        if websocket in conns:
            conns.remove(websocket)
        info = self.meta.pop(id(websocket), {})
        client_id = info.get("client_id")
        if client_id:
            self.presence.get(project_id, {}).pop(client_id, None)
            held = self.locks.get(project_id, {})
            for resource, owner in list(held.items()):
                if owner.get("clientId") == client_id:
                    held.pop(resource, None)

    def _bind(self, websocket: WebSocket, data: dict[str, Any]) -> str | None:
        client_id = data.get("clientId")
        if not isinstance(client_id, str) or not client_id:
            return None
        info = self.meta.get(id(websocket))
        if info:
            info["client_id"] = client_id
        return client_id

    def snapshot(self, project_id: str) -> dict[str, Any]:
        return {
            "presence": list(self.presence.get(project_id, {}).values()),
            "locks": self.locks.get(project_id, {}),
            "chat": self.chat.get(project_id, [])[-80:],
        }

    async def handle(self, project_id: str, websocket: WebSocket, data: dict[str, Any]) -> None:
        if not isinstance(data, dict):
            return
        client_id = self._bind(websocket, data)
        typ = data.get("type") or "state"

        if typ == "presence":
            if client_id:
                room = self.presence.setdefault(project_id, {})
                room[client_id] = {
                    "clientId": client_id,
                    "name": data.get("name") or "Producer",
                    "deck": data.get("deck"),
                }
            await self.broadcast(project_id, {"type": "room", **self.snapshot(project_id)})
            return

        if typ == "chat":
            text = str(data.get("text") or "").strip()[:500]
            if text and client_id:
                msg = {
                    "clientId": client_id,
                    "name": data.get("name") or "Producer",
                    "text": text,
                    "ts": data.get("ts"),
                }
                self.chat.setdefault(project_id, []).append(msg)
                self.chat[project_id] = self.chat[project_id][-80:]
                await self.broadcast(project_id, {"type": "chat", "payload": msg, "project_id": project_id})
            return

        if typ == "lock":
            resource = str(data.get("resource") or "")
            if resource and client_id:
                held = self.locks.setdefault(project_id, {})
                owner = held.get(resource)
                if owner is None or owner.get("clientId") == client_id:
                    held[resource] = {"clientId": client_id, "name": str(data.get("name") or "Producer")}
            await self.broadcast(project_id, {"type": "room", **self.snapshot(project_id)})
            return

        if typ == "unlock":
            resource = str(data.get("resource") or "")
            if resource and client_id:
                held = self.locks.setdefault(project_id, {})
                owner = held.get(resource)
                if owner and owner.get("clientId") == client_id:
                    held.pop(resource, None)
            await self.broadcast(project_id, {"type": "room", **self.snapshot(project_id)})
            return

        await self.broadcast(project_id, {"type": "event", "payload": data, "project_id": project_id})

    async def broadcast(self, project_id: str, payload: dict) -> None:
        for ws in list(self.rooms.get(project_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(project_id, ws)


manager = ConnectionManager()
