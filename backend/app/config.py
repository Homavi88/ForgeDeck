from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    app_name: str = "PulseForge"
    app_env: str = "development"
    secret_key: str = "change-me-to-a-long-random-string"
    debug: bool = True
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    database_url: str = "sqlite:///./pulseforge.db"
    redis_url: str = "redis://localhost:6379/0"
    use_celery: bool = False

    storage_dir: str = "../storage/audio"
    max_upload_mb: int = 80
    enable_librosa: bool = True

    ai_provider: str = "mock"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    local_llm_url: str = ""
    ai_model: str = "mock-producer-v1"

    demo_user_email: str = "producer@pulseforge.local"
    demo_user_name: str = "Demo Producer"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def storage_path(self) -> Path:
        path = Path(self.storage_dir)
        if not path.is_absolute():
            # Resolve relative to backend/ working directory.
            path = (Path.cwd() / path).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
