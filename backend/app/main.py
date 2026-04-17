import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.database import engine, Base
from app.routers import chats, messages, auth_routes, gemini


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.database import _is_sqlite
    if _is_sqlite:
        # SQLite local dev: ensure data dir and create tables
        os.makedirs("data", exist_ok=True)
        Base.metadata.create_all(bind=engine)
    else:
        # PostgreSQL (Neon): tables are created via migration.
        # Run `python -c "from app.database import engine, Base; Base.metadata.create_all(bind=engine)"` once.
        pass
    yield


app = FastAPI(title="open_chat API", version="1.0.0", lifespan=lifespan)

def _parse_cors_origins(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]


origins = _parse_cors_origins(os.environ.get("CORS_ORIGINS", "http://localhost:3000"))

# Optional regex-based CORS allowlist (useful for preview deployments).
# Example: ^https://frontend-.*\\.vercel\\.app$
origin_regex = os.environ.get("CORS_ORIGIN_REGEX")

if origin_regex is None and os.environ.get("CORS_ALLOW_VERCEL_PREVIEWS", "true").lower() in {
    "1",
    "true",
    "yes",
    "on",
}:
    origin_regex = r"^https://frontend-.*\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Chat-Title"],
)

app.include_router(auth_routes.router)
app.include_router(chats.router)
app.include_router(messages.router)
app.include_router(gemini.router)

if os.environ.get("DEBUG_FINGERPRINT_KEY"):
    from app.routers import debug

    app.include_router(debug.router)


@app.get("/health")
def health():
    return {"status": "ok"}
