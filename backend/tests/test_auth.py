"""API authentication tests."""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.auth.dependencies import require_role
from app.models import User
from scoped_test_helpers import seed_database_with_test_users


@pytest.fixture
def seeded_client(client: TestClient, db_session, test_settings) -> TestClient:
    seed_database_with_test_users(db_session, test_settings)
    db_session.commit()
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


def test_require_role_allows_global_admin(db_session, test_settings) -> None:
    seed_database_with_test_users(db_session, test_settings)
    admin = db_session.query(User).filter(User.username == "admin").one()
    checker = require_role("Admin")
    assert checker(user=admin) is admin


def test_require_role_allows_any_of_multiple_roles(db_session, test_settings) -> None:
    seed_database_with_test_users(db_session, test_settings)
    admin = db_session.query(User).filter(User.username == "admin").first()
    checker = require_role("Admin", "Other")
    assert checker(user=admin) is admin


def test_require_role_denies_missing_role(db_session, test_settings) -> None:
    seed_database_with_test_users(db_session, test_settings)
    actor = db_session.query(User).filter(User.username == "actor").first()
    assert actor is not None
    assert actor.app_roles == []
    checker = require_role("Admin")
    with pytest.raises(HTTPException) as exc_info:
        checker(user=actor)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Admin access required"


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


def _login(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_act_as_requires_admin(seeded_client: TestClient, db_session) -> None:
    from app.models import User

    ordinary_user = db_session.query(User).filter(User.username == "actor").one()
    token = _login(seeded_client, "director", "director")
    response = seeded_client.post(
        "/api/auth/act-as",
        headers={"Authorization": f"Bearer {token}"},
        json={"user_id": ordinary_user.id},
    )
    assert response.status_code == 403


def test_act_as_and_stop_act_as(seeded_client: TestClient, db_session) -> None:
    from app.models import User

    ordinary_user = db_session.query(User).filter(User.username == "actor").one()
    admin_token = _login(seeded_client, "admin", "admin")

    act = seeded_client.post(
        "/api/auth/act-as",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"user_id": ordinary_user.id},
    )
    assert act.status_code == 200
    act_token = act.json()["access_token"]

    me = seeded_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {act_token}"},
    )
    assert me.status_code == 200
    body = me.json()
    assert body["username"] == "actor"
    assert body["roles"] == []
    assert body["impersonation"]["original_username"] == "admin"

    # Nested act-as must be blocked while impersonating.
    nested = seeded_client.post(
        "/api/auth/act-as",
        headers={"Authorization": f"Bearer {act_token}"},
        json={"user_id": ordinary_user.id},
    )
    assert nested.status_code == 403

    stop = seeded_client.post(
        "/api/auth/stop-act-as",
        headers={"Authorization": f"Bearer {act_token}"},
    )
    assert stop.status_code == 200
    restored = stop.json()["access_token"]

    me_again = seeded_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {restored}"},
    )
    assert me_again.status_code == 200
    restored_body = me_again.json()
    assert restored_body["username"] == "admin"
    assert restored_body["impersonation"] is None


def test_stop_act_as_without_impersonation(seeded_client: TestClient) -> None:
    token = _login(seeded_client, "admin", "admin")
    response = seeded_client.post(
        "/api/auth/stop-act-as",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
