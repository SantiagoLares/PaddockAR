from datetime import date
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.schemas.category import CategoryRead
from app.schemas.circuit import CircuitRead
from app.schemas.result import ResultRead


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
    source_url: str | None = None
    data_quality: str | None = None
    source_note: str | None = None
    is_public: bool = True
    is_active: bool = True
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
    source_url: str | None = None
    data_quality: str | None = None
    source_note: str | None = None
    is_public: bool = True
    is_active: bool = True
    results: list[ResultRead] = []

    model_config = ConfigDict(from_attributes=True)


class EventDetailRead(EventRead):
    sessions: list[EventSessionRead]


class EventWrite(BaseModel):
    name: str
    category_id: int
    circuit_id: int
    season_year: int
    round_number: int | None = None
    start_date: date
    end_date: date
    status: str
    source_url: str | None = None
    data_quality: str | None = None
    source_note: str | None = None
    is_public: bool = True
    is_active: bool = True

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self


class EventCreate(EventWrite):
    pass


class EventUpdate(BaseModel):
    name: str | None = None
    category_id: int | None = None
    circuit_id: int | None = None
    season_year: int | None = None
    round_number: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None
    source_url: str | None = None
    data_quality: str | None = None
    source_note: str | None = None
    is_public: bool | None = None
    is_active: bool | None = None
