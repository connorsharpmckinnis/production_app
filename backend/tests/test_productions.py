"""Production API tests."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Act, Character, Dialogue, Moment, Production, Song, StageDirection
from app.services.importer import import_script

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database(db_session, test_settings)
    return client


def _admin_headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_delete_empty_production(seeded_client: TestClient) -> None:
    headers = _admin_headers(seeded_client)
    create = seeded_client.post(
        "/api/productions",
        json={"title": "Empty Show", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]

    response = seeded_client.delete(f"/api/productions/{production_id}", headers=headers)
    assert response.status_code == 204
    assert seeded_client.get(f"/api/productions/{production_id}", headers=headers).status_code == 404


def test_delete_imported_production_cascades(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    headers = _admin_headers(seeded_client)
    create = seeded_client.post(
        "/api/productions",
        json={"title": "Endurance Delete Test", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None

    content = FIXTURE_PATH.read_text(encoding="utf-8")
    import_script(db_session, production, content)

    assert db_session.query(Act).filter(Act.production_id == production_id).count() > 0
    assert db_session.query(Character).filter(Character.production_id == production_id).count() > 0
    assert db_session.query(Song).filter(Song.production_id == production_id).count() > 0
    assert db_session.query(Moment).count() > 0
    assert db_session.query(Dialogue).count() > 0
    assert db_session.query(StageDirection).count() > 0

    response = seeded_client.delete(f"/api/productions/{production_id}", headers=headers)
    assert response.status_code == 204

    assert db_session.get(Production, production_id) is None
    assert db_session.query(Act).filter(Act.production_id == production_id).count() == 0
    assert db_session.query(Character).filter(Character.production_id == production_id).count() == 0
    assert db_session.query(Song).filter(Song.production_id == production_id).count() == 0
    assert db_session.query(Moment).count() == 0
    assert db_session.query(Dialogue).count() == 0
    assert db_session.query(StageDirection).count() == 0


def test_non_admin_cannot_delete_production(seeded_client: TestClient) -> None:
    admin_headers = _admin_headers(seeded_client)
    create = seeded_client.post(
        "/api/productions",
        json={"title": "Protected", "season": None},
        headers=admin_headers,
    )
    production_id = create.json()["id"]

    director_login = seeded_client.post(
        "/api/auth/login",
        json={"username": "director", "password": "director"},
    )
    director_headers = {"Authorization": f"Bearer {director_login.json()['access_token']}"}

    response = seeded_client.delete(
        f"/api/productions/{production_id}",
        headers=director_headers,
    )
    assert response.status_code == 403
