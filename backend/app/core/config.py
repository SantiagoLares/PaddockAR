from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PaddockAR API"
    app_version: str = "0.1.0"
    database_url: str = "postgresql+psycopg2://paddockar:paddockar_pass@127.0.0.1:5433/paddockar"
    port: int = 8000
    admin_username: str = "admin"
    admin_password: str = "admin"
    admin_token_secret: str = "paddockar-local-admin-secret"

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg2://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg2://", 1)
        return value

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
