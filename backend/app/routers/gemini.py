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
from pydantic import Field
from app.database import get_db
from app import models
from app.auth import get_user_id

router = APIRouter(tags=["cloud"])

# Gemini REST endpoint (SSE)
_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/{model}:streamGenerateContent?alt=sse&key={key}"
)

_GEMINI_GEN_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/{model}:generateContent?key={key}"
)

# OpenRouter (OpenAI-compatible, streaming)
_OPENROUTER_URL     = "https://openrouter.ai/api/v1/chat/completions"
_OPENROUTER_MODELS  = "https://openrouter.ai/api/v1/models"

# OpenAI-compatible providers (model listing + chat completions)
_OPENAI_COMPAT_BASE_URLS: dict[str, str] = {
    # OpenAI-style endpoints
    "groq": "https://api.groq.com/openai/v1",
    "together": "https://api.together.xyz/v1",
    "fireworks": "https://api.fireworks.ai/inference/v1",
    # Hugging Face Inference API router (OpenAI-compatible)
    "huggingface": "https://router.huggingface.co/v1",
    # Puter exposes an OpenAI-compatible endpoint using a Puter auth token
    "puter": "https://api.puter.com/puterai/openai/v1",
}

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

_compat_cache: dict[str, tuple[float, list[dict]]] = {}
_COMPAT_CACHE_TTL = 600  # seconds


def _parse_provider(model_id: str) -> str:
    return (model_id.split("/", 1)[0] or model_id) if "/" in model_id else model_id


_SKIP_MODEL_PATTERNS = [
    "embedding",
    "embed",
    "rerank",
    "tts",
    "whisper",
    "speech",
    "vision-embed",
]


def _should_skip_model_id(model_id: str) -> bool:
    low = model_id.lower()
    return any(p in low for p in _SKIP_MODEL_PATTERNS)


def _msg_role(m) -> str:
    if isinstance(m, dict):
        return str(m.get("role") or "")
    return str(getattr(m, "role", ""))


def _msg_content(m) -> str:
    if isinstance(m, dict):
        return str(m.get("content") or "")
    return str(getattr(m, "content", ""))


def _to_openai_messages(history: list) -> list[dict]:
    out: list[dict] = []
    for m in history:
        role = _msg_role(m)
        content = _msg_content(m)
        if not role or not content:
            continue
        if role not in ("system", "user", "assistant"):
            continue
        out.append({"role": role, "content": content})
    return out


def _quality_score(model_id: str) -> int:
    """Cross-provider approximate quality score. Higher = try earlier."""
    # Exact OpenRouter IDs (free tier) are scored by explicit mapping
    if model_id in MODEL_QUALITY:
        return MODEL_QUALITY[model_id]

    low = model_id.lower()

    # Canonical reasoning models
    if "deepseek" in low and "r1" in low:
        return 92
    if "qwen" in low and ("235b" in low or "a22b" in low):
        return 97
    if "llama" in low and ("70b" in low or "72b" in low):
        return 90
    if "llama" in low and "405b" in low:
        return 96
    if "phi" in low and "reasoning" in low:
        return 78

    # Heuristic by parameter count when present
    import re
    m = re.search(r"(\d{1,3})(?:\.(\d))?b", low)
    if m:
        whole = int(m.group(1))
        frac = int(m.group(2) or 0)
        size = whole + (frac / 10.0)
        if size >= 200:
            return 95
        if size >= 70:
            return 90
        if size >= 30:
            return 82
        if size >= 14:
            return 72
        if size >= 8:
            return 66
        if size >= 4:
            return 52
        if size >= 1:
            return 30

    return 0


def _parse_param_b(model_id: str) -> float | None:
    import re
    low = model_id.lower()
    m = re.search(r"(\d{1,3})(?:\.(\d))?b", low)
    if not m:
        return None
    whole = int(m.group(1))
    frac = int(m.group(2) or 0)
    return whole + (frac / 10.0)


