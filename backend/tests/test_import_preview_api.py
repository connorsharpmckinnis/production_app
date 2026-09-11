import json

import pymupdf
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Act, Moment
from app.services.import_profiles import lifehouse_profile_definition
from scoped_test_helpers import seed_database_with_test_users


@pytest.fixture
def seeded_client(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> TestClient:
    seed_database_with_test_users(db_session, test_settings)
    db_session.commit()
    return client


def _headers(client: TestClient) -> dict[str, str]:
    login = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _mapped_pdf() -> bytes:
    document = pymupdf.open()
    page = document.new_page(width=612, height=792)
    page.insert_text((72, 80), "ACT I", fontname="hebo", fontsize=14)
    page.insert_text(
        (72, 110),
        "SCENE 1: LONDON TOWN SQUARE",
        fontname="hebo",
        fontsize=12,
    )
    page.insert_text(
        (160, 140),
        "(As the overture begins.)",
        fontname="heit",
        fontsize=11,
    )
    page.insert_text((72, 170), "Storyteller", fontsize=11)
    page.insert_text((220, 170), "The fog rolls in.", fontsize=11)
    page.insert_text((72, 200), 'SONG: "WELCOME"', fontname="hebo", fontsize=11)
    page.insert_text((72, 230), "Carolers (A)", fontsize=11)
    page.insert_text((220, 230), "Welcome one and all!", fontsize=11)
    page.insert_text((300, 740), "1", fontsize=9)
    return document.tobytes()


def _profile_json() -> str:
    profile = lifehouse_profile_definition()
    profile.pdf.start_page = 1
    return json.dumps(profile.model_dump(mode="json"))


def test_preview_uses_inline_draft_and_writes_no_timeline_rows(
    seeded_client: TestClient,
    db_session: Session,
):
    headers = _headers(seeded_client)
    production = seeded_client.post(
        "/api/productions",
        headers=headers,
        json={"title": "Preview Show"},
    ).json()

    response = seeded_client.post(
        f"/api/productions/{production['id']}/import/preview",
        headers=headers,
        files={"file": ("script.pdf", _mapped_pdf(), "application/pdf")},
        data={"profile": _profile_json(), "page_from": "1", "page_to": "1"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["counts"] == {
        "acts": 1,
        "scenes": 1,
        "moments": 4,
        "characters": 2,
        "unclassified": 0,
    }
    assert [
        moment["type"]
        for moment in body["acts"][0]["scenes"][0]["moments"]
    ] == ["stage_direction", "dialogue", "song_header", "lyric"]
    dialogue = body["acts"][0]["scenes"][0]["moments"][1]
    assert dialogue["x0"] is not None
    assert dialogue["y0"] is not None
    # Right-column dialogue should sit well right of the speaker margin.
    assert dialogue["x0"] >= 130
    assert db_session.query(Act).count() == 0
    assert db_session.query(Moment).count() == 0


def test_commit_uses_same_inline_profile_draft(
    seeded_client: TestClient,
    db_session: Session,
):
    headers = _headers(seeded_client)
    production = seeded_client.post(
        "/api/productions",
        headers=headers,
        json={"title": "Commit Show"},
    ).json()

    response = seeded_client.post(
        f"/api/productions/{production['id']}/import",
        headers=headers,
        files={"file": ("script.pdf", _mapped_pdf(), "application/pdf")},
        data={"profile": _profile_json()},
    )

    assert response.status_code == 200, response.text
    assert response.json()["moments_created"] == 4
    assert db_session.query(Act).count() == 1
    assert db_session.query(Moment).count() == 4

