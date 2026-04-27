from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PaddockAR API"
    app_version: str = "0.1.0"
    database_url: str = "mysql+pymysql://paddockar:paddockar_pass@127.0.0.1:3307/paddockar"
    admin_username: str = "admin"
    admin_password: str = "admin"
    admin_token_secret: str = "paddockar-local-admin-secret"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
