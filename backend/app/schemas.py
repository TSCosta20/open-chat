from pydantic import BaseModel
from datetime import datetime
from typing import Literal


class ChatCreate(BaseModel):
    title: str = "New Chat"
    model: str = "gemma-7b-it"


class ChatUpdate(BaseModel):
    title: str


class ChatResponse(BaseModel):
    id: str
    title: str
    model: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessagePersist(BaseModel):
    user: str
    assistant: str
