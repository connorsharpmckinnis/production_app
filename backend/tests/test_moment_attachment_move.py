from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Production
from app.services.importer import import_script
from scoped_test_helpers import add_test_production_memberships, seed_database_with_test_users

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings: object) -> TestClient:
    seed_database_with_test_users(db_session, test_settings)
    db_session.commit()
    return client


def _login(client: TestClient, username: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": username},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _production(client: TestClient, db_session: Session) -> int:
    admin = _login(client, "admin")
    created = client.post(
        "/api/productions",
        json={"title": "Attachment Move", "season": "2026"},
        headers=admin,
    )
    production_id = created.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    add_test_production_memberships(db_session, production)
    db_session.commit()
    import_script(db_session, production, FIXTURE_PATH.read_text(encoding="utf-8"))
    return production_id


def test_move_prop_preserves_id_and_rejects_destination_conflict(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _production(seeded_client, db_session)
    director = _login(seeded_client, "director")
    acts = seeded_client.get(
        f"/api/productions/{production_id}/acts", headers=director
    ).json()
    moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{acts[0]['scenes'][0]['id']}/moments",
        headers=director,
    ).json()
    source_id, destination_id = moments[0]["id"], moments[1]["id"]

    prop = seeded_client.post(
        f"/api/productions/{production_id}/props",
        json={"name": "Lantern"},
        headers=director,
    ).json()
    attached = seeded_client.post(
        f"/api/productions/{production_id}/moments/{source_id}/props",
        json={"prop_id": prop["id"], "kind": "on"},
        headers=director,
    ).json()

    moved = seeded_client.post(
        f"/api/productions/{production_id}/moments/{source_id}/prop/{attached['id']}/move",
        json={"to_moment_id": destination_id},
        headers=director,
    )
    assert moved.status_code == 200
    assert moved.json() == {
        "id": attached["id"],
        "kind": "prop",
        "moment_id": destination_id,
    }

    second = seeded_client.post(
        f"/api/productions/{production_id}/moments/{source_id}/props",
        json={"prop_id": prop["id"], "kind": "off"},
        headers=director,
    ).json()
    conflict = seeded_client.post(
        f"/api/productions/{production_id}/moments/{source_id}/prop/{second['id']}/move",
        json={"to_moment_id": destination_id},
        headers=director,
    )
    assert conflict.status_code == 409
    assert "already exists" in conflict.json()["detail"]
