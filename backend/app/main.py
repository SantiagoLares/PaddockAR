from contextlib import asynccontextmanager
import logging
import time

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.routes import admin_events, admin_results, admin_sessions, admin_standings, auth, categories, circuits, events, results, sessions, standings
from app.core.config import settings
from app.core.database import create_tables, ping_database
from app.core.logging import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000
        logger.info(
            "%s %s -> %s %.2fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    create_tables()
    yield
    logger.info("Stopping %s", settings.app_name)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://paddockar.com.ar",
        "https://www.paddockar.com.ar",
        "https://paddockar-1.onrender.com",
        "https://paddockar.onrender.com",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8080",
        "http://localhost:8080",
    ],
    allow_origin_regex=r"^https?://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)

app.include_router(categories.router)
app.include_router(circuits.router)
app.include_router(events.router)
app.include_router(results.router)
app.include_router(sessions.router)
app.include_router(standings.router)
app.include_router(admin_events.router)
app.include_router(admin_results.router)
app.include_router(admin_sessions.router)
app.include_router(admin_standings.router)
app.include_router(auth.router)


@app.get("/api/health")
def health_check():
    database_ok = ping_database()

    if not database_ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "degraded",
                "database": "unavailable",
            },
        )

    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "database": "ok",
    }