def _efficiency_score(provider: str, model_id: str) -> int:
    """Lower = more token-friendly (smaller/faster)."""
    low = model_id.lower()

    # Gemini naming
    if provider == "gemini":
        if "flash" in low:
            return 25
        return 60

    # Heuristic by parameter count when present
    b = _parse_param_b(model_id)
    if b is not None:
        return int(round(b * 10))

    if "mini" in low:
        return 80
    if "small" in low:
        return 120
    if "fast" in low or "instant" in low:
        return 150

    # Unknown size
    return 5000


async def _chat_complete_openai_json(
    provider: str,
    url: str,
    model: str,
    messages: list[dict],
    api_key: str,
    extra_headers: dict | None = None,
) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)

    body = {
        "model": model,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 48,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(url, headers=headers, json=body)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"{provider} classifier failed ({resp.status_code})")
        data = resp.json()
        return (data.get("choices") or [{}])[0].get("message", {}).get("content", "") or ""


async def _classify_request_gemini(history: list, new_content: str, api_key: str, model: str = "gemini-2.0-flash") -> str | None:
    recent = history[-8:] if len(history) > 8 else history
    transcript = "\n".join([f"{_msg_role(m).upper()}: {_msg_content(m)}" for m in recent] + [f"USER: {new_content}"])

    prompt = (
        "Output ONLY valid JSON. Decide if the last user message can be answered briefly without deep reasoning, coding, "
        "or multi-step work. Return {\"complexity\":\"simple\"} or {\"complexity\":\"complex\"}.\n\n"
        f"{transcript}"
    )

    url = _GEMINI_GEN_URL.format(model=model, key=api_key)
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(url, json=body)
            if resp.status_code != 200:
                return None
            data = resp.json()
            text = (
                (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [{}])[0].get("text")
                or ""
            )
            parsed = json.loads(text.strip() or "{}")
            complexity = str(parsed.get("complexity") or "").strip().lower()
            if complexity in ("simple", "complex"):
                return complexity
            return None
    except Exception:
        return None


async def _classify_request(
    history: list,
    new_content: str,
    candidates_by_provider: dict[str, list[dict]],
    keys: dict[str, str],
    router_base_url: str = "",
) -> str | None:
    """
    Uses a very small/cheap model to classify whether the request is 'simple'.
    Returns "simple" | "complex" | None.
    """
    # Build a minimal context window
    recent = history[-8:] if len(history) > 8 else history
    ctx_msgs = _to_openai_messages(recent)
    ctx_msgs.append({"role": "user", "content": new_content})

    system = (
        "You are a classifier. Output ONLY valid JSON. "
        "Decide if the last user message can be answered briefly without deep reasoning, coding, or multi-step work. "
        "Return {\"complexity\":\"simple\"} or {\"complexity\":\"complex\"}."
    )
    messages = [{"role": "system", "content": system}, *ctx_msgs]

    # Pick the smallest available model among enabled providers
    best: tuple[int, str, str, str] | None = None  # (eff, provider, model_id, url)

    # OpenRouter (special headers)
    if keys.get("openrouter") and candidates_by_provider.get("openrouter"):
        for m in candidates_by_provider["openrouter"]:
            mid = m.get("id") or ""
            if not mid or _should_skip_model_id(mid):
                continue
            eff = _efficiency_score("openrouter", mid)
            if best is None or eff < best[0]:
                best = (eff, "openrouter", mid, _OPENROUTER_URL)

    # OpenAI-compatible providers
    for provider in ("puter", "huggingface", "groq", "together", "fireworks", "router"):
        if provider == "router" and not router_base_url:
            continue
        key = keys.get(provider, "")
        if not key:
            continue
        models = candidates_by_provider.get(provider) or []
        for m in models:
            mid = m.get("id") or ""
            if not mid or _should_skip_model_id(mid):
                continue
            eff = _efficiency_score(provider, mid)
            base_url = router_base_url if provider == "router" else _OPENAI_COMPAT_BASE_URLS.get(provider, "")
            if not base_url:
                continue
            url = base_url.rstrip("/") + "/chat/completions"
            if best is None or eff < best[0]:
                best = (eff, provider, mid, url)

    # Gemini (fallback)
    if best is None and keys.get("gemini"):
        return await _classify_request_gemini(history, new_content, keys["gemini"])

    if best is None:
        return None

    eff, provider, model_id, url = best

    try:
        if provider == "openrouter":
            text = await _chat_complete_openai_json(
                provider="openrouter",
                url=url,
                model=model_id,
                messages=messages,
                api_key=keys["openrouter"],
                extra_headers={
                    "HTTP-Referer": "https://openchat.waldyn.com",
                    "X-Title": "OpenChat",
                },
            )
        else:
            api_key = keys[provider]
            text = await _chat_complete_openai_json(
                provider=provider,
                url=url,
                model=model_id,
                messages=messages,
                api_key=api_key,
            )

        parsed = json.loads(text.strip() or "{}")
        complexity = str(parsed.get("complexity") or "").strip().lower()
        if complexity in ("simple", "complex"):
            return complexity
        return None
    except Exception:
        return None


