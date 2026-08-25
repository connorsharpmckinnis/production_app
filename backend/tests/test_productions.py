"""Production API tests."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import (
    Act,
    Announcement,
    Bookmark,
    Character,
    Dialogue,
    Moment,
    Note,
    Notification,
    Production,
    Song,
    StageDirection,
    User,
    UserCharacterAssignment,
)
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


def test_delete_empty_production(seeded_client: TestClient, db_session: Session) -> None:
    headers = _admin_headers(seeded_client)
    create = seeded_client.post(
        "/api/productions",
        json={"title": "Empty Show", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]

    # Create always fans out admin inbox rows keyed to the production.
    assert (
        db_session.query(Notification)
        .filter(Notification.production_id == production_id)
        .count()
        > 0
    )

    response = seeded_client.delete(f"/api/productions/{production_id}", headers=headers)
    assert response.status_code == 204
    assert seeded_client.get(f"/api/productions/{production_id}", headers=headers).status_code == 404
    assert (
        db_session.query(Notification)
        .filter(Notification.production_id == production_id)
        .count()
        == 0
    )


def test_delete_production_cascades_announcements(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    headers = _admin_headers(seeded_client)
    create = seeded_client.post(
        "/api/productions",
        json={"title": "Announce Then Delete", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]

    announce = seeded_client.post(
        f"/api/productions/{production_id}/announcements",
        json={
            "title": "Call time",
            "body": "Be early.",
            "severity": "info",
            "audience_roles": ["Admin"],
        },
        headers=headers,
    )
    assert announce.status_code == 201
    announcement_id = announce.json()["id"]

    response = seeded_client.delete(f"/api/productions/{production_id}", headers=headers)
    assert response.status_code == 204
    assert db_session.get(Announcement, announcement_id) is None
    assert (
        db_session.query(Notification)
        .filter(Notification.production_id == production_id)
        .count()
        == 0
    )


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


def test_delete_production_with_cast_notes_and_bookmarks(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    """Cast, notes, and bookmarks must cascade so Postgres NOT NULL FKs do not block delete."""
    headers = _admin_headers(seeded_client)
    create = seeded_client.post(
        "/api/productions",
        json={"title": "Casted Delete Test", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None

    content = FIXTURE_PATH.read_text(encoding="utf-8")
    import_script(db_session, production, content)

    characters = seeded_client.get(
        f"/api/productions/{production_id}/characters",
        headers=headers,
    ).json()
    character_id = next(c["id"] for c in characters if c["name"] == "CREAN")
    actor = db_session.query(User).filter(User.username == "actor").one()

    cast = seeded_client.put(
        f"/api/productions/{production_id}/characters/{character_id}/cast",
        json={"user_id": actor.id},
        headers=headers,
    )
    assert cast.status_code == 200

    acts = seeded_client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    scene_id = acts[0]["scenes"][0]["id"]
    moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=headers,
    ).json()
    moment_id = moments[0]["id"]

    note = seeded_client.post(
        f"/api/productions/{production_id}/notes",
        json={
            "visibility": "private",
            "moment_id": moment_id,
            "content": "Blocking reminder",
        },
        headers=headers,
    )
    assert note.status_code == 201

    character_note = seeded_client.post(
        f"/api/productions/{production_id}/notes",
        json={
            "visibility": "private",
            "character_id": character_id,
            "content": "Accent note",
        },
        headers=headers,
    )
    assert character_note.status_code == 201

    bookmark = seeded_client.post(
        "/api/bookmarks",
        json={"moment_id": moment_id, "label": "Top of scene"},
        headers=headers,
    )
    assert bookmark.status_code == 201

    assert db_session.query(UserCharacterAssignment).count() == 1
    assert db_session.query(Note).count() == 2
    assert db_session.query(Bookmark).count() == 1

    response = seeded_client.delete(f"/api/productions/{production_id}", headers=headers)
    assert response.status_code == 204

    assert db_session.get(Production, production_id) is None
    assert db_session.query(UserCharacterAssignment).count() == 0
    assert db_session.query(Note).count() == 0
    assert db_session.query(Bookmark).count() == 0


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
