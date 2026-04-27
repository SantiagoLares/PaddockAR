from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin_sessions, auth, categories, events, sessions
from app.core.config import settings
from app.core.database import create_tables, ping_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(events.router)
app.include_router(sessions.router)
app.include_router(admin_sessions.router)
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
