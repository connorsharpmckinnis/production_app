"""API authentication tests."""

import pytest
from fastapi.testclient import TestClient

from app.db.seed import seed_database


@pytest.fixture
def seeded_client(client: TestClient, db_session, test_settings) -> TestClient:
    seed_database(db_session, test_settings)
    return client


def test_login_success(seeded_client: TestClient) -> None:
    response = seeded_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


def test_login_failure(seeded_client: TestClient) -> None:
    response = seeded_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong"},
    )
    assert response.status_code == 401


def test_me_requires_auth(seeded_client: TestClient) -> None:
    assert seeded_client.get("/api/auth/me").status_code == 401


def test_me_returns_user(seeded_client: TestClient) -> None:
    login = seeded_client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    token = login.json()["access_token"]
    response = seeded_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["username"] == "admin"
    assert "Admin" in response.json()["roles"]


def test_non_admin_cannot_create_production(seeded_client: TestClient) -> None:
    login = seeded_client.post(
        "/api/auth/login",
        json={"username": "director", "password": "director"},
    )
    token = login.json()["access_token"]
    response = seeded_client.post(
        "/api/productions",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Blocked"},
    )
    assert response.status_code == 403
