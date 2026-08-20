from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.events import manager

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/projects/{project_id}")
async def project_socket(websocket: WebSocket, project_id: str):
    await manager.connect(project_id, websocket)
    try:
        await websocket.send_json({"type": "hello", "project_id": project_id})
        while True:
            data = await websocket.receive_json()
            # Broadcast transport / mixer sync between clients.
            await manager.broadcast(project_id, {"type": "event", "payload": data, "project_id": project_id})
    except WebSocketDisconnect:
        manager.disconnect(project_id, websocket)
    except Exception:
        manager.disconnect(project_id, websocket)
