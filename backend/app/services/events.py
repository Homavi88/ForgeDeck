from __future__ import annotations

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, project_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms.setdefault(project_id, []).append(websocket)

    def disconnect(self, project_id: str, websocket: WebSocket) -> None:
        conns = self.rooms.get(project_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, project_id: str, payload: dict) -> None:
        for ws in list(self.rooms.get(project_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(project_id, ws)


manager = ConnectionManager()
