import sys
import os

# Ensure the backend root is on the path so `app.*` imports resolve
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app  # noqa: F401 — Vercel picks up the ASGI `app` object

__all__ = ["app"]
