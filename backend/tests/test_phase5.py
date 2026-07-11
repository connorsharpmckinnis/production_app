"""Phase 5 API tests: entrances, exits, blocking, overview, and reports."""

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
        json={"title": "Endurance Phase 5", "season": "2026"},
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


def _scene_moments(
    client: TestClient, production_id: int, scene_id: int, headers: dict[str, str]
) -> list[dict]:
    return client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=headers,
    ).json()


def _character_id_by_name(
    client: TestClient, production_id: int, name: str, headers: dict[str, str]
) -> int:
    characters = client.get(
        f"/api/productions/{production_id}/characters", headers=headers
    ).json()
    return next(character["id"] for character in characters if character["name"] == name)


def test_entrance_exit_blocking_and_on_stage(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)
    moments = _scene_moments(seeded_client, production_id, scene_id, director_headers)
    entrance_moment = moments[0]
    exit_moment = moments[min(5, len(moments) - 1)]
    blocking_moment = moments[min(2, len(moments) - 1)]

    entrance = seeded_client.post(
        f"/api/productions/{production_id}/moments/{entrance_moment['id']}/entrances",
        json={"character_id": crean_id, "notes": "from SR"},
        headers=director_headers,
    )
    assert entrance.status_code == 201

    exit_resp = seeded_client.post(
        f"/api/productions/{production_id}/moments/{exit_moment['id']}/exits",
        json={"character_id": crean_id},
        headers=director_headers,
    )
    assert exit_resp.status_code == 201

    blocking = seeded_client.post(
        f"/api/productions/{production_id}/moments/{blocking_moment['id']}/blocking",
        json={"character_id": crean_id, "notes": "Cross DSL"},
        headers=director_headers,
    )
    assert blocking.status_code == 201

    between_moment_id = moments[min(2, len(moments) - 1)]["id"]
    if between_moment_id == exit_moment["id"]:
        between_moment_id = entrance_moment["id"]

    detail_between = seeded_client.get(
        f"/api/productions/{production_id}/moments/{between_moment_id}",
        headers=director_headers,
    ).json()
    on_stage_names = [character["name"] for character in detail_between["on_stage_characters"]]
    if (
        entrance_moment["sequence_number"]
        <= detail_between["sequence_number"]
        < exit_moment["sequence_number"]
    ):
        assert "CREAN" in on_stage_names

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{blocking_moment['id']}",
        headers=director_headers,
    ).json()
    assert len(detail["blocking"]) == 1
    assert detail["blocking"][0]["notes"] == "Cross DSL"

    patched = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{blocking_moment['id']}/blocking/{blocking.json()['id']}",
        json={"notes": "Updated blocking"},
        headers=director_headers,
    )
    assert patched.status_code == 200
    assert patched.json()["notes"] == "Updated blocking"

    filtered = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments?entrance_only=true",
        headers=director_headers,
    ).json()
    assert any(moment["id"] == entrance_moment["id"] for moment in filtered)
    assert all(moment["has_entrance"] for moment in filtered)

    blocking_filtered = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments?blocking_only=true",
        headers=director_headers,
    ).json()
    assert any(moment["id"] == blocking_moment["id"] for moment in blocking_filtered)


def test_actor_forbidden_on_stage_movement_mutations(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    actor_headers = _login(seeded_client, "actor", "actor")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moments = _scene_moments(seeded_client, production_id, scene_id, director_headers)
    moment_id = moments[0]["id"]
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)

    assert (
        seeded_client.post(
            f"/api/productions/{production_id}/moments/{moment_id}/entrances",
            json={"character_id": crean_id},
            headers=actor_headers,
        ).status_code
        == 403
    )
    assert (
        seeded_client.post(
            f"/api/productions/{production_id}/moments/{moment_id}/exits",
            json={"character_id": crean_id},
            headers=actor_headers,
        ).status_code
        == 403
    )
    assert (
        seeded_client.post(
            f"/api/productions/{production_id}/moments/{moment_id}/blocking",
            json={"character_id": crean_id, "notes": "Blocked"},
            headers=actor_headers,
        ).status_code
        == 403
    )

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{moment_id}",
        headers=actor_headers,
    )
    assert detail.status_code == 200


def test_production_overview(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    )
    assert overview.status_code == 200
    data = overview.json()
    assert data["author"] is not None
    assert data["act_count"] >= 1
    assert data["scene_count"] >= 1
    assert data["moment_count"] > 0
    assert data["character_count"] > 0
    assert data["imported_at"] is not None


def test_phase5_reports(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moments = _scene_moments(seeded_client, production_id, scene_id, director_headers)
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)

    seeded_client.post(
        f"/api/productions/{production_id}/moments/{moments[0]['id']}/entrances",
        json={"character_id": crean_id},
        headers=director_headers,
    )
    seeded_client.post(
        f"/api/productions/{production_id}/moments/{moments[1]['id']}/blocking",
        json={"character_id": crean_id, "notes": "Stage left"},
        headers=director_headers,
    )

    entrance_exit = seeded_client.get(
        f"/api/productions/{production_id}/reports/entrance-exit-sheet",
        headers=director_headers,
    )
    assert entrance_exit.status_code == 200
    assert len(entrance_exit.json()) >= 1

    blocking_sheet = seeded_client.get(
        f"/api/productions/{production_id}/reports/blocking-sheet",
        headers=director_headers,
    )
    assert blocking_sheet.status_code == 200
    assert len(blocking_sheet.json()) == 1
    assert blocking_sheet.json()[0]["character_name"] == "CREAN"
