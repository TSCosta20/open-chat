"""Clerk JWT verification.

Verifies Bearer tokens issued by Clerk and returns the user's sub (user_id).
JWKS are cached in memory for the lifetime of the process.
"""

import os
import httpx
import jwt
from functools import lru_cache
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    clerk_domain = os.environ.get("CLERK_JWT_ISSUER", "").rstrip("/")
    if not clerk_domain:
        # Fall back to extracting from CLERK_SECRET_KEY prefix if available
        # or use publishable key domain hint
        clerk_domain = os.environ.get("CLERK_DOMAIN", "")
    jwks_url = f"{clerk_domain}/.well-known/jwks.json"
    resp = httpx.get(jwks_url, timeout=10)
    resp.raise_for_status()
    return resp.json()


def _decode_token(token: str) -> dict:
    jwks = _get_jwks()
    public_keys = jwt.PyJWKSet.from_dict(jwks)
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    key = next((k for k in public_keys.keys if k.key_id == kid), None)
    if key is None:
        raise ValueError("No matching key found in JWKS")
    return jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        options={"verify_aud": False},
    )


def get_user_id(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> str:
    """FastAPI dependency — returns Clerk user_id or raises 401."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = _decode_token(credentials.credentials)
        user_id: str = payload["sub"]
        return user_id
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
