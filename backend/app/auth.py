"""Auth.js JWT verification.

Auth.js signs a custom HS256 JWT (backendToken) with AUTH_SECRET.
We verify it here and return the user's sub (user_id).
"""

import os
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer(auto_error=False)
_AUTH_SECRET = os.environ.get("AUTH_SECRET", "")


def get_user_id(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> str:
    """FastAPI dependency — verifies Auth.js HS256 token, returns user_id."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not _AUTH_SECRET:
        raise HTTPException(status_code=500, detail="AUTH_SECRET not configured")
    try:
        payload = jwt.decode(
            credentials.credentials,
            _AUTH_SECRET,
            algorithms=["HS256"],
        )
        return payload["sub"]
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc
