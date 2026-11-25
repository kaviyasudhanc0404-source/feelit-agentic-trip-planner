from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    cors_origins: str = "http://localhost:8080"
    # Optional: also allow matching origins, e.g. Vercel preview deployments: https://feel-it-.*\.vercel\.app
    cors_origin_regex: str | None = None

    mongodb_uri: str
    mongodb_db: str = "feelit"

    jwt_secret: str
    jwt_expires_days: int = 7
    firebase_project_id: str  # Google sign-in tokens must be issued for this Firebase project

    groq_api_key: str
    gemini_api_key: str
    geoapify_api_key: str
    tavily_api_key: str
    unsplash_access_key: str

    ai_rate_limit_per_hour: int = 30

    # Trip reminder emails (Brevo). Without a key, reminders are simply switched off.
    brevo_api_key: str | None = None
    brevo_sender_email: str | None = None
    brevo_sender_name: str = "Feel It"
    cron_secret: str | None = None  # lets an outside scheduler trigger the reminder run
    app_url: str | None = None  # the website address used in email links; defaults to the first CORS origin

    @property
    def production(self) -> bool:
        return self.environment == "production"

    @model_validator(mode="after")
    def _safe_for_production(self):
        """Refuse to start in production with settings that would be insecure or broken."""
        if self.production:
            if len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must be at least 32 random characters in production.")
            if not self.cors_origin_list or any(not o.startswith("https://") for o in self.cors_origin_list):
                raise ValueError("CORS_ORIGINS must list your https:// frontend address(es) in production, e.g. https://feel-it.vercel.app")
        return self

    @property
    def site_url(self) -> str:
        return (self.app_url or self.cors_origin_list[0]).rstrip("/")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
