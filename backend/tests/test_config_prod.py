from app.config import Settings


def test_production_forces_auth_and_caps_jwt(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("REQUIRE_AUTH", "false")
    monkeypatch.setenv("JWT_EXPIRE_HOURS", "168")
    s = Settings()
    assert s.is_production is True
    assert s.auth_required is True
    assert s.jwt_ttl_hours == 24


def test_development_keeps_demo_auth(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("REQUIRE_AUTH", "false")
    monkeypatch.setenv("JWT_EXPIRE_HOURS", "168")
    s = Settings()
    assert s.auth_required is False
    assert s.jwt_ttl_hours == 168
