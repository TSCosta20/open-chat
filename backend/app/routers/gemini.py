"""Cloud inference router — supports Google Gemini (own key) and OpenRouter free models."""
import os
import json
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app import models
from app.auth import get_user_id

router = APIRouter(tags=["cloud"])

# Gemini REST endpoint (SSE)
_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/{model}:streamGenerateContent?alt=sse&key={key}"
)

# OpenRouter (OpenAI-compatible, streaming)
_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

ALLOWED_MODELS = {
    # Gemini — user supplies GEMINI_API_KEY
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    # OpenRouter free tier — user supplies OPENROUTER_API_KEY
    "google/gemma-3-27b-it:free",
    "google/gemma-3-12b-it:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "deepseek/deepseek-r1-0528:free",
}


class CloudChatRequest(BaseModel):
    chat_id: str
    content: str
    model: str = "google/gemma-3-27b-it:free"


# ── Gemini streaming ──────────────────────────────────────────────────────────

async def _stream_gemini(model: str, history: list, new_content: str, api_key: str):
    """Yields (token, error) tuples from the Gemini SSE stream."""
    contents = [
        {"role": "user" if m.role == "user" else "model", "parts": [{"text": m.content}]}
        for m in history
    ]
    contents.append({"role": "user", "parts": [{"text": new_content}]})

    url = _GEMINI_URL.format(model=model, key=api_key)
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json={"contents": contents}) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                yield None, f"Gemini error {resp.status_code}: {body.decode()[:200]}"
                return
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if not data:
                    continue
                try:
                    chunk = json.loads(data)
                    text = chunk["candidates"][0]["content"]["parts"][0]["text"]
                    yield text, None
                except (KeyError, IndexError, json.JSONDecodeError):
                    pass


# ── OpenRouter streaming ──────────────────────────────────────────────────────

async def _stream_openrouter(model: str, history: list, new_content: str, api_key: str):
    """Yields (token, error) tuples from the OpenRouter SSE stream."""
    messages = [
        {"role": m.role, "content": m.content}
        for m in history
    ]
    messages.append({"role": "user", "content": new_content})

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://openchat.waldyn.com",
        "X-Title": "OpenChat",
    }
    body = {"model": model, "messages": messages, "stream": True}

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", _OPENROUTER_URL, json=body, headers=headers) as resp:
            if resp.status_code != 200:
                err_body = await resp.aread()
                yield None, f"OpenRouter error {resp.status_code}: {err_body.decode()[:200]}"
                return
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    return
                try:
                    chunk = json.loads(data)
                    text = chunk["choices"][0]["delta"].get("content", "")
                    if text:
                        yield text, None
                except (KeyError, IndexError, json.JSONDecodeError):
                    pass


# ── Endpoint ──────────────────────────────────────────────────────────────────

class CloudChatRequestWithKeys(CloudChatRequest):
    openrouter_key: str = ""
    gemini_key: str = ""


@router.post("/chat/cloud")
async def cloud_chat(
    body: CloudChatRequestWithKeys,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    if body.model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {body.model}")

    is_gemini = body.model.startswith("gemini-")

    if is_gemini:
        # User-provided key takes priority over server env var
        api_key = body.gemini_key or os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="Gemini API key required. Add your key in the model picker."
            )
    else:
        api_key = body.openrouter_key or os.environ.get("OPENROUTER_API_KEY", "")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="OpenRouter API key required. Add your key in the model picker."
            )

    chat = (
        db.query(models.Chat)
        .filter(models.Chat.id == body.chat_id, models.Chat.user_id == user_id)
        .first()
    )
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    history = (
        db.query(models.Message)
        .filter(models.Message.chat_id == body.chat_id)
        .order_by(models.Message.created_at.asc())
        .all()
    )

    async def generate():
        full_text = ""
        stream = (
            _stream_gemini(body.model, history, body.content, api_key)
            if is_gemini
            else _stream_openrouter(body.model, history, body.content, api_key)
        )
        try:
            async for token, error in stream:
                if error:
                    yield f"data: {json.dumps({'error': error})}\n\n"
                    return
                full_text += token
                yield f"data: {json.dumps({'token': token})}\n\n"

            # Persist both messages after stream completes
            for role, content in [("user", body.content), ("assistant", full_text)]:
                db.add(models.Message(
                    id=str(uuid.uuid4()),
                    chat_id=body.chat_id,
                    role=role,
                    content=content,
                ))
            db.commit()
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
