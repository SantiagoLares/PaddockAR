from datetime import date
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.category import CategoryRead
from app.schemas.circuit import CircuitRead


class EventRead(BaseModel):
    id: int
    category_id: int
    circuit_id: int
    season_year: int
    round_number: int | None
    name: str
    slug: str
    start_date: date
    end_date: date
    status: str
    category: CategoryRead
    circuit: CircuitRead

    model_config = ConfigDict(from_attributes=True)


class EventSessionRead(BaseModel):
    id: int
    event_id: int
    name: str
    session_type: str
    starts_at: datetime
    ends_at: datetime | None
    status: str
    order_index: int
    is_feature: bool

    model_config = ConfigDict(from_attributes=True)


class EventDetailRead(EventRead):
    sessions: list[EventSessionRead]
