import hmac
import logging

from fastapi import APIRouter, HTTPException, status

from app.core.auth import create_admin_token
from app.core.config import settings
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    valid_username = hmac.compare_digest(payload.username, settings.admin_username)
    valid_password = hmac.compare_digest(payload.password, settings.admin_password)

    if not valid_username or not valid_password:
        logger.warning("Admin login failed for username=%s", payload.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    logger.info("Admin login succeeded for username=%s", payload.username)
    return LoginResponse(access_token=create_admin_token(payload.username))
