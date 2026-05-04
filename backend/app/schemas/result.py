from pydantic import BaseModel, ConfigDict, field_validator


class ResultRead(BaseModel):
    id: int
    session_id: int
    position: int
    driver_name: str
    team_name: str
    time_or_gap: str | None
    points: int | None

    model_config = ConfigDict(from_attributes=True)


class ResultWrite(BaseModel):
    session_id: int
    position: int
    driver_name: str
    team_name: str
    time_or_gap: str | None = None
    points: int | None = None

    @field_validator("position")
    @classmethod
    def validate_position(cls, value: int):
        if value < 1:
            raise ValueError("position must be greater than or equal to 1")
        return value


class ResultCreate(ResultWrite):
    pass


class ResultUpdate(BaseModel):
    session_id: int | None = None
    position: int | None = None
    driver_name: str | None = None
    team_name: str | None = None
    time_or_gap: str | None = None
    points: int | None = None

    @field_validator("position")
    @classmethod
    def validate_position(cls, value: int | None):
        if value is not None and value < 1:
            raise ValueError("position must be greater than or equal to 1")
        return value
