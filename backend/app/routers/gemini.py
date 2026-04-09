"""Cloud inference router — supports Google Gemini (own key) and OpenRouter free models."""
import os
import json
import uuid
import time
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
_OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions"
_OPENROUTER_MODELS  = "https://openrouter.ai/api/v1/models"

# ── Quality ranking ────────────────────────────────────────────────────────────
# Higher score = try first. Models not listed default to score 0 (ranked by
# context length among themselves). Update this as new standout models release.

MODEL_QUALITY: dict[str, int] = {
    # Tier 1 — best reasoning / largest capable models
    "deepseek/deepseek-r1-0528:free":              100,
    "qwen/qwen3-235b-a22b:free":                    97,
    "meta-llama/llama-3.3-70b-instruct:free":       95,
    "nvidia/llama-3.1-nemotron-70b-instruct:free":  93,
    "deepseek/deepseek-r1:free":                    92,
    "microsoft/phi-4-reasoning-plus:free":          90,
    "nousresearch/hermes-3-llama-3.1-405b:free":    88,
    # Tier 2 — very good
    "qwen/qwen-2.5-72b-instruct:free":              85,
    "qwen/qwen3-30b-a3b:free":                      83,
    "deepseek/deepseek-chat-v3-5:free":             82,
    "google/gemma-3-27b-it:free":                   80,
    "microsoft/phi-4:free":                         79,
    "microsoft/phi-4-reasoning:free":               78,
    "google/gemma-3-12b-it:free":                   75,
    # Tier 3 — solid mid-range
    "qwen/qwen3-14b:free":                          70,
    "qwen/qwen3-8b:free":                           68,
    "mistralai/mistral-nemo:free":                  65,
    "cohere/command-r7b-12-2024:free":              63,
    "meta-llama/llama-3.1-8b-instruct:free":        62,
    "google/gemma-2-9b-it:free":                    60,
    # Tier 4 — small but functional
    "qwen/qwen3-4b:free":                           50,
    "google/gemma-3-4b-it:free":                    48,
    "mistralai/mistral-7b-instruct:free":           45,
    "qwen/qwen3-1.7b:free":                         35,
    "google/gemma-3-1b-it:free":                    25,
    "qwen/qwen3-0.6b:free":                         15,
}

# Gemini models shown in the UI Cloud tab. Best available ("openrouter:auto")
# tries these too, so it attempts every model a user can pick in Cloud.
AUTO_GEMINI_MODELS: list[tuple[str, str]] = [
    ("gemini-2.0-flash", "Gemini 2.0 Flash"),
]

# Cross-provider quality scores for Best available. Higher = try earlier.
# Models not listed default to 0.
AUTO_MODEL_QUALITY: dict[str, int] = {
    "gemini-2.0-flash": 66,
}

# ── In-memory cache of free models from OpenRouter API ────────────────────────

_or_cache: list[dict] = []
_or_cache_ts: float = 0.0
_OR_CACHE_TTL = 600  # seconds — refresh every 10 min


def _parse_provider(model_id: str) -> str:
    return (model_id.split("/", 1)[0] or model_id) if "/" in model_id else model_id


async def _fetch_or_free_models_detailed(api_key: str | None = None) -> list[dict]:
    """Return quality-ranked list of OpenRouter free models with metadata."""
    global _or_cache, _or_cache_ts

    if _or_cache and (time.time() - _or_cache_ts) < _OR_CACHE_TTL:
        return _or_cache

    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(_OPENROUTER_MODELS, headers=headers)
            if resp.status_code != 200:
                return _or_cache

            raw = resp.json().get("data", [])
            free: list[dict] = []
            for m in raw:
                mid = m.get("id", "")
                pricing = m.get("pricing", {})
                if not (
                    mid.endswith(":free")
                    and "/" in mid
                    and pricing.get("prompt") == "0"
                    and pricing.get("completion") == "0"
                ):
                    continue

                name = _clean_or_name(m.get("name", mid))
                score = MODEL_QUALITY.get(mid, 0)
                ctx = m.get("context_length") or 0
                per_req = m.get("per_request_limits") or {}
                has_limits = bool(per_req) and len(per_req.keys()) > 0

                free.append({
                    "id": mid,
                    "name": name,
                    "provider": _parse_provider(mid),
                    "contextLength": ctx,
                    "hasRequestLimits": has_limits,
                    "quality": score,
                })

            free.sort(key=lambda x: (-x["quality"], x["hasRequestLimits"], -(x["contextLength"] or 0), x["name"]))
            _or_cache = free
            _or_cache_ts = time.time()
            return free
    except Exception:
        return _or_cache


