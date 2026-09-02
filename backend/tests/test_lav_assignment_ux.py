"""Lav assignment UX: row locks and propose sheet overwrite."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Production
from app.services.importer.importer import import_script
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


def _imported_production(client: TestClient, db_session: Session, title: str = "Lav UX Show") -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": title, "season": "2026"},
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


def _seed_inventory(client: TestClient, production_id: int, headers: dict[str, str], count: int) -> None:
    for index in range(count):
        client.post(
            f"/api/productions/{production_id}/wires",
            json={"identifier": f"W{index + 1}"},
            headers=headers,
        )
        client.post(
            f"/api/productions/{production_id}/packs",
            json={"identifier": f"P{index + 1}"},
            headers=headers,
        )


def test_save_locked_row_keys_persist_and_get_returns_them(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director = _login(seeded_client, "director", "director")

    chart = seeded_client.get(f"/api/productions/{production_id}/lav-chart", headers=director)
    rows = chart.json()["rows"]
    assert len(rows) >= 2
    locked = [rows[0]["row_key"]]

    saved = seeded_client.put(
        f"/api/productions/{production_id}/lav-chart",
        json={"wire_cells": [], "pack_cells": [], "locked_row_keys": locked},
        headers=director,
    )
    assert saved.status_code == 200
    assert saved.json()["locked_row_keys"] == locked

    fetched = seeded_client.get(f"/api/productions/{production_id}/lav-chart", headers=director)
    assert fetched.status_code == 200
    assert fetched.json()["locked_row_keys"] == locked


def test_save_without_locked_row_keys_leaves_locks_unchanged(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Lav Lock Stable")
    director = _login(seeded_client, "director", "director")

    chart = seeded_client.get(f"/api/productions/{production_id}/lav-chart", headers=director)
    row_key = chart.json()["rows"][0]["row_key"]

    seeded_client.put(
        f"/api/productions/{production_id}/lav-chart",
        json={"wire_cells": [], "pack_cells": [], "locked_row_keys": [row_key]},
        headers=director,
    )

    saved = seeded_client.put(
        f"/api/productions/{production_id}/lav-chart",
        json={"wire_cells": [], "pack_cells": []},
        headers=director,
    )
    assert saved.status_code == 200
    assert saved.json()["locked_row_keys"] == [row_key]


def test_propose_overwrites_existing_including_locked_rows(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Lav Overwrite")
    director = _login(seeded_client, "director", "director")

    chart = seeded_client.get(f"/api/productions/{production_id}/lav-chart", headers=director)
    body = chart.json()
    rows = body["rows"]
    scenes = body["scenes"]
    assert len(rows) >= 2
    locked_row = rows[0]["row_key"]
    unlocked_row = rows[1]["row_key"]
    scene_id = scenes[0]["id"]

    _seed_inventory(seeded_client, production_id, director, len(rows) + 1)
    chart = seeded_client.get(f"/api/productions/{production_id}/lav-chart", headers=director)
    wires = chart.json()["wires"]
    wire_id = wires[0]["id"]

    seeded_client.put(
        f"/api/productions/{production_id}/lav-chart",
        json={
            "wire_cells": [
                {"row_key": unlocked_row, "scene_id": scene_id, "wire_id": wire_id},
            ],
            "pack_cells": [],
            "locked_row_keys": [locked_row],
        },
        headers=director,
    )

    # Default propose fully replaces the wire sheet (and packs when requested).
    proposed = seeded_client.post(
        f"/api/productions/{production_id}/lav-chart/propose",
        json={"sheets": ["wires", "packs"]},
        headers=director,
    )
    assert proposed.status_code == 200
    result = proposed.json()

    wire_by_row: dict[str, list[dict]] = {}
    for cell in result["wire_cells"]:
        wire_by_row.setdefault(cell["row_key"], []).append(cell)

    # Locked and unlocked rows both receive proposed wires when inventory allows.
    assert locked_row in wire_by_row
    assert unlocked_row in wire_by_row
    assert result["pack_cells"]
    # Locks remain stored even though propose overwrote their cells.
    assert locked_row in result["locked_row_keys"]


def test_propose_packs_only_leaves_wires_unchanged(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Lav Sheet Scope")
    director = _login(seeded_client, "director", "director")

    chart = seeded_client.get(f"/api/productions/{production_id}/lav-chart", headers=director)
    body = chart.json()
    row_key = body["rows"][0]["row_key"]
    scene_id = body["scenes"][0]["id"]

    _seed_inventory(seeded_client, production_id, director, 3)
    chart = seeded_client.get(f"/api/productions/{production_id}/lav-chart", headers=director)
    wire_id = chart.json()["wires"][0]["id"]

    seeded_client.put(
        f"/api/productions/{production_id}/lav-chart",
        json={
            "wire_cells": [
                {"row_key": row_key, "scene_id": scene_id, "wire_id": wire_id},
            ],
            "pack_cells": [],
        },
        headers=director,
    )

    proposed = seeded_client.post(
        f"/api/productions/{production_id}/lav-chart/propose",
        json={"sheets": ["packs"]},
        headers=director,
    )
    assert proposed.status_code == 200
    result = proposed.json()

    wire_cells = [
        c for c in result["wire_cells"] if c["row_key"] == row_key and c["scene_id"] == scene_id
    ]
    assert len(wire_cells) == 1
    assert wire_cells[0]["wire_id"] == wire_id
    assert result["pack_cells"]
