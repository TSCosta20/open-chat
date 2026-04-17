import hashlib
import hmac
import os

from fastapi import APIRouter, Header, HTTPException


router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/auth-secret-fingerprint")
def auth_secret_fingerprint(x_debug_key: str | None = Header(default=None)):
    """
    Returns a non-sensitive fingerprint of AUTH_SECRET to help verify the
    frontend and backend share the exact same secret.

    Gate: requires header `X-Debug-Key` to match env `DEBUG_FINGERPRINT_KEY`.
    """
    debug_key = os.environ.get("DEBUG_FINGERPRINT_KEY")
    if not debug_key:
        raise HTTPException(status_code=404, detail="Not Found")
    if not x_debug_key or not hmac.compare_digest(x_debug_key, debug_key):
        raise HTTPException(status_code=404, detail="Not Found")

    secret = os.environ.get("AUTH_SECRET", "")
    digest = hashlib.sha256(secret.encode("utf-8")).hexdigest()
    return {"configured": bool(secret), "length": len(secret), "sha256": digest}

