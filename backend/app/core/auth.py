import base64
import hashlib
import hmac
import time

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

TOKEN_TTL_SECONDS = 60 * 60 * 12
bearer_scheme = HTTPBearer(auto_error=False)


def _signature(payload: str) -> str:
    return hmac.new(
        settings.admin_token_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_admin_token(username: str) -> str:
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS
    payload = f"{username}:{expires_at}"
    encoded_payload = base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")
    return f"{encoded_payload}.{_signature(encoded_payload)}"


def verify_admin_token(token: str) -> bool:
    try:
        encoded_payload, token_signature = token.split(".", 1)
        expected_signature = _signature(encoded_payload)

        if not hmac.compare_digest(token_signature, expected_signature):
            return False

        payload = base64.urlsafe_b64decode(encoded_payload.encode("utf-8")).decode("utf-8")
        username, expires_at = payload.rsplit(":", 1)

        return username == settings.admin_username and int(expires_at) >= int(time.time())
    except (ValueError, TypeError):
        return False


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing admin token",
        )

    if not verify_admin_token(credentials.credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin token",
        )
