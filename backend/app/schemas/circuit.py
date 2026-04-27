from pydantic import BaseModel, ConfigDict


class CircuitRead(BaseModel):
    id: int
    name: str
    slug: str
    country: str
    city: str | None
    timezone: str

    model_config = ConfigDict(from_attributes=True)
