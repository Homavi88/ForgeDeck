"""Local-only process control."""

from fastapi import APIRouter, HTTPException, Request

from app.services.shutdown import is_local_client, schedule_shutdown

router = APIRouter(tags=["system"])


@router.post("/shutdown")
def shutdown(request: Request):
    host = request.client.host if request.client else ""
    if not is_local_client(host):
        raise HTTPException(403, "Shutdown is only allowed from this computer")
    schedule_shutdown()
    return {"ok": True, "stopping": True}
