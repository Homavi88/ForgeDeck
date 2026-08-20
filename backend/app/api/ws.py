from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.events import manager

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/projects/{project_id}")
async def project_socket(websocket: WebSocket, project_id: str):
    await manager.connect(project_id, websocket)
    try:
        await websocket.send_json({"type": "hello", "project_id": project_id, **manager.snapshot(project_id)})
        while True:
            data = await websocket.receive_json()
            await manager.handle(project_id, websocket, data)
    except WebSocketDisconnect:
        manager.disconnect(project_id, websocket)
        await manager.broadcast(project_id, {"type": "room", **manager.snapshot(project_id)})
    except Exception:
        manager.disconnect(project_id, websocket)
        try:
            await manager.broadcast(project_id, {"type": "room", **manager.snapshot(project_id)})
        except Exception:
            pass
