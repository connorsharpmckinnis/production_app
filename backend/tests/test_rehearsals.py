"""Rehearsal management (Phases 15–18): slots, planner, publish, notes, complete."""

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Location, Production, Scene, User
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
        json={"title": "Endurance Rehearsals", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    content = FIXTURE_PATH.read_text(encoding="utf-8")
    import_script(db_session, production, content)
    return production_id


def _cast_actor(client: TestClient, db_session: Session, production_id: int) -> int:
    director = _login(client, "director", "director")
    characters = client.get(
        f"/api/productions/{production_id}/characters",
        headers=director,
    ).json()
    crean = next(c for c in characters if c["name"] == "CREAN")
    actor = db_session.query(User).filter(User.username == "actor").one()
    cast = client.put(
        f"/api/productions/{production_id}/characters/{crean['id']}/cast",
        json={"user_id": actor.id},
        headers=director,
    )
    assert cast.status_code == 200
    return actor.id


def _window() -> tuple[str, str]:
    start = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    start = start.replace(hour=18, minute=0, second=0)
    end = start + timedelta(hours=4)
    return start.isoformat(), end.isoformat()


def test_seed_creates_default_locations(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    locations = db_session.query(Location).all()
    names = {loc.name for loc in locations}
    assert "Main Stage" in names
    assert "Dance Room" in names


def test_create_list_rehearsal_slot(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director = _login(seeded_client, "director", "director")
    starts, ends = _window()

    locations = seeded_client.get(
        f"/api/productions/{production_id}/locations",
        headers=director,
    ).json()
    assert len(locations) >= 1
    location_id = locations[0]["id"]

    created = seeded_client.post(
        f"/api/productions/{production_id}/rehearsals",
        json={
            "starts_at": starts,
            "ends_at": ends,
            "kind": "called",
            "title": "Thursday blocking",
            "location_id": location_id,
        },
        headers=director,
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "scheduled"
    assert body["kind"] == "called"
    assert body["location_name"] == locations[0]["name"]

    listed = seeded_client.get(
        f"/api/productions/{production_id}/rehearsals",
        headers=director,
    ).json()
    assert len(listed) == 1
    assert listed[0]["title"] == "Thursday blocking"


def test_plan_publish_my_call_and_complete(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    actor_id = _cast_actor(seeded_client, db_session, production_id)
    director = _login(seeded_client, "director", "director")
    actor = _login(seeded_client, "actor", "actor")
    starts, ends = _window()

    acts = seeded_client.get(
        f"/api/productions/{production_id}/acts",
        headers=director,
    ).json()
    scene = acts[0]["scenes"][0]
    scene_id = scene["id"]
    assert scene.get("times_rehearsed", 0) == 0

    create = seeded_client.post(
        f"/api/productions/{production_id}/rehearsals",
        json={"starts_at": starts, "ends_at": ends, "kind": "called"},
        headers=director,
    )
    rehearsal_id = create.json()["id"]

    # Actor can open draft slot but not see call plan yet
    draft = seeded_client.get(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}",
        headers=actor,
    )
    assert draft.status_code == 200
    assert draft.json()["blocks"] == []
    assert draft.json()["notes"] == []

    block_end = (
        datetime.fromisoformat(starts.replace("Z", "+00:00")) + timedelta(hours=1)
    ).isoformat()

    plan = seeded_client.put(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}/plan",
        json={
            "blocks": [
                {
                    "starts_at": starts,
                    "ends_at": block_end,
                    "label": "Love scene",
                    "sort_order": 0,
                    "scene_ids": [scene_id],
                    "user_ids": [actor_id],
                }
            ],
            "mark_planned": True,
        },
        headers=director,
    )
    assert plan.status_code == 200, plan.text
    assert plan.json()["status"] == "planned"
    assert len(plan.json()["blocks"]) == 1
    assert plan.json()["blocks"][0]["calls"][0]["user_id"] == actor_id

    suggestions = seeded_client.get(
        f"/api/productions/{production_id}/rehearsals/suggest-calls",
        params=[("scene_ids", scene_id)],
        headers=director,
    )
    assert suggestions.status_code == 200
    assert any(s["user_id"] == actor_id for s in suggestions.json())

    publish = seeded_client.post(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}/publish",
        headers=director,
    )
    assert publish.status_code == 200
    assert publish.json()["status"] == "published"

    detail = seeded_client.get(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}",
        headers=actor,
    )
    assert detail.status_code == 200

    my_calls = seeded_client.get(
        f"/api/productions/{production_id}/rehearsals/my-calls",
        headers=actor,
    ).json()
    assert len(my_calls) == 1
    assert my_calls[0]["blocks"][0]["label"] == "Love scene"

    note = seeded_client.post(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}/notes",
        json={"content": "Josh moves USL on that line"},
        headers=director,
    )
    assert note.status_code == 201

    opened = seeded_client.post(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}/open",
        headers=director,
    )
    assert opened.json()["status"] == "in_progress"

    completed = seeded_client.post(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}/complete",
        headers=director,
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"

    db_session.expire_all()
    scene_row = db_session.get(Scene, scene_id)
    assert scene_row is not None
    assert scene_row.times_rehearsed == 1
    assert scene_row.last_rehearsed_at is not None

    # Idempotent complete
    again = seeded_client.post(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}/complete",
        headers=director,
    )
    assert again.status_code == 200
    db_session.expire_all()
    assert db_session.get(Scene, scene_id).times_rehearsed == 1

    # Cannot edit plan when completed
    blocked = seeded_client.put(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}/plan",
        json={"blocks": [], "mark_planned": False},
        headers=director,
    )
    assert blocked.status_code == 400

    recs = seeded_client.get(
        f"/api/productions/{production_id}/rehearsals/scene-recommendations",
        headers=director,
    ).json()
    assert recs[0]["id"] != scene_id or recs[0]["times_rehearsed"] >= 1


def test_rehearsal_notes_hidden_from_actors(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    _cast_actor(seeded_client, db_session, production_id)
    director = _login(seeded_client, "director", "director")
    actor = _login(seeded_client, "actor", "actor")
    starts, ends = _window()

    create = seeded_client.post(
        f"/api/productions/{production_id}/rehearsals",
        json={"starts_at": starts, "ends_at": ends, "kind": "called"},
        headers=director,
    )
    rehearsal_id = create.json()["id"]

    seeded_client.post(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}/publish",
        headers=director,
    )
    seeded_client.post(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}/notes",
        json={"content": "Director-only note"},
        headers=director,
    )

    actor_detail = seeded_client.get(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}",
        headers=actor,
    )
    assert actor_detail.status_code == 200
    assert actor_detail.json()["notes"] == []

    director_detail = seeded_client.get(
        f"/api/productions/{production_id}/rehearsals/{rehearsal_id}",
        headers=director,
    )
    assert len(director_detail.json()["notes"]) == 1


def test_actor_list_hides_plan_details_until_published(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    _cast_actor(seeded_client, db_session, production_id)
    director = _login(seeded_client, "director", "director")
    actor = _login(seeded_client, "actor", "actor")
    starts, ends = _window()

    created = seeded_client.post(
        f"/api/productions/{production_id}/rehearsals",
        json={
            "starts_at": starts,
            "ends_at": ends,
            "kind": "all_call",
            "title": "Secret plan",
        },
        headers=director,
    )
    assert created.status_code == 201

    listed = seeded_client.get(
        f"/api/productions/{production_id}/rehearsals",
        headers=actor,
    ).json()
    assert len(listed) == 1
    assert listed[0]["title"] == "Secret plan"
    assert listed[0]["block_count"] == 0
