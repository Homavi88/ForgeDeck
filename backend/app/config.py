from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    app_name: str = "ForgeDeck"
    app_env: str = "development"
    secret_key: str = "change-me-to-a-long-random-string"
    debug: bool = True
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    desktop_ui_dir: str = ""

    database_url: str = "sqlite:///./forgedeck.db"
    redis_url: str = "redis://localhost:6379/0"
    use_celery: bool = False

    storage_dir: str = "../storage/audio"
    max_upload_mb: int = 250
    quota_mb: int = 2048
    enable_librosa: bool = True
    stems_device: str = "auto"

    ai_provider: str = "mock"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    local_llm_url: str = ""
    ai_model: str = "mock-producer-v1"

    demo_user_email: str = "producer@forgedeck.local"
    demo_user_name: str = "Demo Producer"
    demo_user_password: str = "demo"
    require_auth: bool = False
    jwt_expire_hours: int = 168

    aws_s3_bucket: str = ""
    aws_s3_region: str = "us-east-1"
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    s3_prefix: str = "forgedeck"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def desktop_ui_path(self) -> Path | None:
        if not self.desktop_ui_dir:
            return None
        path = Path(self.desktop_ui_dir).expanduser().resolve()
        return path if (path / "index.html").is_file() else None

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

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"production", "prod"}

    @property
    def auth_required(self) -> bool:
        return True if self.is_production else self.require_auth

    @property
    def jwt_ttl_hours(self) -> int:
        if self.is_production:
            return min(max(1, self.jwt_expire_hours), 24)
        return max(1, self.jwt_expire_hours)


@lru_cache
def get_settings() -> Settings:
    return Settings()
