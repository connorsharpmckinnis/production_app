"""Phase 8 WP4/WP5: catalog CSV import and templates."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Production
from app.services.catalog_csv import MAX_CSV_BYTES
from app.services.importer import import_script
from scoped_test_helpers import add_test_production_memberships, seed_database_with_test_users

FIXTURE_SCRIPT = Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"
CATALOG_FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "catalogs"

ASSET_SPECS = {
    "props": {
        "path": "props",
        "fixture": "props.csv",
        "list_path": "props",
        "key_field": "name",
        "happy_count": 3,
        "required_header": "name",
        "template_headers": "name,description,notes",
        "needs_import": False,
        "sample_row": "Rope,,\n",
        "duplicate_csv": "name,description,notes\nRope,,\n",
        "same_file_dup": "name,description,notes\nWidget,,\nwidget,,\n",
        "row_error_csv": "name,description,notes\n,,\nGood Prop,,\n",
        "unknown_csv": "name,description,notes,extra\nAlpha,,,\n",
        "created_after_partial": 1,
    },
    "set-pieces": {
        "path": "set-pieces",
        "fixture": "set_pieces.csv",
        "list_path": "set-pieces",
        "key_field": "name",
        "happy_count": 3,
        "required_header": "name",
        "template_headers": "name,mobile,description",
        "needs_import": False,
        "sample_row": "Platform Z,false,\n",
        "duplicate_csv": "name,mobile,description\nPlatform A,true,\n",
        "same_file_dup": "name,mobile,description\nUnit One,1,\nunit one,0,\n",
        "row_error_csv": "name,mobile,description\nBad Unit,maybe,\nGood Unit,true,\n",
        "unknown_csv": "name,mobile,description,weight\nUnit Q,false,,\n",
        "created_after_partial": 1,
    },
    "songs": {
        "path": "songs",
        "fixture": "songs.csv",
        "list_path": "songs",
        "key_field": "title",
        "happy_count": 2,
        "required_header": "title",
        "template_headers": "title,composer,lyricist,description",
        "needs_import": False,
        "sample_row": "Brand New Song,,,\n",
        "duplicate_csv": "title,composer,lyricist,description\nPilot Underscore,,,\n",
        "same_file_dup": "title,composer,lyricist,description\nSolo Number,,,\nsolo number,,,\n",
        "row_error_csv": "title,composer,lyricist,description\n,,,\nValid Song,,,\n",
        "unknown_csv": "title,composer,lyricist,description,bpm\nTempo Song,,,,\n",
        "created_after_partial": 1,
    },
    "cue-categories": {
        "path": "cue-categories",
        "fixture": "cue_categories.csv",
        "list_path": "cue-categories",
        "key_field": "name",
        "happy_count": 3,
        "required_header": "name",
        "template_headers": "name,description",
        "needs_import": False,
        "sample_row": "Pyro,\n",
        "duplicate_csv": "name,description\nSound,\n",
        "same_file_dup": "name,description\nFog,\nfog,\n",
        "row_error_csv": "name,description\n,\nValid Cat,\n",
        "unknown_csv": "name,description,color\nVideo,,\n",
        "created_after_partial": 1,
    },
}


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database_with_test_users(db_session, test_settings)
    db_session.commit()
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _empty_production(
    client: TestClient,
    db_session: Session,
    *,
    include_director: bool = True,
    include_actor: bool = True,
) -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "Catalog CSV Show", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    add_test_production_memberships(
        db_session,
        production_id,
        include_director=include_director,
        include_actor=include_actor,
    )
    db_session.commit()
    return production_id


def _imported_production(client: TestClient, db_session: Session) -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "Costume CSV Show", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    add_test_production_memberships(db_session, production)
    db_session.commit()
    import_script(db_session, production, FIXTURE_SCRIPT.read_bytes())
    return production_id


def _upload(
    client: TestClient,
    url: str,
    content: bytes | str,
    headers: dict[str, str],
    filename: str = "data.csv",
):
    data = content.encode("utf-8") if isinstance(content, str) else content
    return client.post(
        url,
        headers=headers,
        files={"file": (filename, BytesIO(data), "text/csv")},
    )


def _production_for_asset(
    client: TestClient,
    db_session: Session,
    needs_import: bool,
) -> int:
    if needs_import:
        return _imported_production(client, db_session)
    return _empty_production(client, db_session)


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_happy_path(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    fixture = (CATALOG_FIXTURES / spec["fixture"]).read_bytes()

    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/{spec['path']}/import",
        fixture,
        headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == spec["happy_count"]
    assert body["skipped"] == 0
    assert body["errors"] == []
    assert body["warnings"] == []

    listed = seeded_client.get(
        f"/api/productions/{production_id}/{spec['list_path']}",
        headers=headers,
    ).json()
    keys = {item[spec["key_field"]] for item in listed}
    # songs may already exist from script import on other tests; this path uses empty prod
    assert body["created"] <= len(keys)


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_skips_existing_duplicate(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    fixture = (CATALOG_FIXTURES / spec["fixture"]).read_bytes()
    url = f"/api/productions/{production_id}/{spec['path']}/import"

    first = _upload(seeded_client, url, fixture, headers)
    assert first.status_code == 200
    assert first.json()["created"] == spec["happy_count"]

    second = _upload(seeded_client, url, fixture, headers)
    assert second.status_code == 200
    body = second.json()
    assert body["created"] == 0
    assert body["skipped"] == spec["happy_count"]
    assert body["errors"] == []


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_skips_same_file_duplicate(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/{spec['path']}/import",
        spec["same_file_dup"],
        headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 1
    assert body["skipped"] == 1
    assert body["errors"] == []


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_row_errors_partial_success(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/{spec['path']}/import",
        spec["row_error_csv"],
        headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == spec["created_after_partial"]
    assert len(body["errors"]) == 1
    assert body["errors"][0]["row"] == 2


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_unknown_column_warning(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/{spec['path']}/import",
        spec["unknown_csv"],
        headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 1
    assert len(body["warnings"]) == 1
    assert "Ignored unknown column(s):" in body["warnings"][0]


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_utf8_bom(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    content = b"\xef\xbb\xbf" + (spec["template_headers"] + "\n" + spec["sample_row"]).encode(
        "utf-8"
    )
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/{spec['path']}/import",
        content,
        headers,
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_rejects_invalid_utf8(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/{spec['path']}/import",
        b"\xff\xfe" + b"not-utf8",
        headers,
    )
    assert response.status_code == 400
    assert "UTF-8" in response.json()["detail"]


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_rejects_oversize(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    payload = b"x" * (MAX_CSV_BYTES + 1)
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/{spec['path']}/import",
        payload,
        headers,
    )
    assert response.status_code == 400
    assert "1 MiB" in response.json()["detail"]


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_rejects_missing_required_header(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/{spec['path']}/import",
        "not_the_header\nvalue\n",
        headers,
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "Missing required CSV header" in detail
    assert spec["required_header"] in detail


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_import_actor_forbidden(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "actor", "actor")
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/{spec['path']}/import",
        (CATALOG_FIXTURES / spec["fixture"]).read_bytes(),
        headers,
    )
    assert response.status_code == 403


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_template_download(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "director", "director")
    response = seeded_client.get(
        f"/api/productions/{production_id}/{spec['path']}/import/template",
        headers=headers,
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert response.text.strip() == spec["template_headers"]


@pytest.mark.parametrize("asset_key", list(ASSET_SPECS.keys()))
def test_catalog_template_actor_can_read(
    seeded_client: TestClient,
    db_session: Session,
    asset_key: str,
) -> None:
    spec = ASSET_SPECS[asset_key]
    production_id = _production_for_asset(seeded_client, db_session, spec["needs_import"])
    headers = _login(seeded_client, "actor", "actor")
    response = seeded_client.get(
        f"/api/productions/{production_id}/{spec['path']}/import/template",
        headers=headers,
    )
    assert response.status_code == 200


def test_case_insensitive_headers(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _empty_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/props/import",
        "Name,DESCRIPTION,Notes\nHat,Felt,Shelf\n",
        headers,
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1


def test_set_piece_mobile_values(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _empty_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    csv_body = (
        "name,mobile,description\n"
        "A,TRUE,\n"
        "B,False,\n"
        "C,1,\n"
        "D,0,\n"
        "E,,\n"
    )
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/set-pieces/import",
        csv_body,
        headers,
    )
    assert response.status_code == 200
    assert response.json()["created"] == 5
    listed = seeded_client.get(
        f"/api/productions/{production_id}/set-pieces",
        headers=headers,
    ).json()
    by_name = {item["name"]: item["mobile"] for item in listed}
    assert by_name["A"] is True
    assert by_name["B"] is False
    assert by_name["C"] is True
    assert by_name["D"] is False
    assert by_name["E"] is False


def test_costume_import_happy_path(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    fixture = (CATALOG_FIXTURES / "costumes.csv").read_bytes()
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/costumes/import",
        fixture,
        headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == 2
    assert body["skipped"] == 0
    assert body["errors"] == []

    listed = seeded_client.get(
        f"/api/productions/{production_id}/costumes",
        headers=headers,
    ).json()
    names = {item["name"] for item in listed}
    assert "Parka" in names
    assert "Expedition Kit" in names


def test_costume_import_skips_duplicate(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    url = f"/api/productions/{production_id}/costumes/import"
    fixture = (CATALOG_FIXTURES / "costumes.csv").read_bytes()
    assert _upload(seeded_client, url, fixture, headers).json()["created"] == 2
    second = _upload(seeded_client, url, fixture, headers)
    assert second.json()["created"] == 0
    assert second.json()["skipped"] == 2


def test_costume_import_same_file_duplicate(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    csv_body = (
        "name,character,description\n"
        "Coat,SHACKLETON,\n"
        "coat,shackleton,\n"
    )
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/costumes/import",
        csv_body,
        headers,
    )
    assert response.status_code == 200
    assert response.json()["created"] == 1
    assert response.json()["skipped"] == 1


def test_costume_unknown_character(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    csv_body = "name,character,description\nCoat,NOT A CHARACTER,\n"
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/costumes/import",
        csv_body,
        headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 0
    assert body["errors"][0]["row"] == 2
    assert "Unknown character" in body["errors"][0]["message"]


def test_costume_same_name_different_character_both_created(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    """Dedupe key is (name, character_id), so the same look name can exist per-character."""
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    csv_body = (
        "name,character,description\n"
        "Coat,SHACKLETON,\n"
        "Coat,CREAN,\n"
    )
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/costumes/import",
        csv_body,
        headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["created"] == 2
    assert body["skipped"] == 0


def test_costume_template_actor_can_read_but_cannot_import(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director = _login(seeded_client, "director", "director")
    actor = _login(seeded_client, "actor", "actor")

    template = seeded_client.get(
        f"/api/productions/{production_id}/costumes/import/template",
        headers=director,
    )
    assert template.status_code == 200
    assert template.text.strip() == "name,character,description"

    forbidden = _upload(
        seeded_client,
        f"/api/productions/{production_id}/costumes/import",
        (CATALOG_FIXTURES / "costumes.csv").read_bytes(),
        actor,
    )
    assert forbidden.status_code == 403

    actor_template = seeded_client.get(
        f"/api/productions/{production_id}/costumes/import/template",
        headers=actor,
    )
    assert actor_template.status_code == 200


def test_costume_unknown_column_warning(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    csv_body = (
        "name,character,description,moment_id\n"
        "Coat,SHACKLETON,,99\n"
    )
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/costumes/import",
        csv_body,
        headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["created"] == 1
    assert "moment_id" in body["warnings"][0]


def test_admin_can_import_props(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _empty_production(
        seeded_client,
        db_session,
        include_director=False,
        include_actor=False,
    )
    headers = _login(seeded_client, "admin", "admin")
    response = _upload(
        seeded_client,
        f"/api/productions/{production_id}/props/import",
        (CATALOG_FIXTURES / "props.csv").read_bytes(),
        headers,
    )
    assert response.status_code == 200
    assert response.json()["created"] == 3
