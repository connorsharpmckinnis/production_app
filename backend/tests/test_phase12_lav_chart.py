"""Phase 12 — wires/packs catalogs and lav chart propose/save."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Production
from app.services.importer.importer import import_script

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database(db_session, test_settings)
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _empty_production(client: TestClient) -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "Lav Empty", "season": "2026"},
        headers=headers,
    )
    return create.json()["id"]


def _imported_production(client: TestClient, db_session: Session, title: str = "Lav Chart Show") -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": title, "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    content = FIXTURE_PATH.read_text(encoding="utf-8")
    import_script(db_session, production, content)
    return production_id


def test_wires_and_packs_catalog_crud(seeded_client: TestClient) -> None:
    production_id = _empty_production(seeded_client)
    headers = _login(seeded_client, "director", "director")

    wire = seeded_client.post(
        f"/api/productions/{production_id}/wires",
        json={"identifier": "Wire 1", "notes": "face tape"},
        headers=headers,
    )
    assert wire.status_code == 201
    assert wire.json()["identifier"] == "Wire 1"
    wire_id = wire.json()["id"]

    pack = seeded_client.post(
        f"/api/productions/{production_id}/packs",
        json={"identifier": "Pack A"},
        headers=headers,
    )
    assert pack.status_code == 201
    pack_id = pack.json()["id"]

    wires = seeded_client.get(f"/api/productions/{production_id}/wires", headers=headers)
    packs = seeded_client.get(f"/api/productions/{production_id}/packs", headers=headers)
    assert wires.status_code == 200
    assert packs.status_code == 200
    assert wires.json()[0]["notes"] == "face tape"
    assert packs.json()[0]["identifier"] == "Pack A"

    patched = seeded_client.patch(
        f"/api/productions/{production_id}/wires/{wire_id}",
        json={"notes": "refit"},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["notes"] == "refit"

    deleted = seeded_client.delete(
        f"/api/productions/{production_id}/packs/{pack_id}",
        headers=headers,
    )
    assert deleted.status_code == 204


def test_lav_chart_propose_and_save(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director = _login(seeded_client, "director", "director")
    admin = _login(seeded_client, "admin", "admin")

    # Tight inventory: one wire and one pack → shortfall / uncovered need flags expected.
    seeded_client.post(
        f"/api/productions/{production_id}/wires",
        json={"identifier": "W1"},
        headers=director,
    )
    seeded_client.post(
        f"/api/productions/{production_id}/packs",
        json={"identifier": "P1"},
        headers=director,
    )

    chart = seeded_client.get(f"/api/productions/{production_id}/lav-chart", headers=director)
    assert chart.status_code == 200
    body = chart.json()
    assert len(body["scenes"]) >= 1
    assert len(body["rows"]) >= 2
    assert body["rules"]
    assert body["wires"][0]["identifier"] == "W1"
    assert any(row["label"].startswith("Uncast") for row in body["rows"])

    proposed = seeded_client.post(
        f"/api/productions/{production_id}/lav-chart/propose",
        json={"sheets": ["wires", "packs"]},
        headers=director,
    )
    assert proposed.status_code == 200
    proposed_body = proposed.json()
    assert proposed_body["wire_cells"] or proposed_body["issues"]
    codes = {issue["code"] for issue in proposed_body["issues"]}
    assert "mid_act_required" in codes or "missing_wire" in codes or "missing_pack" in codes

    # Manual save: clear then set a single wire cell.
    row_key = proposed_body["rows"][0]["row_key"]
    scene_id = proposed_body["scenes"][0]["id"]
    wire_id = proposed_body["wires"][0]["id"]
    saved = seeded_client.put(
        f"/api/productions/{production_id}/lav-chart",
        json={
            "wire_cells": [
                {"row_key": row_key, "scene_id": scene_id, "wire_id": wire_id},
            ],
            "pack_cells": [],
        },
        headers=director,
    )
    assert saved.status_code == 200
    assert len(saved.json()["wire_cells"]) == 1
    assert saved.json()["wire_cells"][0]["wire_id"] == wire_id

    # Actor cannot access lav chart.
    actor_headers = _login(seeded_client, "actor", "actor")
    denied = seeded_client.get(
        f"/api/productions/{production_id}/lav-chart",
        headers=actor_headers,
    )
    assert denied.status_code == 403

    # Admin can still read.
    admin_chart = seeded_client.get(
        f"/api/productions/{production_id}/lav-chart",
        headers=admin,
    )
    assert admin_chart.status_code == 200


def test_lav_chart_propose_covers_when_inventory_enough(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Lav Plenty")
    director = _login(seeded_client, "director", "director")

    chart = seeded_client.get(f"/api/productions/{production_id}/lav-chart", headers=director)
    rows = chart.json()["rows"]
    assert rows
    for index in range(len(rows) + 1):
        seeded_client.post(
            f"/api/productions/{production_id}/wires",
            json={"identifier": f"W{index + 1}"},
            headers=director,
        )
        seeded_client.post(
            f"/api/productions/{production_id}/packs",
            json={"identifier": f"P{index + 1}"},
            headers=director,
        )

    proposed = seeded_client.post(
        f"/api/productions/{production_id}/lav-chart/propose",
        json={"sheets": ["wires", "packs"]},
        headers=director,
    )
    assert proposed.status_code == 200
    body = proposed.json()
    missing = [i for i in body["issues"] if i["code"] in {"missing_wire", "missing_pack", "mid_act_required"}]
    assert missing == []
    assert body["wire_cells"]
    assert body["pack_cells"]