async def _fetch_or_free_models(api_key: str) -> list[tuple[str, str]]:
    """Return quality-ranked list of (model_id, display_name) from OpenRouter."""
    models = await _fetch_or_free_models_detailed(api_key)
    return [(m["id"], m["name"]) for m in models]


def _clean_or_name(raw: str) -> str:
    import re
    return re.sub(r"\s*[\(\[]free[\)\]]\s*", "", raw, flags=re.IGNORECASE).strip()


@router.get("/models/openrouter/free")
async def list_openrouter_free_models():
    models = await _fetch_or_free_models_detailed()
    return {"data": models}

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
    if model.endswith(":free") and "/" in model:
        return True
    return False


class CloudChatRequest(BaseModel):
    chat_id: str
    content: str
    model: str = "openrouter:auto"


# ── Gemini streaming ──────────────────────────────────────────────────────────

async def _stream_gemini(model: str, history: list, new_content: str, api_key: str):
    """Yields (token, error, meta) tuples from the Gemini SSE stream."""
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
                    yield None, "Gemini rate limit reached. Wait a moment and try again, or use a different model.", None
                elif resp.status_code in (401, 403):
                    yield None, "Invalid Gemini API key. Please check your key in the model picker.", None
                else:
                    try:
                        detail = json.loads(body).get("error", {}).get("message", body.decode()[:120])
                    except Exception:
                        detail = body.decode()[:120]
                    yield None, f"Gemini error: {detail}", None
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
                    yield text, None, None
                except (KeyError, IndexError, json.JSONDecodeError):
                    pass


# ── OpenRouter streaming ──────────────────────────────────────────────────────

def _parse_openrouter_ratelimits(headers: httpx.Headers) -> dict | None:
    def get_int(name: str) -> int | None:
        raw = headers.get(name)
        if raw is None:
            return None
        try:
            return int(raw)
        except Exception:
            return None

    req_limit = get_int("x-ratelimit-limit-requests")
    req_remaining = get_int("x-ratelimit-remaining-requests")
    req_reset = get_int("x-ratelimit-reset-requests")
    tok_limit = get_int("x-ratelimit-limit-tokens")
    tok_remaining = get_int("x-ratelimit-remaining-tokens")
    tok_reset = get_int("x-ratelimit-reset-tokens")
    retry_after = get_int("retry-after")

    data: dict = {}
    if req_limit is not None or req_remaining is not None:
        data["requests"] = {"limit": req_limit, "remaining": req_remaining, "reset": req_reset}
    if tok_limit is not None or tok_remaining is not None:
        data["tokens"] = {"limit": tok_limit, "remaining": tok_remaining, "reset": tok_reset}
    if retry_after is not None:
        data["retryAfter"] = retry_after

    return data or None


