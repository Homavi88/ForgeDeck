from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.database import SessionLocal
from app.deps import user_from_token
from app.models import Project
from app.services.events import manager

router = APIRouter(tags=["realtime"])


@router.websocket("/ws/projects/{project_id}")
async def project_socket(websocket: WebSocket, project_id: str):
    await websocket.accept()
    db = SessionLocal()
    try:
        try:
            user = user_from_token(db, websocket.query_params.get("token"))
        except HTTPException:
            await websocket.close(code=4401)
            return
        project = db.get(Project, project_id)
        if not project or project.user_id != user.id:
            await websocket.close(code=4404)
            return
    finally:
        db.close()

    await manager.connect(project_id, websocket, already_accepted=True)
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
