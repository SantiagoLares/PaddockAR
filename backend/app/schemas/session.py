from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.event import EventRead
from app.schemas.result import ResultRead


class SessionRead(BaseModel):
    id: int
    event_id: int
    name: str
    session_type: str
    starts_at: datetime
    ends_at: datetime | None
    status: str
    order_index: int
    is_feature: bool
    event: EventRead
    results: list[ResultRead] = []

    model_config = ConfigDict(from_attributes=True)


class SessionUpdate(BaseModel):
    name: str | None = None
    session_type: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    status: str | None = None
