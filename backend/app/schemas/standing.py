from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.category import CategoryRead

VALID_STANDING_TYPES = {"drivers", "constructors", "general"}


class StandingRead(BaseModel):
    id: int
    category_id: int
    standing_type: str
    position: int
    name: str
    team_name: str | None
    points: int
    wins: int

    model_config = ConfigDict(from_attributes=True)


class StandingDetailRead(StandingRead):
    category: CategoryRead


class StandingWrite(BaseModel):
    category_id: int
    standing_type: str
    position: int
    name: str
    team_name: str | None = None
    points: int = 0
    wins: int = 0

    @field_validator("standing_type")
    @classmethod
    def validate_standing_type(cls, value: str):
        normalized = value.strip().lower()
        if normalized not in VALID_STANDING_TYPES:
            raise ValueError("standing_type must be drivers, constructors or general")
        return normalized

    @field_validator("position")
    @classmethod
    def validate_position(cls, value: int):
        if value < 1:
            raise ValueError("position must be greater than or equal to 1")
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str):
        normalized = value.strip()
        if not normalized:
            raise ValueError("name is required")
        return normalized

    @field_validator("team_name")
    @classmethod
    def normalize_team_name(cls, value: str | None):
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("points", "wins")
    @classmethod
    def validate_non_negative(cls, value: int):
        if value < 0:
            raise ValueError("points and wins must be greater than or equal to 0")
        return value


class StandingCreate(StandingWrite):
    pass


class StandingUpdate(BaseModel):
    category_id: int | None = None
    standing_type: str | None = None
    position: int | None = None
    name: str | None = None
    team_name: str | None = None
    points: int | None = None
    wins: int | None = None

    @field_validator("standing_type")
    @classmethod
    def validate_standing_type(cls, value: str | None):
        if value is None:
            return value
        normalized = value.strip().lower()
        if normalized not in VALID_STANDING_TYPES:
            raise ValueError("standing_type must be drivers, constructors or general")
        return normalized

    @field_validator("position")
    @classmethod
    def validate_position(cls, value: int | None):
        if value is not None and value < 1:
            raise ValueError("position must be greater than or equal to 1")
        return value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None):
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("name is required")
        return normalized

    @field_validator("team_name")
    @classmethod
    def normalize_team_name(cls, value: str | None):
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("points", "wins")
    @classmethod
    def validate_non_negative(cls, value: int | None):
        if value is not None and value < 0:
            raise ValueError("points and wins must be greater than or equal to 0")
        return value
