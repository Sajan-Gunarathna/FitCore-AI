"""Application configuration loaded from environment variables."""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=[
            str(BASE_DIR / ".env"),
            str(BASE_DIR.parent / ".env"),
            ".env",
        ],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    app_env: str = "development"
    app_debug: bool = False
    app_secret_key: str = "CHANGE_ME_IN_PRODUCTION_USE_32_CHARS"

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://postgres:password@localhost:5432/postgres"
    )

    # ── Supabase ──────────────────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_jwt_issuer: str = ""
    supabase_jwt_audience: str = "authenticated"
    jwks_cache_ttl_seconds: int = 3600

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: list[str] | str = [
        "http://localhost:3000",
        "http://localhost:3008",
        "http://localhost:3010",
        "http://localhost:3100",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3008",
        "http://127.0.0.1:3010",
        "http://127.0.0.1:3100",
        "http://localhost:19006",
    ]

    @field_validator("cors_origins")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean.startswith("[") and v_clean.endswith("]"):
                try:
                    parsed = json.loads(v_clean)
                    if isinstance(parsed, list):
                        return [str(i) for i in parsed]
                except Exception:
                    pass
            return [i.strip() for i in v_clean.split(",") if i.strip()]
        elif isinstance(v, list):
            return [str(i) for i in v]
        return []

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def jwks_url(self) -> str | None:
        if self.supabase_url:
            return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
