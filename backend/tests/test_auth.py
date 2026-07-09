"""API authentication tests."""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth.dependencies import require_role
from app.db.seed import seed_database
from app.models import User


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


def test_require_role_allows_matching_user(db_session, test_settings) -> None:
    seed_database(db_session, test_settings)
    director = db_session.query(User).filter(User.username == "director").first()
    checker = require_role("Director")
    assert checker(user=director) is director


def test_require_role_allows_any_of_multiple_roles(db_session, test_settings) -> None:
    seed_database(db_session, test_settings)
    admin = db_session.query(User).filter(User.username == "admin").first()
    checker = require_role("Admin", "Director")
    assert checker(user=admin) is admin


def test_require_role_denies_missing_role(db_session, test_settings) -> None:
    seed_database(db_session, test_settings)
    actor = db_session.query(User).filter(User.username == "actor").first()
    checker = require_role("Director")
    with pytest.raises(HTTPException) as exc_info:
        checker(user=actor)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Director access required"


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
