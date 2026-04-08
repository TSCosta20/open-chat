import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.schemas import ChatCreate, ChatUpdate, ChatResponse
from app.auth import get_user_id

router = APIRouter(prefix="/chats", tags=["chats"])


@router.get("", response_model=list[ChatResponse])
def list_chats(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    return (
        db.query(models.Chat)
        .filter(models.Chat.user_id == user_id)
        .order_by(models.Chat.updated_at.desc())
        .all()
    )


@router.post("", response_model=ChatResponse, status_code=201)
def create_chat(
    body: ChatCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    chat = models.Chat(
        id=str(uuid.uuid4()),
        user_id=user_id,
        title=body.title,
        model=body.model,
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return chat


@router.patch("/{chat_id}", response_model=ChatResponse)
def rename_chat(
    chat_id: str,
    body: ChatUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    chat = (
        db.query(models.Chat)
        .filter(models.Chat.id == chat_id, models.Chat.user_id == user_id)
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if body.title is not None:
        chat.title = body.title
    if body.model is not None:
        chat.model = body.model
    db.commit()
    db.refresh(chat)
    return chat


@router.delete("/{chat_id}", status_code=204)
def delete_chat(
    chat_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    chat = (
        db.query(models.Chat)
        .filter(models.Chat.id == chat_id, models.Chat.user_id == user_id)
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    db.query(models.Message).filter(models.Message.chat_id == chat_id).delete()
    db.delete(chat)
    db.commit()
