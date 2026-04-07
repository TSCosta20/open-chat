from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Chat(Base):
    __tablename__ = "chats"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False, default="New Chat")
    model = Column(String, nullable=False, default="gemma-7b-it")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, index=True)
    chat_id = Column(
        String, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role = Column(String, nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
