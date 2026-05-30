from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryRead
from app.schemas.circuit import CircuitRead
from app.schemas.event import EventRead
from app.schemas.session import SessionRead


class CategoryAdminRead(CategoryRead):
    pass


class CategoryVisibilityUpdate(BaseModel):
    is_public: bool
    is_active: bool


class CircuitAdminRead(CircuitRead):
    pass


class CircuitAdminCreate(BaseModel):
    name: str
    city: str | None = None
    country: str
    timezone: str = "America/Argentina/Buenos_Aires"


class WeekendCircuitInput(BaseModel):
    name: str
    city: str | None = None
    country: str
    timezone: str = "America/Argentina/Buenos_Aires"


class WeekendEventInput(BaseModel):
    name: str
    slug: str | None = None
    start_date: date
    end_date: date
    season_year: int | None = None
    round_number: int | None = Field(default=None, alias="round")
    source_url: str | None = None
    data_quality: str | None = None
    source_note: str | None = None
    status: str = "scheduled"

    model_config = ConfigDict(populate_by_name=True)


class WeekendSessionInput(BaseModel):
    name: str
    session_type: str
    date: date
    time_arg: str
    duration_minutes: int = 60
    status: str = "scheduled"
    source_url: str | None = None
    data_quality: str | None = None
    source_note: str | None = None
    is_feature: bool = False
    order_index: int | None = None


class WeekendUpsertRequest(BaseModel):
    category_id: int | None = None
    category_slug: str | None = None
    event: WeekendEventInput
    circuit: WeekendCircuitInput
    sessions: list[WeekendSessionInput]


class WeekendUpsertResponse(BaseModel):
    event_created: bool
    event_updated: bool
    event: EventRead
    sessions_created: int
    sessions_updated: int
    skipped: int
    errors: list[str]


class CalendarAuditBucketItem(BaseModel):
    id: int
    name: str
    slug: str | None = None
    status: str | None = None
    reason: str | None = None
    category: str | None = None
    event_id: int | None = None


class CalendarAuditResponse(BaseModel):
    official_events: list[CalendarAuditBucketItem]
    events_without_source: list[CalendarAuditBucketItem]
    sessions_without_schedule: list[CalendarAuditBucketItem]
    sessions_without_source: list[CalendarAuditBucketItem]
    public_categories: list[CategoryAdminRead]
    hidden_categories: list[CategoryAdminRead]


class CalendarCleanupResponse(BaseModel):
    categories_hidden: int
    events_hidden: int
    sessions_hidden: int
    hidden_category_slugs: list[str]


class AdminDashboardResponse(BaseModel):
    categories: list[CategoryAdminRead]
    circuits: list[CircuitAdminRead]
    events: list[EventRead]
    sessions: list[SessionRead]
