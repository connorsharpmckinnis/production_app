"""Phase 4 API tests: settings, structural editing, prep objects, and reports."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Moment, MomentType, Production
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
        json={"title": "Endurance Phase 4", "season": "2026"},
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


def _moment_type_id_by_name(db_session: Session, name: str) -> int:
    moment_type = db_session.query(MomentType).filter(MomentType.name == name).one()
    return moment_type.id


def test_settings_get_and_patch(seeded_client: TestClient) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")
    director_headers = _login(seeded_client, "director", "director")

    settings = seeded_client.get("/api/settings", headers=director_headers)
    assert settings.status_code == 200
    assert settings.json() == {
        "show_original_text": True,
        "show_parsed_text": True,
        "default_message_rotation_seconds": 20,
    }

    patched = seeded_client.patch(
        "/api/settings",
        json={"show_original_text": False},
        headers=admin_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["show_original_text"] is False
    assert patched.json()["show_parsed_text"] is True

    forbidden = seeded_client.patch(
        "/api/settings",
        json={"show_parsed_text": False},
        headers=director_headers,
    )
    assert forbidden.status_code == 403


def test_structural_insert_delete_reorder(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    stage_direction_type_id = _moment_type_id_by_name(db_session, "stage_direction")

    before = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    insert_at = before[0]["sequence_number"]

    inserted = seeded_client.post(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        json={
            "sequence_number": insert_at,
            "moment_type_id": stage_direction_type_id,
            "original_text": "CREAN crosses downstage.",
        },
        headers=director_headers,
    )
    assert inserted.status_code == 201
    new_moment_id = inserted.json()["id"]
    assert inserted.json()["original_text"] == "CREAN crosses downstage."
    assert inserted.json()["stage_direction"] == "CREAN crosses downstage."

    after_insert = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    assert len(after_insert) == len(before) + 1
    inserted_row = next(item for item in after_insert if item["id"] == new_moment_id)
    assert inserted_row["sequence_number"] == insert_at

    moved = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{new_moment_id}/sequence",
        json={"sequence_number": len(after_insert)},
        headers=director_headers,
    )
    assert moved.status_code == 200
    assert moved.json()["sequence_number"] == len(after_insert)

    deleted = seeded_client.delete(
        f"/api/productions/{production_id}/moments/{new_moment_id}",
        headers=director_headers,
    )
    assert deleted.status_code == 204

    after_delete = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    assert len(after_delete) == len(before)


def test_actor_forbidden_on_structural_edits(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    actor_headers = _login(seeded_client, "actor", "actor")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)
    stage_direction_type_id = _moment_type_id_by_name(db_session, "stage_direction")

    insert = seeded_client.post(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        json={
            "sequence_number": 1,
            "moment_type_id": stage_direction_type_id,
            "original_text": "Test.",
        },
        headers=actor_headers,
    )
    assert insert.status_code == 403

    delete = seeded_client.delete(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        headers=actor_headers,
    )
    assert delete.status_code == 403

    reorder = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}/sequence",
        json={"sequence_number": 1},
        headers=actor_headers,
    )
    assert reorder.status_code == 403


def test_original_text_immutable_on_patch(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)
    original_text = moment["original_text"]

    rejected = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        json={"original_text": "Changed import text"},
        headers=director_headers,
    )
    assert rejected.status_code == 422

    patched = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        json={"parsed_text": "Director correction"},
        headers=director_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["original_text"] == original_text

    db_moment = db_session.get(Moment, moment["id"])
    assert db_moment is not None
    assert db_moment.original_text == original_text


def test_moment_type_change_warning(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)
    stage_direction_type_id = _moment_type_id_by_name(db_session, "stage_direction")

    blocked = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        json={"moment_type_id": stage_direction_type_id},
        headers=director_headers,
    )
    assert blocked.status_code == 409
    assert "orphan" in blocked.json()["detail"].lower()

    forced = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        json={"moment_type_id": stage_direction_type_id, "force_type_change": True},
        headers=director_headers,
    )
    assert forced.status_code == 200
    assert forced.json()["moment_type"] == "stage_direction"


def test_costumes_crud_and_validation(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)

    bad_scene = seeded_client.post(
        f"/api/productions/{production_id}/costumes",
        json={
            "character_id": crean_id,
            "scene_id": 99999,
            "name": "Parka",
        },
        headers=director_headers,
    )
    assert bad_scene.status_code == 400

    created = seeded_client.post(
        f"/api/productions/{production_id}/costumes",
        json={
            "character_id": crean_id,
            "scene_id": scene_id,
            "name": "Expedition parka",
            "description": "Heavy wool coat",
        },
        headers=director_headers,
    )
    assert created.status_code == 201
    costume_id = created.json()["id"]
    assert created.json()["character_name"] == "CREAN"
    assert created.json()["name"] == "Expedition parka"

    listed = seeded_client.get(
        f"/api/productions/{production_id}/costumes",
        headers=director_headers,
    ).json()
    assert any(item["id"] == costume_id for item in listed)

    updated = seeded_client.patch(
        f"/api/productions/{production_id}/costumes/{costume_id}",
        json={"name": "Winter parka"},
        headers=director_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Winter parka"

    deleted = seeded_client.delete(
        f"/api/productions/{production_id}/costumes/{costume_id}",
        headers=director_headers,
    )
    assert deleted.status_code == 204


def test_costume_only_timeline_filter(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)

    all_moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    crean_dialogue = next(
        moment
        for moment in all_moments
        if moment["moment_type"] == "dialogue"
        and crean_id in moment["speaking_character_ids"]
    )

    before_costume = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"costume_only": True},
        headers=director_headers,
    ).json()
    assert crean_dialogue["id"] not in {moment["id"] for moment in before_costume}

    seeded_client.post(
        f"/api/productions/{production_id}/costumes",
        json={
            "character_id": crean_id,
            "scene_id": scene_id,
            "name": "Expedition parka",
        },
        headers=director_headers,
    )

    after_costume = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    crean_row = next(item for item in after_costume if item["id"] == crean_dialogue["id"])
    assert crean_row["has_costume"] is True

    filtered = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"costume_only": True},
        headers=director_headers,
    ).json()
    assert crean_dialogue["id"] in {moment["id"] for moment in filtered}
    assert all(moment["has_costume"] for moment in filtered)


def test_set_pieces_attach_detach(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)

    set_piece = seeded_client.post(
        f"/api/productions/{production_id}/set-pieces",
        json={"name": "Camp table", "mobile": True},
        headers=director_headers,
    )
    assert set_piece.status_code == 201
    set_piece_id = set_piece.json()["id"]

    piece_attached = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment['id']}/set-pieces",
        json={"set_piece_id": set_piece_id, "notes": "Stage left"},
        headers=director_headers,
    )
    assert piece_attached.status_code == 201
    moment_set_piece_id = piece_attached.json()["id"]

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment['id']}",
        headers=director_headers,
    ).json()
    assert len(detail["set_pieces"]) == 1

    summary = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    matched = next(item for item in summary if item["id"] == moment["id"])
    assert matched["has_set_piece"] is True

    piece_filtered = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        params={"set_piece_id": set_piece_id},
        headers=director_headers,
    ).json()
    assert any(item["id"] == moment["id"] for item in piece_filtered)

    seeded_client.delete(
        f"/api/productions/{production_id}/moments/{moment['id']}/set-pieces/{moment_set_piece_id}",
        headers=director_headers,
    )


def test_reports_endpoints(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moment = _first_dialogue_moment(seeded_client, production_id, scene_id, director_headers)
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)

    prop = seeded_client.post(
        f"/api/productions/{production_id}/props",
        json={"name": "Compass"},
        headers=director_headers,
    ).json()
    seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment['id']}/props",
        json={"prop_id": prop["id"], "character_id": crean_id},
        headers=director_headers,
    )

    category = seeded_client.post(
        f"/api/productions/{production_id}/cue-categories",
        json={"name": "Sound"},
        headers=director_headers,
    ).json()
    seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment['id']}/cues",
        json={"cue_category_id": category["id"], "title": "Wind cue"},
        headers=director_headers,
    )

    seeded_client.post(
        f"/api/productions/{production_id}/costumes",
        json={
            "character_id": crean_id,
            "scene_id": scene_id,
            "name": "Parka",
        },
        headers=director_headers,
    )

    prop_sheet = seeded_client.get(
        f"/api/productions/{production_id}/reports/prop-sheet",
        headers=director_headers,
    )
    assert prop_sheet.status_code == 200
    assert any(entry["prop_name"] == "Compass" for entry in prop_sheet.json())
    compass = next(entry for entry in prop_sheet.json() if entry["prop_name"] == "Compass")
    assert len(compass["moments"]) == 1
    assert compass["moments"][0]["character_name"] == "CREAN"

    cue_sheet = seeded_client.get(
        f"/api/productions/{production_id}/reports/cue-sheet",
        headers=director_headers,
    )
    assert cue_sheet.status_code == 200
    sound = next(group for group in cue_sheet.json() if group["cue_category_name"] == "Sound")
    assert len(sound["cues"]) == 1
    assert sound["cues"][0]["title"] == "Wind cue"

    costumes_report = seeded_client.get(
        f"/api/productions/{production_id}/reports/costumes-by-scene",
        headers=director_headers,
    )
    assert costumes_report.status_code == 200
    assert len(costumes_report.json()) >= 1
    assert costumes_report.json()[0]["costumes"][0]["character_name"] == "CREAN"
