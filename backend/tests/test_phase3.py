"""Phase 3 API tests: timeline editing, props, cues, and extended filters."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Moment, Production, User
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
        json={"title": "Endurance Phase 3", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    content = FIXTURE_PATH.read_text(encoding="utf-8")
    import_script(db_session, production, content)
    return production_id


def _first_scene_id(client: TestClient, production_id: int, headers: dict[str, str]) -> int:
    acts = client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    return acts[0]["scenes"][0]["id"]


def _first_dialogue_moment(
    client: TestClient, production_id: int, scene_id: int, headers: dict[str, str]
) -> dict:
    moments = client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=headers,
    ).json()
    return next(moment for moment in moments if moment["moment_type"] == "dialogue")


def _character_id_by_name(
    client: TestClient, production_id: int, name: str, headers: dict[str, str]
) -> int:
    characters = client.get(
        f"/api/productions/{production_id}/characters", headers=headers
    ).json()
    return next(character["id"] for character in characters if character["name"] == name)


def test_actor_cannot_patch_moment(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)
    actor_headers = _login(seeded_client, "actor", "actor")

    response = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        json={"parsed_text": "Edited by actor"},
        headers=actor_headers,
    )
    assert response.status_code == 403


def test_director_can_change_dialogue_character_id(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        headers=director_headers,
    ).json()
    line = detail["dialogue"][0]
    original_character_id = line["character_id"]
    worsley_id = _character_id_by_name(seeded_client, production_id, "WORSLEY", director_headers)
    assert original_character_id != worsley_id

    updated = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}/dialogue/{line['id']}",
        json={"character_id": worsley_id},
        headers=director_headers,
    )
    assert updated.status_code == 200
    updated_line = updated.json()["dialogue"][0]
    assert updated_line["character_id"] == worsley_id
    assert updated_line["character_name"] == "WORSLEY"


def test_original_text_unchanged_after_patch(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)
    original_text = moment["original_text"]

    patched = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        json={"parsed_text": "Director corrected parsing"},
        headers=director_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["original_text"] == original_text
    assert patched.json()["parsed_text"] == "Director corrected parsing"

    db_moment = db_session.get(Moment, moment["id"])
    assert db_moment is not None
    assert db_moment.original_text == original_text


def test_moment_list_display_text_reflects_edits(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)

    corrected = "Director corrected parsing"
    patched = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        json={"parsed_text": corrected},
        headers=director_headers,
    )
    assert patched.status_code == 200

    listed = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    listed_moment = next(item for item in listed if item["id"] == moment["id"])
    assert listed_moment["display_text"] == corrected
    assert listed_moment["original_text"] == moment["original_text"]


def test_moment_list_display_text_reflects_dialogue_speaker_change(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        headers=director_headers,
    ).json()
    line = detail["dialogue"][0]
    worsley_id = _character_id_by_name(seeded_client, production_id, "WORSLEY", director_headers)

    updated = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}/dialogue/{line['id']}",
        json={"character_id": worsley_id},
        headers=director_headers,
    )
    assert updated.status_code == 200
    updated_line = updated.json()["dialogue"][0]

    listed = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    listed_moment = next(item for item in listed if item["id"] == moment["id"])
    assert updated_line["character_name"] in listed_moment["display_text"]
    assert updated_line["dialogue_text"] in listed_moment["display_text"]


def test_props_attach_and_detach(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)

    prop = seeded_client.post(
        f"/api/productions/{production_id}/props",
        json={"name": "Sextant", "description": "Navigation instrument"},
        headers=director_headers,
    )
    assert prop.status_code == 201
    prop_id = prop.json()["id"]

    attached = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment['id']}/props",
        json={"prop_id": prop_id, "character_id": crean_id, "notes": "enters with sextant"},
        headers=director_headers,
    )
    assert attached.status_code == 201
    moment_prop_id = attached.json()["id"]
    assert attached.json()["prop_name"] == "Sextant"
    assert attached.json()["character_name"] == "CREAN"

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        headers=director_headers,
    ).json()
    assert len(detail["props"]) == 1
    assert detail["props"][0]["prop_name"] == "Sextant"

    summary = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    matched = next(item for item in summary if item["id"] == moment["id"])
    assert matched["has_props"] is True

    deleted = seeded_client.delete(
        f"/api/productions/{production_id}/moments/{moment['id']}/props/{moment_prop_id}",
        headers=director_headers,
    )
    assert deleted.status_code == 204

    after = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        headers=director_headers,
    ).json()
    assert after["props"] == []


def test_cue_only_includes_cued_dialogue_moment(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)

    category = seeded_client.post(
        f"/api/productions/{production_id}/cue-categories",
        json={"name": "Lighting", "description": "Lighting cues"},
        headers=director_headers,
    )
    assert category.status_code == 201

    cue = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment['id']}/cues",
        json={
            "cue_category_id": category.json()["id"],
            "title": "Fade to blue",
            "notes": "Slow fade",
            "payload": {"duration_seconds": 3},
        },
        headers=director_headers,
    )
    assert cue.status_code == 201

    cue_only = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"cue_only": True},
        headers=director_headers,
    ).json()
    cue_only_ids = {item["id"] for item in cue_only}
    assert moment["id"] in cue_only_ids
    assert any(item["moment_type"] == "dialogue" for item in cue_only)

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        headers=director_headers,
    ).json()
    assert len(detail["cues"]) == 1
    assert detail["cues"][0]["title"] == "Fade to blue"


def test_song_id_filter(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)

    songs = seeded_client.get(
        f"/api/productions/{production_id}/songs",
        headers=director_headers,
    ).json()
    assert len(songs) > 0
    song_id = songs[0]["id"]

    filtered = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"song_id": song_id},
        headers=director_headers,
    ).json()
    assert len(filtered) > 0
    assert all(moment["song_id"] == song_id for moment in filtered)

    unlinked = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    assert len(unlinked) > len(filtered)
