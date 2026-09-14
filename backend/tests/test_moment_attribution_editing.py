"""Admin-only attribution replace APIs for dialogue, lyrics, and song attribution."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Production
from app.services.importer import import_script
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
        json={"title": "Endurance Attribution Editing", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    add_test_production_memberships(db_session, production)
    db_session.commit()
    content = FIXTURE_PATH.read_text(encoding="utf-8")
    import_script(db_session, production, content)
    return production_id


def _first_scene_id(client: TestClient, production_id: int, headers: dict[str, str]) -> int:
    acts = client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    return acts[0]["scenes"][0]["id"]


def _scene_moments(
    client: TestClient, production_id: int, scene_id: int, headers: dict[str, str]
) -> list[dict]:
    return client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=headers,
    ).json()


def _first_moment_of_type(
    client: TestClient,
    production_id: int,
    scene_id: int,
    moment_type: str,
    headers: dict[str, str],
) -> dict:
    moments = _scene_moments(client, production_id, scene_id, headers)
    return next(moment for moment in moments if moment["moment_type"] == moment_type)


def _character_id_by_name(
    client: TestClient, production_id: int, name: str, headers: dict[str, str]
) -> int:
    characters = client.get(
        f"/api/productions/{production_id}/characters", headers=headers
    ).json()
    return next(character["id"] for character in characters if character["name"] == name)


def test_admin_can_put_lyric_attributions(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    admin_headers = _login(seeded_client, "admin", "admin")
    scene_id = _first_scene_id(seeded_client, production_id, admin_headers)
    lyric_moment = _first_moment_of_type(
        seeded_client, production_id, scene_id, "lyric", admin_headers
    )
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", admin_headers)

    replaced = seeded_client.put(
        f"/api/productions/{production_id}/moments/{lyric_moment['id']}/lyric-attributions",
        json={
            "subjects": [{"character_id": crean_id}],
            "lyric_text": "INTO THE DEEP — CREAN ONLY",
        },
        headers=admin_headers,
    )
    assert replaced.status_code == 200
    lyrics = replaced.json()["lyrics"]
    assert len(lyrics) == 1
    assert lyrics[0]["character_id"] == crean_id
    assert lyrics[0]["character_name"] == "CREAN"
    assert lyrics[0]["group_id"] is None
    assert lyrics[0]["lyric_text"] == "INTO THE DEEP — CREAN ONLY"


def test_admin_can_put_song_attributions(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    admin_headers = _login(seeded_client, "admin", "admin")
    scene_id = _first_scene_id(seeded_client, production_id, admin_headers)
    song_attr = _first_moment_of_type(
        seeded_client, production_id, scene_id, "song_attribution", admin_headers
    )
    worsley_id = _character_id_by_name(
        seeded_client, production_id, "WORSLEY", admin_headers
    )
    shackleton_id = _character_id_by_name(
        seeded_client, production_id, "SHACKLETON", admin_headers
    )

    replaced = seeded_client.put(
        f"/api/productions/{production_id}/moments/{song_attr['id']}/song-attributions",
        json={
            "subjects": [
                {"character_id": worsley_id},
                {"character_id": shackleton_id},
            ]
        },
        headers=admin_headers,
    )
    assert replaced.status_code == 200
    subjects = replaced.json()["song_attribution"]
    assert len(subjects) == 2
    subject_ids = {row["character_id"] for row in subjects}
    assert subject_ids == {worsley_id, shackleton_id}
    assert all(row["group_id"] is None for row in subjects)


def test_admin_can_put_dialogue_attributions_with_character_and_group(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    admin_headers = _login(seeded_client, "admin", "admin")
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, admin_headers)
    dialogue_moment = _first_moment_of_type(
        seeded_client, production_id, scene_id, "dialogue", admin_headers
    )
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", admin_headers)

    group = seeded_client.post(
        f"/api/productions/{production_id}/groups",
        json={"name": "Expedition Trio"},
        headers=director_headers,
    )
    assert group.status_code == 201
    group_id = group.json()["id"]

    replaced = seeded_client.put(
        f"/api/productions/{production_id}/moments/{dialogue_moment['id']}/dialogue-attributions",
        json={
            "subjects": [
                {"character_id": crean_id},
                {"group_id": group_id},
            ],
            "dialogue_text": "Shared line for CREAN and the trio.",
        },
        headers=admin_headers,
    )
    assert replaced.status_code == 200
    dialogue = replaced.json()["dialogue"]
    assert len(dialogue) == 2
    by_character = next(line for line in dialogue if line["character_id"] == crean_id)
    by_group = next(line for line in dialogue if line["group_id"] == group_id)
    assert by_character["group_id"] is None
    assert by_character["dialogue_text"] == "Shared line for CREAN and the trio."
    assert by_group["character_id"] is None
    assert by_group["group_name"] == "Expedition Trio"
    assert by_group["dialogue_text"] == "Shared line for CREAN and the trio."


def test_director_cannot_put_lyric_attributions(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    lyric_moment = _first_moment_of_type(
        seeded_client, production_id, scene_id, "lyric", director_headers
    )
    crean_id = _character_id_by_name(
        seeded_client, production_id, "CREAN", director_headers
    )

    forbidden = seeded_client.put(
        f"/api/productions/{production_id}/moments/{lyric_moment['id']}/lyric-attributions",
        json={
            "subjects": [{"character_id": crean_id}],
            "lyric_text": "Director should not edit lyrics",
        },
        headers=director_headers,
    )
    assert forbidden.status_code == 403


def test_moment_detail_includes_song_attribution_list(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    song_attr = _first_moment_of_type(
        seeded_client, production_id, scene_id, "song_attribution", director_headers
    )

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{song_attr['id']}",
        headers=director_headers,
    )
    assert detail.status_code == 200
    payload = detail.json()
    assert "song_attribution" in payload
    assert isinstance(payload["song_attribution"], list)
    assert len(payload["song_attribution"]) >= 1
    first = payload["song_attribution"][0]
    assert "character_id" in first or "group_id" in first
    assert first.get("character_id") is not None or first.get("group_id") is not None
