from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ai_agents.orchestrator import AgentOrchestrator
from app.database import get_db
from app.deps import get_current_user
from app.models import AIConversation, AITask, Project, User
from app.schemas import AIApplyRequest, AIChatRequest, AIChatResponse

router = APIRouter(prefix="/ai", tags=["ai"])


def _get_or_create_conversation(db: Session, project_id: str | None, conversation_id: str | None) -> AIConversation:
    if conversation_id:
        conv = db.get(AIConversation, conversation_id)
        if conv:
            return conv
    if not project_id:
        raise HTTPException(400, "project_id is required to start a conversation")
    if not db.get(Project, project_id):
        raise HTTPException(404, "Project not found")
    conv = AIConversation(project_id=project_id, messages=[])
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.post("/chat", response_model=AIChatResponse)
def chat(
    payload: AIChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = _get_or_create_conversation(db, payload.project_id, payload.conversation_id)
    orchestrator = AgentOrchestrator(db)
    result = orchestrator.chat(payload.message, conv.project_id, payload.context)
    messages = list(conv.messages or [])
    messages.append({"role": "user", "content": payload.message})
    messages.append({"role": "assistant", "content": result["message"], "actions": result["actions"]})
    conv.messages = messages
    task = AITask(
        conversation_id=conv.id,
        status="preview",
        prompt=payload.message,
        result=result,
    )
    db.add(task)
    db.add(conv)
    db.commit()
    return AIChatResponse(
        conversation_id=conv.id,
        message=result["message"],
        actions=result["actions"],
        reasoning=result.get("reasoning"),
    )


@router.post("/actions/preview")
def preview_actions(payload: AIApplyRequest, db: Session = Depends(get_db)):
    return {
        "ok": True,
        "actions": payload.actions,
        "note": "Preview only — nothing was written. Call /api/ai/actions/apply to commit.",
    }


@router.post("/actions/apply")
def apply_actions(payload: AIApplyRequest, db: Session = Depends(get_db)):
    if not db.get(Project, payload.project_id):
        raise HTTPException(404, "Project not found")
    orchestrator = AgentOrchestrator(db)
    applied = orchestrator.apply_actions(payload.project_id, payload.actions)
    return {"ok": True, "applied": applied}


@router.get("/conversations/{project_id}")
def list_conversations(project_id: str, db: Session = Depends(get_db)):
    return (
        db.query(AIConversation)
        .filter(AIConversation.project_id == project_id)
        .order_by(AIConversation.updated_at.desc())
        .all()
    )
