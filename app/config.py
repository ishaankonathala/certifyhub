"""Application configuration."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    app_name: str = "CertifyHub"
    app_version: str = "1.0.0"
    debug: bool = True

    database_url: str = f"sqlite:///{BASE_DIR / 'certifyhub.db'}"

    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"
    celery_task_always_eager: bool = False

    storage_dir: Path = BASE_DIR / "storage"
    certificates_dir: Path = BASE_DIR / "storage" / "certificates"

    api_prefix: str = "/api/v1"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    settings = Settings()
    settings.certificates_dir.mkdir(parents=True, exist_ok=True)
    return settings