async def _stream_openrouter(model: str, history: list, new_content: str, api_key: str):
    """Yields (token, error, meta) tuples from the OpenRouter SSE stream."""
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
                meta = _parse_openrouter_ratelimits(resp.headers)
                if meta:
                    yield None, None, meta
                if resp.status_code == 429:
                    yield None, "rate_limited", None
                elif resp.status_code == 402:
                    yield None, "quota_exceeded", None
                elif resp.status_code == 401:
                    yield None, "Invalid OpenRouter API key. Please check your key in the model picker.", None
                else:
                    try:
                        detail = json.loads(err_body).get("error", {}).get("message", err_body.decode()[:120])
                    except Exception:
                        detail = err_body.decode()[:120]
                    yield None, f"OpenRouter error: {detail}", None
                return

            meta = _parse_openrouter_ratelimits(resp.headers)
            if meta:
                yield None, None, meta

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    return
                try:
                    chunk = json.loads(data)
                    # OpenRouter may embed errors in the stream
                    if "error" in chunk:
                        code = chunk["error"].get("code", 0)
                        if code == 429:
                            yield None, "rate_limited", None
                        elif code == 402:
                            yield None, "quota_exceeded", None
                        else:
                            yield None, chunk["error"].get("message", "Unknown error"), None
                        return
                    text = chunk["choices"][0]["delta"].get("content", "")
                    if text:
                        yield text, None, None
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

        # Best available (openrouter:auto) â€” try every model shown in Cloud tab, by quality.
        if use_auto:
            openrouter_key = body.openrouter_key or os.environ.get("OPENROUTER_API_KEY", "")
            gemini_key = body.gemini_key or os.environ.get("GEMINI_API_KEY", "")

            if not openrouter_key and not gemini_key:
                yield f"data: {json.dumps({'error': 'A cloud API key is required. Add an OpenRouter key or a Gemini key in the model picker.'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            # (provider, model_id, label, score, rank)
            candidates: list[tuple[str, str, str, int, int]] = []
            reason_counts: dict[str, int] = {}
            best_retry_after_s: int | None = None

            def _fmt_wait(seconds: int) -> str:
                if seconds < 90:
                    return f"~{seconds}s"
                mins = max(1, round(seconds / 60))
                return f"~{mins}m"

            def _bump(reason: str):
                reason_counts[reason] = reason_counts.get(reason, 0) + 1

            def _classify(provider: str, error_text: str) -> str:
                if provider == "openrouter":
                    if error_text in ("rate_limited", "quota_exceeded"):
                        return error_text
                    if error_text.startswith("Invalid OpenRouter API key"):
                        return "invalid_key"
                    if error_text.startswith("OpenRouter error:"):
                        return "provider_error"
                    if error_text == "unavailable":
                        return "unavailable"
                    return "other"
                # Gemini
                low = error_text.lower()
                if "rate limit" in low:
                    return "rate_limited"
                if "invalid gemini api key" in low:
                    return "invalid_key"
                if error_text.startswith("Gemini error:"):
                    return "provider_error"
                if error_text == "unavailable":
                    return "unavailable"
                return "other"

            if openrouter_key:
                or_chain = await _fetch_or_free_models(openrouter_key)
                for idx, (mid, label) in enumerate(or_chain):
                    candidates.append(("openrouter", mid, label, MODEL_QUALITY.get(mid, 0), idx))

            if gemini_key:
                for idx, (mid, label) in enumerate(AUTO_GEMINI_MODELS):
                    candidates.append(("gemini", mid, label, AUTO_MODEL_QUALITY.get(mid, 0), 1_000_000 + idx))

            if not candidates:
                yield f"data: {json.dumps({'error': 'No cloud models are available to try right now.', 'suggest_local': True, 'reason': 'No cloud models available to try.'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            candidates.sort(key=lambda c: (-c[3], c[4]))

            last_error: str | None = None
            attempted = 0

            for provider, model_id, model_label, _, _ in candidates:
                attempted += 1
                yield _status(f"Trying {model_label}...")

                got_token = False
                error_text: str | None = None

                try:
                    if provider == "gemini":
                        async for token, error, _meta in _stream_gemini(model_id, history, body.content, gemini_key):
                            if error:
                                error_text = error
                                break
                            if token and not got_token:
                                yield f"data: {json.dumps({'type': 'model', 'provider': 'gemini', 'id': model_id, 'label': model_label})}\n\n"
                                yield _status("")
                                got_token = True
                            if token:
                                full_text += token
                                yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
                    else:
                        sent_usage = False
                        async for token, error, meta in _stream_openrouter(model_id, history, body.content, openrouter_key):
                            if meta and not sent_usage:
                                sent_usage = True
                                yield f"data: {json.dumps({'type': 'usage', 'provider': 'openrouter', 'id': model_id, 'usage': meta})}\n\n"
                                ra = meta.get("retryAfter")
                                if isinstance(ra, int) and ra > 0:
                                    best_retry_after_s = ra if best_retry_after_s is None else min(best_retry_after_s, ra)
                            if error:
                                error_text = error
                                break
                            if token and not got_token:
                                yield f"data: {json.dumps({'type': 'model', 'provider': 'openrouter', 'id': model_id, 'label': model_label})}\n\n"
                                yield _status("")
                                got_token = True
                            if token:
                                full_text += token
                                yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
                except Exception:
                    error_text = "unavailable"

                if error_text and got_token:
                    # Avoid mixing outputs from multiple models.
                    yield f"data: {json.dumps({'error': error_text})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                if not error_text:
                    # Success
                    break

                last_error = error_text
                _bump(_classify(provider, error_text))

                retryable = False
                if provider == "openrouter":
                    retryable = (
                        error_text in ("rate_limited", "quota_exceeded", "unavailable")
                        or error_text.startswith("OpenRouter error:")
                        or error_text.startswith("Invalid OpenRouter API key")
                    )
                else:
                    low = error_text.lower()
                    retryable = (
                        ("rate limit" in low)
                        or ("gemini error:" in low)
                        or ("invalid gemini api key" in low)
                        or (error_text == "unavailable")
                    )

                if retryable and attempted <= 4:
                    yield _status(f"{model_label} unavailable - trying next...")
                continue

            if not full_text:
                msg = last_error or "No cloud models are available right now. Please try again."
                # Pick a concise primary reason for the UI.
                primary = "unknown"
                for key in ("invalid_key", "quota_exceeded", "rate_limited", "unavailable", "provider_error", "other"):
                    if reason_counts.get(key, 0) > 0:
                        primary = key
                        break
                reason_msg = {
                    "invalid_key": "Your cloud API key was rejected (invalid or expired).",
                    "quota_exceeded": "Your cloud provider quota is exhausted.",
                    "rate_limited": "Cloud providers are rate-limiting right now.",
                    "unavailable": "Cloud providers are temporarily unavailable.",
                    "provider_error": "Cloud provider returned an error.",
                    "other": "Cloud request failed.",
                    "unknown": "Cloud request failed.",
                }.get(primary, "Cloud request failed.")

                if primary == "rate_limited":
                    if best_retry_after_s is not None:
                        reason_msg = f"{reason_msg} Try again in {_fmt_wait(best_retry_after_s)}."
                    else:
                        reason_msg = f"{reason_msg} Reset time was not provided by the provider."

                yield f"data: {json.dumps({'error': msg, 'suggest_local': True, 'reason': reason_msg})}\n\n"
                yield "data: [DONE]\n\n"
                return

        # ── Gemini ───────────────────────────────────────────────────────────
        elif is_gemini:
            api_key = body.gemini_key or os.environ.get("GEMINI_API_KEY", "")
            if not api_key:
                yield f"data: {json.dumps({'error': 'Gemini API key required. Add your key in the model picker.'})}\n\n"
                yield "data: [DONE]\n\n"
                return
            yield _status("Using Gemini…")
            try:
                got_token = False
                async for token, error, _meta in _stream_gemini(body.model, history, body.content, api_key):
                    if error:
                        yield f"data: {json.dumps({'error': error})}\n\n"
                        yield "data: [DONE]\n\n"
                        return
                    if token and not got_token:
                        got_token = True
                        yield f"data: {json.dumps({'type': 'model', 'provider': 'gemini', 'id': body.model, 'label': body.model})}\n\n"
                    if token:
                        if token:
                            full_text += token
                            yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                yield "data: [DONE]\n\n"
                return

        # ── OpenRouter ───────────────────────────────────────────────────────
        else:
            api_key = body.openrouter_key or os.environ.get("OPENROUTER_API_KEY", "")
            if not api_key:
                yield f"data: {json.dumps({'error': 'OpenRouter API key required. Add your key in the model picker.'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            if use_auto:
                # Fetch ranked list (cached) and walk through all of them
                chain = await _fetch_or_free_models(api_key)
            else:
                # Specific model requested — single attempt
                short_name = body.model.split("/")[-1].replace(":free", "")
                chain = [(body.model, short_name)]

            succeeded = False
            skipped = 0
            for model_id, model_label in chain:
                if use_auto:
                    yield _status(f"Trying {model_label}…")

                got_token = False
                failed = False
                skip_reason: str | None = None

                try:
                    sent_usage = False
                    async for token, error, meta in _stream_openrouter(model_id, history, body.content, api_key):
                        if meta and not sent_usage:
                            sent_usage = True
                            yield f"data: {json.dumps({'type': 'usage', 'provider': 'openrouter', 'id': model_id, 'usage': meta})}\n\n"
                        if error:
                            failed = True
                            skip_reason = error
                            break
                        if token and not got_token:
                            yield f"data: {json.dumps({'type': 'model', 'provider': 'openrouter', 'id': model_id, 'label': model_label})}\n\n"
                            yield _status("")   # clear "Trying…" status
                            got_token = True
                        if token:
                            full_text += token
                            yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
                except Exception:
                    failed = True
                    skip_reason = "unavailable"

                if not failed:
                    succeeded = True
                    break

                # Decide whether to continue or abort
                if use_auto:
                    if skip_reason in ("rate_limited", "quota_exceeded", "unavailable", None):
                        # Transient — try next
                        skipped += 1
                        if skipped <= 3:
                            yield _status(f"{model_label} at limit — trying next…")
                        continue
                    else:
                        # Fatal error (bad key, etc.) — stop immediately
                        yield f"data: {json.dumps({'error': skip_reason})}\n\n"
                        yield "data: [DONE]\n\n"
                        return
                else:
                    # Specific model failed
                    short = body.model.split("/")[-1].replace(":free", "")
                    if skip_reason in ("rate_limited", "quota_exceeded"):
                        msg = f"{short} has reached its rate limit. Try «Best available» to auto-select a working model."
                    else:
                        msg = skip_reason or f"{short} is currently unavailable."
                    yield f"data: {json.dumps({'error': msg})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

            if not succeeded:
                yield f"data: {json.dumps({'error': 'All free models are currently at their rate limits. Please try again in a few minutes.', 'suggest_local': True})}\n\n"
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
