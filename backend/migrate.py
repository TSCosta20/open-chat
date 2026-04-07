"""One-off migration: add user_id column to chats table.

Run with:
    DATABASE_URL=postgresql://... python migrate.py
"""

import os
import ssl
import sqlalchemy as sa
from sqlalchemy import text

_raw_url = os.environ.get("DATABASE_URL", "").strip()
if not _raw_url:
    raise SystemExit("Set DATABASE_URL before running this script")

# Normalize URL for pg8000
DATABASE_URL = _raw_url.replace("postgresql://", "postgresql+pg8000://", 1).replace(
    "postgres://", "postgresql+pg8000://", 1
)
# Strip sslmode query param (pg8000 uses ssl_context arg instead)
if "sslmode" in DATABASE_URL:
    import re
    DATABASE_URL = re.sub(r"[?&]sslmode=[^&]*", "", DATABASE_URL).rstrip("?&")

_ssl_ctx = ssl.create_default_context()
engine = sa.create_engine(DATABASE_URL, connect_args={"ssl_context": _ssl_ctx})

with engine.connect() as conn:
    # 1. Add user_id column to chats if missing
    result = conn.execute(
        text("SELECT column_name FROM information_schema.columns "
             "WHERE table_name='chats' AND column_name='user_id'")
    )
    if result.fetchone() is None:
        print("Adding user_id column to chats...")
        conn.execute(text("ALTER TABLE chats ADD COLUMN user_id VARCHAR NOT NULL DEFAULT ''"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_chats_user_id ON chats (user_id)"))
        conn.commit()
        print("Done.")
    else:
        print("chats.user_id already exists.")

    # 2. Create users table if missing
    result = conn.execute(
        text("SELECT to_regclass('public.users')")
    )
    if result.fetchone()[0] is None:
        print("Creating users table...")
        conn.execute(text("""
            CREATE TABLE users (
                id VARCHAR PRIMARY KEY,
                email VARCHAR NOT NULL UNIQUE,
                password_hash VARCHAR NOT NULL,
                name VARCHAR,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        conn.execute(text("CREATE INDEX ix_users_id ON users (id)"))
        conn.execute(text("CREATE INDEX ix_users_email ON users (email)"))
        conn.commit()
        print("Done.")
    else:
        print("users table already exists.")