def _model_label(model_id: str) -> str:
    # Keep it short; the UI can show raw IDs in tooltips.
    return model_id


async def _fetch_openai_compat_models(provider: str, api_key: str, base_url: str) -> list[dict]:
    """Fetch and cache /models from an OpenAI-compatible provider."""
    cache_key = f"{provider}|{base_url}"
    cached = _compat_cache.get(cache_key)
    now = time.time()
    if cached and (now - cached[0]) < _COMPAT_CACHE_TTL:
        return cached[1]

    if not api_key:
        return []
    headers = {"Authorization": f"Bearer {api_key}"}
    url = base_url.rstrip("/") + "/models"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                body = ""
                try:
                    body = (await resp.aread()).decode(errors="ignore")[:220]
                except Exception:
                    body = ""
                detail = f"{provider} model list failed ({resp.status_code})"
                if body:
                    detail = f"{detail}: {body}"
                raise HTTPException(status_code=502, detail=detail)
            raw = resp.json().get("data", [])
            items: list[dict] = []
            for m in raw:
                mid = m.get("id") or ""
                if not mid or _should_skip_model_id(mid):
                    continue
                items.append({
                    "id": mid,
                    "name": _model_label(mid),
                    "quality": _quality_score(mid),
                    "provider": provider,
                })
            # Sort by quality desc, then ID, and cap to keep UI + auto manageable
            items.sort(key=lambda x: (-int(x.get("quality") or 0), str(x.get("id") or "")))
            items = items[:60]
            _compat_cache[cache_key] = (now, items)
            return items
    except HTTPException:
        raise
    except Exception:
        # If fetch fails, return cached data if any
        return cached[1] if cached else []

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


class CloudModelListRequest(BaseModel):
    provider: str
    api_key: str = ""
    base_url: str | None = None


@router.post("/models/cloud/list")
async def list_cloud_models(body: CloudModelListRequest):
    """Return models for a given cloud provider (used by the model picker UI)."""
    provider = (body.provider or "").strip().lower()

    if provider == "gemini":
        data = [
            {"id": mid, "name": label, "quality": AUTO_MODEL_QUALITY.get(mid, 0), "provider": "gemini"}
            for mid, label in AUTO_GEMINI_MODELS
        ]
        data.sort(key=lambda x: (-int(x.get("quality") or 0), str(x.get("id") or "")))
        return {"data": data}

    if provider == "openrouter":
        models = await _fetch_or_free_models_detailed()
        return {"data": models}

    base_url = body.base_url or _OPENAI_COMPAT_BASE_URLS.get(provider, "")
    if not base_url:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

    if not body.api_key:
        raise HTTPException(status_code=400, detail=f"{provider} API key required")

    models = await _fetch_openai_compat_models(provider, body.api_key, base_url)
    return {"data": models, "base_url": base_url}

GEMINI_MODELS = {
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
}


def _is_allowed(model: str) -> bool:
    """Accept supported cloud model selectors."""
    if model in GEMINI_MODELS:
        return True
    if model in ("openrouter:auto", "auto"):
        return True
    if model.endswith(":free") and "/" in model:
        return True
    for prefix in ("groq:", "together:", "fireworks:", "huggingface:", "puter:", "router:"):
        if model.startswith(prefix) and len(model) > len(prefix):
            return True
    return False


