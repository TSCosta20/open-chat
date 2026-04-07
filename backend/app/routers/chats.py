import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.schemas import ChatCreate, ChatUpdate, ChatResponse

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[ChatResponse])
def list_chats(db: Session = Depends(get_db)):
    return (
        db.query(models.Chat)
        .order_by(models.Chat.updated_at.desc())
        .all()
    )


@router.post("", response_model=ChatResponse, status_code=201)
def create_chat(body: ChatCreate, db: Session = Depends(get_db)):
    chat = models.Chat(id=str(uuid.uuid4()), title=body.title, model=body.model)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


@router.patch("/{chat_id}", response_model=ChatResponse)
def rename_chat(chat_id: str, body: ChatUpdate, db: Session = Depends(get_db)):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    chat.title = body.title
    db.commit()
    db.refresh(chat)
    return chat


@router.delete("/{chat_id}", status_code=204)
def delete_chat(chat_id: str, db: Session = Depends(get_db)):
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    # Cascade deletes messages via FK
    db.query(models.Message).filter(models.Message.chat_id == chat_id).delete()
    db.delete(chat)
    db.commit()
