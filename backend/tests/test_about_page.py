"""About page content API tests."""

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from scoped_test_helpers import seed_database_with_test_users


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database_with_test_users(db_session, test_settings)
    db_session.commit()
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_about_page_get_and_put(seeded_client: TestClient) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")
    director_headers = _login(seeded_client, "director", "director")

    empty = seeded_client.get("/api/settings/about-page", headers=director_headers)
    assert empty.status_code == 200
    assert empty.json() == {"markdown": None, "updated_at": None}

    forbidden = seeded_client.put(
        "/api/settings/about-page",
        json={"markdown": "# Hello"},
        headers=director_headers,
    )
    assert forbidden.status_code == 403

    saved = seeded_client.put(
        "/api/settings/about-page",
        json={"markdown": "# About\n\nSome **markdown**."},
        headers=admin_headers,
    )
    assert saved.status_code == 200
    body = saved.json()
    assert body["markdown"] == "# About\n\nSome **markdown**."
    assert body["updated_at"] is not None

    loaded = seeded_client.get("/api/settings/about-page", headers=director_headers)
    assert loaded.status_code == 200
    assert loaded.json()["markdown"] == "# About\n\nSome **markdown**."


def test_about_image_upload_and_fetch(seeded_client: TestClient) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")
    actor_headers = _login(seeded_client, "actor", "actor")

    # Minimal valid 1x1 PNG
    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    upload = seeded_client.post(
        "/api/settings/about-images",
        headers=admin_headers,
        files={"file": ("dot.png", BytesIO(png_bytes), "image/png")},
    )
    assert upload.status_code == 200
    payload = upload.json()
    assert payload["id"]
    assert payload["url"].endswith(payload["id"])
    assert payload["markdown"].startswith("![image](")

    fetch = seeded_client.get(payload["url"], headers=actor_headers)
    assert fetch.status_code == 200
    assert fetch.headers["content-type"].startswith("image/png")
    assert fetch.content == png_bytes

    forbidden = seeded_client.post(
        "/api/settings/about-images",
        headers=actor_headers,
        files={"file": ("dot.png", BytesIO(png_bytes), "image/png")},
    )
    assert forbidden.status_code == 403
