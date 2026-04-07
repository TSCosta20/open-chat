import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.database import engine, Base
from app.routers import chats, messages, auth_routes  # noqa: F401


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

origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Chat-Title"],
)

app.include_router(auth_routes.router)
app.include_router(chats.router)
app.include_router(messages.router)


@app.get("/health")
def health():
    return {"status": "ok"}


