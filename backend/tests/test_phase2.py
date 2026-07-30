"""Phase 2 API tests: casting, notes, bookmarks, timeline filters."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Character, Production, User
from app.services.importer import import_script

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database(db_session, test_settings)
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _imported_production(client: TestClient, db_session: Session) -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "Endurance Phase 2", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    content = FIXTURE_PATH.read_text(encoding="utf-8")
    import_script(db_session, production, content)
    return production_id


def _crean_character_id(client: TestClient, production_id: int, headers: dict[str, str]) -> int:
    characters = client.get(f"/api/productions/{production_id}/characters", headers=headers).json()
    crean = next(character for character in characters if character["name"] == "CREAN")
    return crean["id"]


def _first_scene_id(client: TestClient, production_id: int, headers: dict[str, str]) -> int:
    acts = client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    return acts[0]["scenes"][0]["id"]


def _cast_dev_actor(client: TestClient, db_session: Session, production_id: int) -> None:
    """Give the seeded actor user access to the production (IDOR-safe reads)."""
    director_headers = _login(client, "director", "director")
    crean_id = _crean_character_id(client, production_id, director_headers)
    actor = db_session.query(User).filter(User.username == "actor").one()
    cast = client.put(
        f"/api/productions/{production_id}/characters/{crean_id}/cast",
        json={"user_id": actor.id},
        headers=director_headers,
    )
    assert cast.status_code == 200


def test_actor_production_list_empty_before_casting(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    actor_headers = _login(seeded_client, "actor", "actor")

    productions = seeded_client.get("/api/productions", headers=actor_headers).json()
    assert productions == []

    # Director still sees everything.
    director_headers = _login(seeded_client, "director", "director")
    director_productions = seeded_client.get("/api/productions", headers=director_headers).json()
    assert any(production["id"] == production_id for production in director_productions)


def test_casting_restricts_actor_production_list(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    crean_id = _crean_character_id(seeded_client, production_id, director_headers)

    actor = db_session.query(User).filter(User.username == "actor").one()

    cast = seeded_client.put(
        f"/api/productions/{production_id}/characters/{crean_id}/cast",
        json={"user_id": actor.id},
        headers=director_headers,
    )
    assert cast.status_code == 200
    assert cast.json()["user_display_name"] == "Dev Actor"

    actor_headers = _login(seeded_client, "actor", "actor")
    productions = seeded_client.get("/api/productions", headers=actor_headers).json()
    assert len(productions) == 1
    assert productions[0]["id"] == production_id


def test_actor_cannot_cast(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    admin_headers = _login(seeded_client, "admin", "admin")
    crean_id = _crean_character_id(seeded_client, production_id, admin_headers)
    actor = db_session.query(User).filter(User.username == "actor").one()
    actor_headers = _login(seeded_client, "actor", "actor")

    response = seeded_client.put(
        f"/api/productions/{production_id}/characters/{crean_id}/cast",
        json={"user_id": actor.id},
        headers=actor_headers,
    )
    assert response.status_code == 403


def test_cue_only_hides_dialogue(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, headers)

    all_moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=headers,
    ).json()
    cue_only = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"cue_only": True},
        headers=headers,
    ).json()

    assert any(moment["moment_type"] == "dialogue" for moment in all_moments)
    assert all(
        moment["moment_type"] in ("stage_direction", "song_header", "song_attribution")
        for moment in cue_only
    )


def test_search_finds_shackleton(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, headers)

    results = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"search": "Shackleton"},
        headers=headers,
    ).json()

    assert len(results) > 0
    assert all("shackleton" in moment["original_text"].casefold() for moment in results)


def test_character_filter_includes_dialogue_and_referenced_stage_directions(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, headers)
    crean_id = _crean_character_id(seeded_client, production_id, headers)

    filtered = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"character_ids": str(crean_id)},
        headers=headers,
    ).json()

    assert len(filtered) > 0
    for moment in filtered:
        if moment["moment_type"] == "dialogue":
            assert crean_id in moment["speaking_character_ids"]
        elif moment["moment_type"] == "stage_direction":
            assert "CREAN" in moment["original_text"]


def test_actor_cannot_see_author_note_moments(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    _cast_dev_actor(seeded_client, db_session, production_id)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)

    director_moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    author_notes = [moment for moment in director_moments if moment["moment_type"] == "author_note"]
    if not author_notes:
        pytest.skip("Fixture has no author_note moments")

    actor_headers = _login(seeded_client, "actor", "actor")
    actor_moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=actor_headers,
    ).json()
    actor_types = {moment["moment_type"] for moment in actor_moments}
    assert "author_note" not in actor_types


def test_notes_visibility(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    _cast_dev_actor(seeded_client, db_session, production_id)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment_id = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()[0]["id"]

    public_note = seeded_client.post(
        f"/api/productions/{production_id}/notes",
        json={"moment_id": moment_id, "visibility": "public", "content": "Hold for laugh"},
        headers=director_headers,
    )
    assert public_note.status_code == 201

    actor_headers = _login(seeded_client, "actor", "actor")
    private_note = seeded_client.post(
        f"/api/productions/{production_id}/notes",
        json={"moment_id": moment_id, "visibility": "private", "content": "My secret note"},
        headers=actor_headers,
    )
    assert private_note.status_code == 201

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment_id}",
        headers=actor_headers,
    ).json()
    contents = {note["content"] for note in detail["notes"]}
    assert "Hold for laugh" in contents
    assert "My secret note" in contents

    director_detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment_id}",
        headers=director_headers,
    ).json()
    director_contents = {note["content"] for note in director_detail["notes"]}
    assert "Hold for laugh" in director_contents
    assert "My secret note" not in director_contents


def test_bookmark_lifecycle(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    _cast_dev_actor(seeded_client, db_session, production_id)
    headers = _login(seeded_client, "actor", "actor")
    scene_id = _first_scene_id(seeded_client, production_id, headers)
    moment_id = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=headers,
    ).json()[0]["id"]

    created = seeded_client.post(
        "/api/bookmarks",
        json={"moment_id": moment_id, "label": "Act 1 top"},
        headers=headers,
    )
    assert created.status_code == 201

    bookmarks = seeded_client.get(
        "/api/users/me/bookmarks",
        params={"production_id": production_id},
        headers=headers,
    ).json()
    assert len(bookmarks) == 1
    assert bookmarks[0]["label"] == "Act 1 top"
    assert bookmarks[0]["act_number"] == 1
    assert bookmarks[0]["scene_number"] >= 1
    assert bookmarks[0]["sequence_number"] >= 1

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment_id}",
        headers=headers,
    ).json()
    assert detail["is_bookmarked"] is True

    bookmark_id = bookmarks[0]["id"]
    deleted = seeded_client.delete(f"/api/bookmarks/{bookmark_id}", headers=headers)
    assert deleted.status_code == 204


def test_group_timeline_filter(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    characters = seeded_client.get(
        f"/api/productions/{production_id}/characters",
        headers=director_headers,
    ).json()
    character_ids = [
        character["id"]
        for character in characters
        if character["name"] in ("CREAN", "WORSLEY")
    ]
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)

    created = seeded_client.post(
        f"/api/productions/{production_id}/groups",
        json={"name": "Pair", "description": "Crean and Worsley"},
        headers=director_headers,
    )
    group_id = created.json()["id"]
    seeded_client.put(
        f"/api/productions/{production_id}/groups/{group_id}/members",
        json={"character_ids": character_ids},
        headers=director_headers,
    )

    filtered = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"group_id": group_id},
        headers=director_headers,
    ).json()

    assert len(filtered) > 0
    allowed_ids = set(character_ids)
    for moment in filtered:
        if moment["moment_type"] == "dialogue":
            assert any(character_id in allowed_ids for character_id in moment["speaking_character_ids"])


def test_groups_crud(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    characters = seeded_client.get(
        f"/api/productions/{production_id}/characters",
        headers=director_headers,
    ).json()
    character_ids = [
        character["id"]
        for character in characters
        if character["name"] in ("CREAN", "WORSLEY", "SHACKLETON")
    ]

    created = seeded_client.post(
        f"/api/productions/{production_id}/groups",
        json={"name": "Trio", "description": "Main trio"},
        headers=director_headers,
    )
    assert created.status_code == 201
    group_id = created.json()["id"]

    actor = db_session.query(User).filter(User.username == "actor").one()
    updated = seeded_client.put(
        f"/api/productions/{production_id}/groups/{group_id}/members",
        json={"character_ids": character_ids, "user_ids": [actor.id]},
        headers=director_headers,
    )
    assert updated.status_code == 200
    assert set(updated.json()["character_ids"]) == set(character_ids)
    assert updated.json()["user_ids"] == [actor.id]

    actor_headers = _login(seeded_client, "actor", "actor")
    blocked = seeded_client.post(
        f"/api/productions/{production_id}/groups",
        json={"name": "Blocked"},
        headers=actor_headers,
    )
    assert blocked.status_code == 403
