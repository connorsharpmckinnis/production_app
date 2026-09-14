from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.production_role_defaults import (
    PERMISSION_ACTIONS,
    PRODUCTION_PERMISSION_RESOURCES,
)
from app.db.seed import seed_database
from app.models import Production, ProductionRole, User
from app.services.production_memberships import create_or_reactivate_membership
from app.services.production_roles import create_production_role


def _login(client: TestClient, username: str, password: str = "password") -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _fixture(db: Session, test_settings) -> User:
    seed_database(db, test_settings)
    admin = db.query(User).filter(User.username == "admin").one()
    db.commit()
    return admin


def test_admin_can_create_custom_role_and_assign_it(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    from app.auth.password import hash_password

    admin = _fixture(db_session, test_settings)
    production = Production(organization_id=admin.organization_id, title="Roles Test")
    db_session.add(production)
    db_session.commit()

    admin_headers = _login(client, "admin", "admin")
    created = client.post(
        "/api/settings/production-roles",
        json={
            "name": "Stage Manager",
            "description": "Runs rehearsals and prep",
            "code": "stage_manager",
            "copy_from_role_code": "director",
        },
        headers=admin_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body == {
        "code": "stage_manager",
        "name": "Stage Manager",
        "description": "Runs rehearsals and prep",
        "is_active": True,
        "is_system": False,
    }

    matrix = client.get(
        "/api/settings/production-role-permissions",
        headers=admin_headers,
    )
    assert matrix.status_code == 200
    sm_rows = [
        row for row in matrix.json() if row["role_code"] == "stage_manager"
    ]
    assert len(sm_rows) == len(PRODUCTION_PERMISSION_RESOURCES) * len(PERMISSION_ACTIONS)
    director_enabled = {
        (row["resource"], row["action"])
        for row in matrix.json()
        if row["role_code"] == "director" and row["enabled"]
    }
    sm_enabled = {
        (row["resource"], row["action"])
        for row in sm_rows
        if row["enabled"]
    }
    assert sm_enabled == director_enabled

    roles = client.get("/api/settings/production-roles", headers=admin_headers)
    assert roles.status_code == 200
    codes = {item["code"] for item in roles.json()}
    assert {"member", "director", "actor", "stage_manager"} <= codes

    people_roles = client.get(
        f"/api/productions/{production.id}/people/roles",
        headers=admin_headers,
    )
    assert people_roles.status_code == 200
    assert any(item["code"] == "stage_manager" for item in people_roles.json())

    member = User(
        organization_id=admin.organization_id,
        username="sm-user",
        password_hash=hash_password("password"),
        first_name="Stage",
        last_name="Manager",
        is_active=True,
    )
    db_session.add(member)
    db_session.flush()
    create_or_reactivate_membership(
        db_session,
        production.id,
        member.id,
        ["stage_manager"],
    )
    db_session.commit()

    access = client.get(
        f"/api/productions/{production.id}/access",
        headers=_login(client, "sm-user"),
    )
    assert access.status_code == 200
    assert "stage_manager" in access.json()["role_codes"]
    assert "timeline:update" in access.json()["capabilities"]


def test_create_role_rejects_reserved_and_duplicate_codes(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    _fixture(db_session, test_settings)
    headers = _login(client, "admin", "admin")

    reserved = client.post(
        "/api/settings/production-roles",
        json={"name": "Director Clone", "code": "director"},
        headers=headers,
    )
    assert reserved.status_code == 400

    first = client.post(
        "/api/settings/production-roles",
        json={"name": "Props Lead", "copy_from_role_code": "member"},
        headers=headers,
    )
    assert first.status_code == 201
    assert first.json()["code"] == "props_lead"

    duplicate = client.post(
        "/api/settings/production-roles",
        json={"name": "Props Lead"},
        headers=headers,
    )
    assert duplicate.status_code == 400


def test_cannot_deactivate_system_or_assigned_custom_role(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    from app.auth.password import hash_password

    admin = _fixture(db_session, test_settings)
    headers = _login(client, "admin", "admin")
    created = create_production_role(
        db_session,
        name="ASM",
        code="asm",
        copy_from_role_code="member",
    )
    production = Production(organization_id=admin.organization_id, title="Deactivate Test")
    user = User(
        organization_id=admin.organization_id,
        username="asm-person",
        password_hash=hash_password("password"),
        first_name="A",
        last_name="SM",
        is_active=True,
    )
    db_session.add_all([production, user])
    db_session.flush()
    create_or_reactivate_membership(db_session, production.id, user.id, ["asm"])
    db_session.commit()

    system_block = client.patch(
        "/api/settings/production-roles/director",
        json={"is_active": False},
        headers=headers,
    )
    assert system_block.status_code == 400

    assigned_block = client.patch(
        f"/api/settings/production-roles/{created.code}",
        json={"is_active": False},
        headers=headers,
    )
    assert assigned_block.status_code == 400

    # Reassign away, then deactivate succeeds and hides from People role list.
    create_or_reactivate_membership(db_session, production.id, user.id, ["member"])
    db_session.commit()
    deactivated = client.patch(
        f"/api/settings/production-roles/{created.code}",
        json={"is_active": False},
        headers=headers,
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False

    people_roles = client.get(
        f"/api/productions/{production.id}/people/roles",
        headers=headers,
    )
    assert people_roles.status_code == 200
    assert all(item["code"] != "asm" for item in people_roles.json())

    role = db_session.query(ProductionRole).filter(ProductionRole.code == "asm").one()
    assert role.is_active is False


def test_non_admin_cannot_manage_production_roles(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    from app.auth.password import hash_password

    admin = _fixture(db_session, test_settings)
    user = User(
        organization_id=admin.organization_id,
        username="plain",
        password_hash=hash_password("password"),
        first_name="Plain",
        last_name="User",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    headers = _login(client, "plain")

    assert client.get("/api/settings/production-roles", headers=headers).status_code == 403
    assert (
        client.post(
            "/api/settings/production-roles",
            json={"name": "Nope"},
            headers=headers,
        ).status_code
        == 403
    )
