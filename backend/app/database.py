import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

_raw_url = os.environ.get("DATABASE_URL", "sqlite:///./data/chat.db").strip()

_is_sqlite = "sqlite" in _raw_url

# Normalise PostgreSQL URLs:
# - Heroku/Neon may give "postgres://" — SQLAlchemy needs "postgresql://"
# - Use pg8000 (pure Python, no native libpq) for Vercel compatibility
# - Strip ?sslmode=require — pg8000 uses ssl_context connect_arg instead
if not _is_sqlite:
    _base = _raw_url.split("?")[0]  # remove query params (pg8000 handles SSL via connect_args)
    DATABASE_URL = _base.replace("postgres://", "postgresql+pg8000://", 1)
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)
else:
    DATABASE_URL = _raw_url

import ssl as _ssl

_connect_args: dict = {}
if _is_sqlite:
    _connect_args = {"check_same_thread": False}
else:
    # pg8000 requires an ssl.SSLContext for Neon (TLS mandatory)
    _ssl_ctx = _ssl.create_default_context()
    _connect_args = {"ssl_context": _ssl_ctx}

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    # NullPool for serverless PostgreSQL — avoids connection exhaustion.
    poolclass=None if _is_sqlite else NullPool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