class CloudChatRequest(BaseModel):
    chat_id: str
    content: str
    model: str = "openrouter:auto"
    context_messages: list[dict] = Field(default_factory=list)


# ── Gemini streaming ──────────────────────────────────────────────────────────

async def _stream_gemini(model: str, history: list, new_content: str, api_key: str):
    """Yields (token, error, meta) tuples from the Gemini SSE stream."""
    contents = [
        {
            "role": "model" if _msg_role(m) == "assistant" else "user",
            "parts": [{"text": _msg_content(m)}],
        }
        for m in history
        if _msg_content(m)
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
    messages = _to_openai_messages(history)
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

async def _stream_openai_compat(provider: str, base_url: str, model: str, history: list, new_content: str, api_key: str):
    """Yields (token, error, meta) tuples from an OpenAI-compatible SSE stream."""
    messages = _to_openai_messages(history)
    messages.append({"role": "user", "content": new_content})

    url = base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {"model": model, "messages": messages, "stream": True}

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", url, json=body, headers=headers) as resp:
            meta = _parse_openrouter_ratelimits(resp.headers)
            if meta:
                yield None, None, meta

            if resp.status_code != 200:
                err_body = await resp.aread()
                if resp.status_code == 429:
                    yield None, "rate_limited", None
                elif resp.status_code == 402:
                    yield None, "quota_exceeded", None
                elif resp.status_code in (401, 403):
                    yield None, f"Invalid {provider} API key. Please check your key in the model picker.", None
                else:
                    try:
                        detail = json.loads(err_body).get("error", {}).get("message", err_body.decode()[:160])
                    except Exception:
                        detail = err_body.decode()[:160]
                    yield None, f"{provider} error: {detail}", None
                return

            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:].strip()
                if data == "[DONE]":
                    return
                try:
                    chunk = json.loads(data)
                    if "error" in chunk:
                        yield None, chunk.get("error", {}).get("message", "Unknown error"), None
                        return
                    text = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                    if text:
                        yield text, None, None
                except (KeyError, IndexError, json.JSONDecodeError):
                    pass


