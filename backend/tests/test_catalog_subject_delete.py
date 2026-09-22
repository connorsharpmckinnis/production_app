"""Safe delete + reassignment for characters and groups."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Act, Character, Dialogue, Group, Moment, Production, Scene
from scoped_test_helpers import add_test_production_memberships, seed_database_with_test_users

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database_with_test_users(db_session, test_settings)
    db_session.commit()
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _imported_production(client: TestClient, db_session: Session) -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "Catalog Delete", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    add_test_production_memberships(db_session, production)
    db_session.commit()
    content = FIXTURE_PATH.read_text(encoding="utf-8")
    from app.services.importer import import_script

    import_script(db_session, production, content)
    return production_id


def test_delete_unused_character(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")

    created = seeded_client.post(
        f"/api/productions/{production_id}/characters",
        json={"name": "Spare Extra"},
        headers=headers,
    )
    assert created.status_code == 201
    character_id = created.json()["id"]

    impact = seeded_client.get(
        f"/api/productions/{production_id}/characters/{character_id}/delete-impact",
        headers=headers,
    )
    assert impact.status_code == 200
    assert impact.json()["can_delete_without_reassignment"] is True

    deleted = seeded_client.delete(
        f"/api/productions/{production_id}/characters/{character_id}",
        headers=headers,
    )
    assert deleted.status_code == 204
    assert db_session.get(Character, character_id) is None


def test_delete_character_requires_reassignment_then_moves_to_group(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")

    characters = seeded_client.get(
        f"/api/productions/{production_id}/characters", headers=headers
    ).json()
    crean = next(character for character in characters if character["name"] == "CREAN")

    group = seeded_client.post(
        f"/api/productions/{production_id}/groups",
        json={"name": "Crew"},
        headers=headers,
    )
    assert group.status_code == 201
    group_id = group.json()["id"]

    blocked = seeded_client.delete(
        f"/api/productions/{production_id}/characters/{crean['id']}",
        headers=headers,
    )
    assert blocked.status_code == 409
    detail = blocked.json()["detail"]
    assert detail["code"] == "reassignment_required"
    assert detail["reassignable"]["dialogue"] > 0

    deleted = seeded_client.request(
        "DELETE",
        f"/api/productions/{production_id}/characters/{crean['id']}",
        headers=headers,
        json={"reassign_to": {"type": "group", "id": group_id}},
    )
    assert deleted.status_code == 204
    assert db_session.get(Character, crean["id"]) is None

    dialogue_for_group = (
        db_session.query(Dialogue).filter(Dialogue.group_id == group_id).count()
    )
    assert dialogue_for_group > 0
    leftover = (
        db_session.query(Dialogue).filter(Dialogue.character_id == crean["id"]).count()
    )
    assert leftover == 0


def test_delete_character_to_group_blocked_by_costume(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")

    created = seeded_client.post(
        f"/api/productions/{production_id}/characters",
        json={"name": "Costumed Extra"},
        headers=headers,
    )
    character_id = created.json()["id"]

    costume = seeded_client.post(
        f"/api/productions/{production_id}/costumes",
        json={"name": "Coat", "character_id": character_id},
        headers=headers,
    )
    assert costume.status_code == 201

    group = seeded_client.post(
        f"/api/productions/{production_id}/groups",
        json={"name": "Extras"},
        headers=headers,
    )
    group_id = group.json()["id"]

    blocked = seeded_client.request(
        "DELETE",
        f"/api/productions/{production_id}/characters/{character_id}",
        headers=headers,
        json={"reassign_to": {"type": "group", "id": group_id}},
    )
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "character_only_blockers"


def test_delete_group_reassigns_to_character(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")

    characters = seeded_client.get(
        f"/api/productions/{production_id}/characters", headers=headers
    ).json()
    crean_id = next(c["id"] for c in characters if c["name"] == "CREAN")

    group = seeded_client.post(
        f"/api/productions/{production_id}/groups",
        json={"name": "Carolers"},
        headers=headers,
    )
    group_id = group.json()["id"]

    scene = (
        db_session.query(Scene)
        .join(Act, Act.id == Scene.act_id)
        .filter(Act.production_id == production_id)
        .first()
    )
    assert scene is not None
    moment = (
        db_session.query(Moment).filter(Moment.scene_id == scene.id).order_by(Moment.id).first()
    )
    assert moment is not None
    db_session.add(
        Dialogue(moment_id=moment.id, group_id=group_id, dialogue_text="Fa la la")
    )
    db_session.commit()

    impact = seeded_client.get(
        f"/api/productions/{production_id}/groups/{group_id}/delete-impact",
        headers=headers,
    )
    assert impact.status_code == 200
    assert impact.json()["requires_reassignment"] is True

    deleted = seeded_client.request(
        "DELETE",
        f"/api/productions/{production_id}/groups/{group_id}",
        headers=headers,
        json={"reassign_to": {"type": "character", "id": crean_id}},
    )
    assert deleted.status_code == 204
    assert db_session.get(Group, group_id) is None
    assert (
        db_session.query(Dialogue)
        .filter(Dialogue.character_id == crean_id, Dialogue.dialogue_text == "Fa la la")
        .count()
        == 1
    )


def test_actor_cannot_delete_character(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director = _login(seeded_client, "director", "director")
    actor = _login(seeded_client, "actor", "actor")

    created = seeded_client.post(
        f"/api/productions/{production_id}/characters",
        json={"name": "Temp"},
        headers=director,
    )
    character_id = created.json()["id"]

    response = seeded_client.delete(
        f"/api/productions/{production_id}/characters/{character_id}",
        headers=actor,
    )
    assert response.status_code == 403
