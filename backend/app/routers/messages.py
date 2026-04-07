import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.schemas import MessageResponse, MessagePersist

router = APIRouter(tags=["messages"])


@router.get("/messages/{chat_id}", response_model=list[MessageResponse])
def get_messages(chat_id: str, db: Session = Depends(get_db)):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return (
        db.query(models.Message)
        .filter(models.Message.chat_id == chat_id)
        .order_by(models.Message.created_at.asc())
        .all()
    )


@router.post("/messages/{chat_id}", status_code=201)
def persist_messages(chat_id: str, body: MessagePersist, db: Session = Depends(get_db)):
    """Persist a user+assistant message pair after local inference completes."""
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    for role, content in [("user", body.user), ("assistant", body.assistant)]:
        msg = models.Message(
            id=str(uuid.uuid4()),
            chat_id=chat_id,
            role=role,
            content=content,
        )
        db.add(msg)
    db.commit()
    return {"ok": True}
