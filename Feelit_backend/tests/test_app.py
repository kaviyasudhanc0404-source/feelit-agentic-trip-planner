"""App-level production behaviour: config checks, error responses, rate-limit IP."""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.requests import Request

from app.config import Settings, settings
from app.main import app
from app.security import client_ip

REQUIRED = {k: "x" for k in ("mongodb_uri", "firebase_project_id", "groq_api_key", "gemini_api_key", "geoapify_api_key", "tavily_api_key", "unsplash_access_key")}


def production(**overrides) -> Settings:
    values = {**REQUIRED, "environment": "production", "jwt_secret": "s" * 40, "cors_origins": "https://feel-it.vercel.app", **overrides}
    return Settings(_env_file=None, **values)


def test_production_refuses_weak_secrets_and_non_https_origins():
    assert production().production
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        production(jwt_secret="short")
    with pytest.raises(ValidationError, match="CORS_ORIGINS"):
        production(cors_origins="http://localhost:8080")


def test_an_unexpected_crash_returns_json_with_cors_headers():
    async def boom():
        raise RuntimeError("bug")

    app.add_api_route("/__boom", boom)
    origin = settings.cors_origin_list[0]
    response = TestClient(app, raise_server_exceptions=False).get("/__boom", headers={"Origin": origin})
    assert response.status_code == 500
    assert response.json() == {"detail": "Something went wrong on our side. Please try again."}
    assert response.headers["access-control-allow-origin"] == origin


def test_validation_errors_never_echo_the_input():
    response = TestClient(app).post("/api/auth/login", json={"email": "not-an-email", "password": "secret-value"})
    assert response.status_code == 422
    assert "secret-value" not in response.text and "input" not in response.json()["detail"][0]


def test_rate_limits_use_the_address_the_proxy_added():
    scope = {"type": "http", "headers": [(b"x-forwarded-for", b"6.6.6.6, 203.0.113.9")], "client": ("10.0.0.1", 1)}
    assert client_ip(Request(scope)) == "203.0.113.9"


def test_the_reminder_job_endpoint_is_hidden_without_the_secret():
    client = TestClient(app)
    assert client.post("/api/internal/reminders").status_code == 404
    assert client.post("/api/internal/reminders", headers={"X-Cron-Secret": "wrong"}).status_code == 404
