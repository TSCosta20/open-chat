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

# Priority order for automatic fallback
OPENROUTER_FALLBACK_CHAIN = [
    ("meta-llama/llama-3.3-70b-instruct:free",  "Llama 3.3 70B"),
    ("meta-llama/llama-3.1-8b-instruct:free",   "Llama 3.1 8B"),
    ("google/gemma-3-27b-it:free",               "Gemma 3 27B"),
    ("google/gemma-3-12b-it:free",               "Gemma 3 12B"),
    ("deepseek/deepseek-r1-0528:free",           "DeepSeek R1"),
]

GEMINI_MODELS = {
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
}


def _is_allowed(model: str) -> bool:
    """Accept Gemini models, openrouter:auto, and any OpenRouter free-tier model."""
    if model in GEMINI_MODELS:
        return True
    if model == "openrouter:auto":
        return True
    # Any OpenRouter free model (ends with :free and contains a slash = provider/model)
    if model.endswith(":free") and "/" in model:
        return True
    return False


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
                if resp.status_code == 429:
                    yield None, "Gemini rate limit reached. Wait a moment and try again, or use a different model."
                elif resp.status_code in (401, 403):
                    yield None, "Invalid Gemini API key. Please check your key in the model picker."
                else:
                    try:
                        detail = json.loads(body).get("error", {}).get("message", body.decode()[:120])
                    except Exception:
                        detail = body.decode()[:120]
                    yield None, f"Gemini error: {detail}"
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
                if resp.status_code == 429:
                    yield None, "This model is currently busy (rate-limited). Try a different model or wait a moment."
                elif resp.status_code == 401:
                    yield None, "Invalid OpenRouter API key. Please check your key in the model picker."
                else:
                    try:
                        detail = json.loads(err_body).get("error", {}).get("message", err_body.decode()[:120])
                    except Exception:
                        detail = err_body.decode()[:120]
                    yield None, f"OpenRouter error: {detail}"
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


def _status(msg: str) -> str:
    return f"data: {json.dumps({'type': 'status', 'text': msg})}\n\n"


@router.post("/chat/cloud")
async def cloud_chat(
    body: CloudChatRequestWithKeys,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_user_id),
):
    if not _is_allowed(body.model):
        raise HTTPException(status_code=400, detail=f"Unsupported model: {body.model}")

    is_gemini = body.model.startswith("gemini-")
    use_auto  = body.model == "openrouter:auto"

    chat = (
        db.query(models.Chat)
        .filter(models.Chat.id == body.chat_id, models.Chat.user_id == user_id)
        .first()
    )
    if not chat:
        # Chat may have been created optimistically on the client — create it now
        chat = models.Chat(
            id=body.chat_id,
            user_id=user_id,
            title="New Chat",
            model=body.model,
        )
        db.add(chat)
        db.commit()

    history = (
        db.query(models.Message)
        .filter(models.Message.chat_id == body.chat_id)
        .order_by(models.Message.created_at.asc())
        .all()
    )

    async def generate():
        full_text = ""

        # ── Gemini (direct, no fallback needed) ──────────────────────────
        if is_gemini:
            api_key = body.gemini_key or os.environ.get("GEMINI_API_KEY", "")
            if not api_key:
                yield f"data: {json.dumps({'error': 'Gemini API key required. Add your key in the model picker.'})}\n\n"
                yield "data: [DONE]\n\n"
                return
            yield _status(f"Using Gemini…")
            try:
                async for token, error in _stream_gemini(body.model, history, body.content, api_key):
                    if error:
                        yield f"data: {json.dumps({'error': error})}\n\n"
                        yield "data: [DONE]\n\n"
                        return
                    full_text += token
                    yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                yield "data: [DONE]\n\n"
                return

        # ── OpenRouter with automatic fallback chain ──────────────────────
        else:
            api_key = body.openrouter_key or os.environ.get("OPENROUTER_API_KEY", "")
            if not api_key:
                yield f"data: {json.dumps({'error': 'OpenRouter API key required. Add your key in the model picker.'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            # Auto mode: try full chain. Specific model: try only that one.
            if use_auto:
                chain = OPENROUTER_FALLBACK_CHAIN
            else:
                requested_label = next((label for mid, label in OPENROUTER_FALLBACK_CHAIN if mid == body.model), body.model)
                chain = [(body.model, requested_label)]

            succeeded = False
            for model_id, model_label in chain:
                if use_auto:
                    yield _status(f"Trying {model_label}…")
                got_token = False
                failed = False

                try:
                    async for token, error in _stream_openrouter(model_id, history, body.content, api_key):
                        if error:
                            failed = True
                            break
                        if not got_token:
                            # First real token — clear status
                            yield _status("")
                            got_token = True
                        full_text += token
                        yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
                except Exception:
                    failed = True

                if not failed:
                    succeeded = True
                    break

                if use_auto:
                    yield _status(f"{model_label} unavailable — trying next…")
                else:
                    yield f"data: {json.dumps({'error': f'{model_label} is currently unavailable. Try \"Best available\" or pick a different model.'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

            if not succeeded:
                yield f"data: {json.dumps({'error': 'All models are currently unavailable. Please try again in a moment.', 'suggest_local': True})}\n\n"
                yield "data: [DONE]\n\n"
                return

        # Persist after successful generation
        if full_text:
            for role, content in [("user", body.content), ("assistant", full_text)]:
                db.add(models.Message(
                    id=str(uuid.uuid4()),
                    chat_id=body.chat_id,
                    role=role,
                    content=content,
                ))
            db.commit()

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