class CloudChatRequestWithKeys(CloudChatRequest):
    openrouter_key: str = ""
    gemini_key: str = ""
    groq_key: str = ""
    together_key: str = ""
    fireworks_key: str = ""
    huggingface_key: str = ""
    puter_key: str = ""
    router_key: str = ""
    router_base_url: str = ""


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

    raw_model = body.model
    is_gemini = raw_model.startswith("gemini-")
    use_auto  = raw_model in ("openrouter:auto", "auto")

    selected_provider: str | None = None
    selected_model_id: str | None = None
    if ":" in raw_model:
        prefix, rest = raw_model.split(":", 1)
        prefix = prefix.strip().lower()
        if prefix in _OPENAI_COMPAT_BASE_URLS or prefix == "router":
            selected_provider = prefix
            selected_model_id = rest.strip() or None

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

    db_history = (
        db.query(models.Message)
        .filter(models.Message.chat_id == body.chat_id)
        .order_by(models.Message.created_at.asc())
        .all()
    )

    # If the client provides a condensed context, use it for inference to reduce tokens.
    # This does NOT affect persistence: we still store the user + assistant messages normally.
    provided = body.context_messages or []
    context_history = _to_openai_messages(provided) if provided else [{"role": m.role, "content": m.content} for m in db_history]
    history = context_history

    async def generate():
        full_text = ""

        # Best available (openrouter:auto) â€” try every model shown in Cloud tab, by quality.
        if use_auto:
            openrouter_key = body.openrouter_key or os.environ.get("OPENROUTER_API_KEY", "")
            gemini_key = body.gemini_key or os.environ.get("GEMINI_API_KEY", "")
            groq_key = body.groq_key or os.environ.get("GROQ_API_KEY", "")
            together_key = body.together_key or os.environ.get("TOGETHER_API_KEY", "")
            fireworks_key = body.fireworks_key or os.environ.get("FIREWORKS_API_KEY", "")
            huggingface_key = body.huggingface_key or os.environ.get("HUGGINGFACE_API_KEY", "")
            puter_key = body.puter_key or os.environ.get("PUTER_AUTH_TOKEN", "")
            router_key = body.router_key or os.environ.get("ROUTER_API_KEY", "")
            router_base_url = (body.router_base_url or os.environ.get("ROUTER_BASE_URL", "")).strip()

            if not any([openrouter_key, gemini_key, groq_key, together_key, fireworks_key, huggingface_key, puter_key, router_key]):
                yield f"data: {json.dumps({'error': 'A cloud API key is required. Add a key in the model picker (OpenRouter, Gemini, Groq, Together, Fireworks, Hugging Face, or Puter).'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            # (provider, model_id, label, score, rank, base_url, api_key)
            candidates: list[tuple[str, str, str, int, int, str, str]] = []
            models_by_provider: dict[str, list[dict]] = {}
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
                if error_text in ("rate_limited", "quota_exceeded"):
                    return error_text
                if error_text == "unavailable":
                    return "unavailable"
                if error_text.lower().startswith("invalid "):
                    return "invalid_key"
                low = error_text.lower()
                if "rate limit" in low:
                    return "rate_limited"
                if "quota" in low and "exceed" in low:
                    return "quota_exceeded"
                if " error:" in low:
                    return "provider_error"
                return "other"

            provider_rank_base = {
                "openrouter": 0,
                "puter": 100_000,
                "huggingface": 200_000,
                "groq": 300_000,
                "fireworks": 400_000,
                "together": 500_000,
                "router": 600_000,
                "gemini": 900_000,
            }

            if openrouter_key:
                or_models = await _fetch_or_free_models_detailed(openrouter_key)
                models_by_provider["openrouter"] = or_models
                for idx, m in enumerate(or_models):
                    mid = m.get("id") or ""
                    label = _clean_or_name(m.get("name") or mid)
                    score = int(m.get("quality") or MODEL_QUALITY.get(mid, 0) or 0)
                    candidates.append(("openrouter", mid, label, score, provider_rank_base["openrouter"] + idx, "", openrouter_key))

            if gemini_key:
                models_by_provider["gemini"] = [{"id": mid, "name": label, "quality": int(AUTO_MODEL_QUALITY.get(mid, 0) or 0)} for mid, label in AUTO_GEMINI_MODELS]
                for idx, (mid, label) in enumerate(AUTO_GEMINI_MODELS):
                    candidates.append(("gemini", mid, label, int(AUTO_MODEL_QUALITY.get(mid, 0) or 0), provider_rank_base["gemini"] + idx, "", gemini_key))

            async def _add_compat(provider: str, api_key: str, base_url: str):
                if not api_key:
                    return
                models = await _fetch_openai_compat_models(provider, api_key, base_url)
                models_by_provider[provider] = models
                base = provider_rank_base.get(provider, 800_000)
                for idx, m in enumerate(models):
                    mid = m.get("id") or ""
                    label = str(m.get("name") or mid)
                    score = int(m.get("quality") or 0)
                    candidates.append((provider, mid, label, score, base + idx, base_url, api_key))

            await _add_compat("puter", puter_key, _OPENAI_COMPAT_BASE_URLS["puter"])
            await _add_compat("huggingface", huggingface_key, _OPENAI_COMPAT_BASE_URLS["huggingface"])
            await _add_compat("groq", groq_key, _OPENAI_COMPAT_BASE_URLS["groq"])
            await _add_compat("together", together_key, _OPENAI_COMPAT_BASE_URLS["together"])
            await _add_compat("fireworks", fireworks_key, _OPENAI_COMPAT_BASE_URLS["fireworks"])
            if router_key and router_base_url:
                await _add_compat("router", router_key, router_base_url)

            if not candidates:
                yield f"data: {json.dumps({'error': 'No cloud models are available to try right now.', 'suggest_local': True, 'reason': 'No cloud models available to try.'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            complexity = await _classify_request(
                history=history,
                new_content=body.content,
                candidates_by_provider=models_by_provider,
                keys={
                    "openrouter": openrouter_key,
                    "gemini": gemini_key,
                    "groq": groq_key,
                    "together": together_key,
                    "fireworks": fireworks_key,
                    "huggingface": huggingface_key,
                    "puter": puter_key,
                    "router": router_key,
                },
                router_base_url=router_base_url,
            )
            prefer_efficient = complexity == "simple"
            if prefer_efficient:
                yield _status("Choosing a token-friendly model...")
                candidates.sort(key=lambda c: (_efficiency_score(c[0], c[1]), -c[3], c[4]))
            else:
                candidates.sort(key=lambda c: (-c[3], c[4]))

            last_error: str | None = None
            attempted = 0

            for provider, model_id, model_label, _, _, base_url, api_key in candidates:
                attempted += 1
                yield _status(f"Trying {model_label}...")

                got_token = False
                error_text: str | None = None

                try:
                    if provider == "gemini":
                        async for token, error, _meta in _stream_gemini(model_id, history, body.content, api_key):
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
                    elif provider == "openrouter":
                        sent_usage = False
                        async for token, error, meta in _stream_openrouter(model_id, history, body.content, api_key):
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
                    else:
                        sent_usage = False
                        async for token, error, meta in _stream_openai_compat(provider, base_url, model_id, history, body.content, api_key):
                            if meta and not sent_usage:
                                sent_usage = True
                                yield f"data: {json.dumps({'type': 'usage', 'provider': provider, 'id': model_id, 'usage': meta})}\n\n"
                                ra = meta.get("retryAfter")
                                if isinstance(ra, int) and ra > 0:
                                    best_retry_after_s = ra if best_retry_after_s is None else min(best_retry_after_s, ra)
                            if error:
                                error_text = error
                                break
                            if token and not got_token:
                                yield f"data: {json.dumps({'type': 'model', 'provider': provider, 'id': model_id, 'label': model_label})}\n\n"
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
                elif provider == "gemini":
                    low = error_text.lower()
                    retryable = (
                        ("rate limit" in low)
                        or ("gemini error:" in low)
                        or ("invalid gemini api key" in low)
                        or (error_text == "unavailable")
                    )
                else:
                    retryable = (
                        error_text in ("rate_limited", "quota_exceeded", "unavailable")
                        or error_text.lower().startswith("invalid ")
                        or error_text.lower().startswith(f"{provider} error:")
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
        elif selected_provider and selected_model_id:
            provider = selected_provider
            model_id = selected_model_id
            if provider == "router":
                base_url = (body.router_base_url or "").strip()
                api_key = body.router_key or os.environ.get("ROUTER_API_KEY", "")
                if not base_url:
                    yield f"data: {json.dumps({'error': 'Router base URL required. Add it in the model picker.'})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
            else:
                base_url = _OPENAI_COMPAT_BASE_URLS.get(provider, "")
                api_key = getattr(body, f"{provider}_key") or os.environ.get(f"{provider.upper()}_API_KEY", "")

            if not api_key:
                yield f"data: {json.dumps({'error': f'{provider} API key required. Add your key in the model picker.'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            yield _status(f"Using {provider}...")
            try:
                got_token = False
                sent_usage = False
                async for token, error, meta in _stream_openai_compat(provider, base_url, model_id, history, body.content, api_key):
                    if meta and not sent_usage:
                        sent_usage = True
                        yield f"data: {json.dumps({'type': 'usage', 'provider': provider, 'id': model_id, 'usage': meta})}\n\n"
                    if error:
                        yield f"data: {json.dumps({'error': error})}\n\n"
                        yield "data: [DONE]\n\n"
                        return
                    if token and not got_token:
                        got_token = True
                        yield f"data: {json.dumps({'type': 'model', 'provider': provider, 'id': model_id, 'label': model_id})}\n\n"
                        yield _status("")
                    if token:
                        full_text += token
                        yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                yield "data: [DONE]\n\n"
                return

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
