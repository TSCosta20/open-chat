from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Literal


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str | None

    model_config = {"from_attributes": True}


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
