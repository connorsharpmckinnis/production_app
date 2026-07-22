"""Phase 10: production access, secrets, upload caps, rate limits, reports RBAC."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.auth.rate_limit import MAX_ATTEMPTS, clear_login_rate_limits
from app.config import Settings
from app.db.seed import seed_database
from app.models import Production, User
from app.services.importer import import_script

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database(db_session, test_settings)
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _imported_production(client: TestClient, db_session: Session) -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "Phase 10 Show", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    import_script(db_session, production, FIXTURE_PATH.read_text(encoding="utf-8"))
    return production_id


def test_uncast_actor_cannot_get_production_by_id(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    actor_headers = _login(seeded_client, "actor", "actor")

    response = seeded_client.get(f"/api/productions/{production_id}", headers=actor_headers)
    assert response.status_code == 404


def test_cast_actor_can_get_production(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    characters = seeded_client.get(
        f"/api/productions/{production_id}/characters",
        headers=director_headers,
    ).json()
    crean_id = next(c["id"] for c in characters if c["name"] == "CREAN")
    actor = db_session.query(User).filter(User.username == "actor").one()
    cast = seeded_client.put(
        f"/api/productions/{production_id}/characters/{crean_id}/cast",
        json={"user_id": actor.id},
        headers=director_headers,
    )
    assert cast.status_code == 200

    actor_headers = _login(seeded_client, "actor", "actor")
    response = seeded_client.get(f"/api/productions/{production_id}", headers=actor_headers)
    assert response.status_code == 200
    assert response.json()["id"] == production_id


def test_actor_cannot_read_reports(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    characters = seeded_client.get(
        f"/api/productions/{production_id}/characters",
        headers=director_headers,
    ).json()
    crean_id = next(c["id"] for c in characters if c["name"] == "CREAN")
    actor = db_session.query(User).filter(User.username == "actor").one()
    seeded_client.put(
        f"/api/productions/{production_id}/characters/{crean_id}/cast",
        json={"user_id": actor.id},
        headers=director_headers,
    )

    actor_headers = _login(seeded_client, "actor", "actor")
    response = seeded_client.get(
        f"/api/productions/{production_id}/reports/prop-sheet",
        headers=actor_headers,
    )
    assert response.status_code == 403


def test_uncast_actor_cannot_list_moment_satellites(
    seeded_client: TestClient, db_session: Session
) -> None:
    """Auth alone must not grant moment attachment reads (IDOR)."""
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    acts = seeded_client.get(f"/api/productions/{production_id}/acts", headers=director_headers).json()
    scene_id = acts[0]["scenes"][0]["id"]
    moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    moment_id = moments[0]["id"]
    actor_headers = _login(seeded_client, "actor", "actor")

    for path in (
        f"/api/productions/{production_id}/moments/{moment_id}/entrances",
        f"/api/productions/{production_id}/moments/{moment_id}/exits",
        f"/api/productions/{production_id}/moments/{moment_id}/blocking",
        f"/api/productions/{production_id}/moments/{moment_id}/cues",
        f"/api/productions/{production_id}/moments/{moment_id}/props",
        f"/api/productions/{production_id}/moments/{moment_id}/microphones",
        f"/api/productions/{production_id}/moments/{moment_id}/set-pieces",
    ):
        response = seeded_client.get(path, headers=actor_headers)
        assert response.status_code == 404, path


def test_prod_settings_reject_default_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="sqlite://",
            SECRET_KEY="dev-secret-change-in-production-32chars",
            ADMIN_PASSWORD="a-strong-password",
            ENVIRONMENT="prod",
        )


def test_prod_settings_reject_weak_admin_password() -> None:
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="sqlite://",
            SECRET_KEY="a" * 32,
            ADMIN_PASSWORD="admin",
            ENVIRONMENT="prod",
        )


def test_prod_settings_accept_strong_secrets() -> None:
    settings = Settings(
        DATABASE_URL="sqlite://",
        SECRET_KEY="a" * 32,
        ADMIN_PASSWORD="a-strong-password",
        ENVIRONMENT="prod",
        CORS_ORIGINS="https://example.ts.net",
    )
    assert settings.cors_origin_list() == ["https://example.ts.net"]


def test_create_user_rejects_short_password(
    seeded_client: TestClient, db_session: Session
) -> None:
    headers = _login(seeded_client, "admin", "admin")
    response = seeded_client.post(
        "/api/users",
        json={
            "username": "shortpwd",
            "password": "short",
            "first_name": "Short",
            "last_name": "Pwd",
            "role_name": "Actor",
        },
        headers=headers,
    )
    assert response.status_code == 422


def test_import_rejects_oversized_script(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    # Fresh empty production for import size check (imported one already has acts).
    headers = _login(seeded_client, "admin", "admin")
    create = seeded_client.post(
        "/api/productions",
        json={"title": "Import Size", "season": "2026"},
        headers=headers,
    )
    empty_id = create.json()["id"]
    huge = b"# Title\n\n" + (b"x" * (5 * 1024 * 1024 + 1))
    response = seeded_client.post(
        f"/api/productions/{empty_id}/import",
        headers=headers,
        files={"file": ("big.md", huge, "text/markdown")},
    )
    assert response.status_code == 413


def test_bad_character_ids_filter_returns_422(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    acts = seeded_client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    scene_id = acts[0]["scenes"][0]["id"]
    response = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"character_ids": "1,not-an-id"},
        headers=headers,
    )
    assert response.status_code == 422


def test_login_rate_limit(seeded_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.auth.rate_limit.MAX_ATTEMPTS", 3)
    clear_login_rate_limits()

    for _ in range(3):
        response = seeded_client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "wrong"},
        )
        assert response.status_code == 401

    limited = seeded_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert limited.status_code == 429
    # Avoid leaving a tight limit for later tests in this module.
    clear_login_rate_limits()
    assert MAX_ATTEMPTS >= 3
