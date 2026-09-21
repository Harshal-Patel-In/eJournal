"""Application configuration loaded from environment variables.

RULE-CFG01: Configuration separate from source code.
RULE-CFG03: Validated at startup.
RULE-BE08: Connection config from env-based settings.
"""

from pydantic_settings import BaseSettings
from pydantic import Field, model_validator, field_validator
from typing import Any
import json


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Environment
    ENVIRONMENT: str = Field(default="development", description="Runtime environment")

    # Backend
    BACKEND_HOST: str = Field(default="0.0.0.0")
    BACKEND_PORT: int = Field(default=8000)
    BACKEND_CORS_ORIGINS: list[str] = Field(
        default=["http://localhost:3000"],
        description="Allowed CORS origins",
    )

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(item).strip().rstrip("/") for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [origin.strip().rstrip("/") for origin in v.split(",") if origin.strip()]
        elif isinstance(v, (list, set, tuple)):
            return [str(origin).strip().rstrip("/") for origin in v if str(origin).strip()]
        return v

    # MongoDB Atlas (RULE-BE08)
    MONGODB_URI: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URI (Atlas or local)",
    )
    MONGODB_DATABASE: str = Field(
        default="ejournal",
        description="MongoDB database name",
    )
    MONGODB_MIN_POOL_SIZE: int = Field(default=5)
    MONGODB_MAX_POOL_SIZE: int = Field(default=50)

    # Redis
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL",
    )

    # JWT / Authentication
    JWT_SECRET_KEY: str = Field(
        default="change-this-to-a-secure-random-string",
        description="JWT signing secret",
    )
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # Email Service (SMTP, Brevo, Resend)
    SMTP_HOST: str = Field(default="smtp.gmail.com", description="SMTP server host")
    SMTP_PORT: int = Field(default=587, description="SMTP server port")
    SMTP_USER: str | None = Field(default=None, description="SMTP username / email")
    SMTP_EMAIL: str | None = Field(default=None, description="SMTP username / email alias")
    SMTP_PASSWORD: str | None = Field(default=None, description="SMTP password")
    SMTP_APP_PASSWORD: str | None = Field(default=None, description="SMTP app password alias")
    SMTP_FROM_NAME: str = Field(default="eJournal", description="Sender display name")
    SMTP_FROM_EMAIL: str = Field(default="noreply@ejournal.com", description="Sender email address")
    BREVO_API_KEY: str | None = Field(default=None, description="Brevo transaction API key")
    RESEND_API_KEY: str | None = Field(default=None, description="Resend transaction API key")

    @property
    def effective_smtp_user(self) -> str | None:
        return self.SMTP_USER or self.SMTP_EMAIL

    @property
    def effective_smtp_password(self) -> str | None:
        return self.SMTP_PASSWORD or self.SMTP_APP_PASSWORD

    @property
    def effective_smtp_from_email(self) -> str:
        if self.SMTP_FROM_EMAIL and self.SMTP_FROM_EMAIL != "noreply@ejournal.com":
            return self.SMTP_FROM_EMAIL
        return self.effective_smtp_user or self.SMTP_FROM_EMAIL

    # Logging
    LOG_LEVEL: str = Field(default="INFO")

    # Cloudinary Integration
    CLOUDINARY_CLOUD_NAME: str | None = Field(default=None, description="Cloudinary cloud name")
    CLOUDINARY_API_KEY: str | None = Field(default=None, description="Cloudinary API key")
    CLOUDINARY_API_SECRET: str | None = Field(default=None, description="Cloudinary API secret")


    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def cookie_secure(self) -> bool:
        """Enforce Secure flag on cookies in production over HTTPS (SEC-06)."""
        return self.is_production


    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """Enforce production cryptographic secret integrity (SEC-04)."""
        if self.is_production:
            if (
                self.JWT_SECRET_KEY == "change-this-to-a-secure-random-string"
                or len(self.JWT_SECRET_KEY) < 32
            ):
                raise ValueError(
                    "JWT_SECRET_KEY must be configured with a secure, random secret of at least 32 characters in production environments."
                )
        return self

    model_config = {
        "env_file": [".env", "../.env"],
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }



settings = Settings()
