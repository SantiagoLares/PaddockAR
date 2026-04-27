from pydantic import BaseModel, ConfigDict


class CategoryRead(BaseModel):
    id: int
    name: str
    slug: str
    short_name: str
    color: str | None

    model_config = ConfigDict(from_attributes=True)
