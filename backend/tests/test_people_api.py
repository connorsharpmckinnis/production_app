from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.db.seed import seed_database
from app.models import (
    Character,
    Organization,
    Production,
    ProductionMembership,
    ProductionRole,
    User,
    UserCharacterAssignment,
)
from app.services.production_memberships import (
    create_or_reactivate_membership,
    deactivate_membership,
)


def _login(client: TestClient, username: str, password: str = "password") -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _user(
    db: Session,
    organization_id: int,
    username: str,
    *,
    is_active: bool = True,
) -> User:
    user = User(
        organization_id=organization_id,
        username=username,
        password_hash=hash_password("password"),
        first_name=username.title(),
        last_name="Person",
        email=f"{username}@example.test",
        is_active=is_active,
    )
    db.add(user)
    db.flush()
    return user


def _production(db: Session, organization_id: int) -> Production:
    production = Production(organization_id=organization_id, title="People Test")
    db.add(production)
    db.flush()
    return production


def _fixture(db: Session, test_settings) -> tuple[User, Production]:
    seed_database(db, test_settings)
    admin = db.query(User).filter(User.username == "admin").one()
    production = _production(db, admin.organization_id)
    db.commit()
    return admin, production


def test_roster_and_candidates_are_scoped_to_active_members(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _fixture(db_session, test_settings)
    member = _user(db_session, admin.organization_id, "member")
    candidate = _user(db_session, admin.organization_id, "candidate")
    inactive_user = _user(
        db_session,
        admin.organization_id,
        "inactive",
        is_active=False,
    )
    membership = create_or_reactivate_membership(
        db_session,
        production.id,
        member.id,
        ["actor"],
    )
    character = Character(production_id=production.id, name="Lead")
    db_session.add(character)
    db_session.flush()
    db_session.add(UserCharacterAssignment(user_id=member.id, character_id=character.id))
    db_session.commit()

    headers = _login(client, "admin", "admin")
    roster = client.get(f"/api/productions/{production.id}/people", headers=headers)
    assert roster.status_code == 200
    assert roster.json() == [
        {
            "user_id": member.id,
            "display_name": "Member Person",
            "email": "member@example.test",
            "is_active": True,
            "roles": [{"code": "actor", "name": "Actor"}],
            "assigned_characters": [{"id": character.id, "name": "Lead"}],
        },
    ]

    candidates = client.get(
        f"/api/productions/{production.id}/people/candidates",
        headers=headers,
    )
    assert candidates.status_code == 200
    assert [item["user_id"] for item in candidates.json()] == [
        candidate.id,
        admin.id,
    ]
    assert inactive_user.id not in [item["user_id"] for item in candidates.json()]
    assert membership.is_active is True


def test_member_can_read_people_roster(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _fixture(db_session, test_settings)
    member = _user(db_session, admin.organization_id, "reader")
    create_or_reactivate_membership(db_session, production.id, member.id, ["member"])
    db_session.commit()

    response = client.get(
        f"/api/productions/{production.id}/people",
        headers=_login(client, "reader"),
    )

    assert response.status_code == 200


def test_role_registry_is_dynamic_and_requires_people_access(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _fixture(db_session, test_settings)
    member = _user(db_session, admin.organization_id, "role-reader")
    create_or_reactivate_membership(db_session, production.id, member.id, ["member"])
    db_session.add(
        ProductionRole(
            code="stage_manager",
            name="Stage Manager",
            description="Production floor lead",
        )
    )
    db_session.commit()

    response = client.get(
        f"/api/productions/{production.id}/people/roles",
        headers=_login(client, "role-reader"),
    )

    assert response.status_code == 200
    roles = response.json()
    assert roles == sorted(roles, key=lambda role: (role["name"], role["code"]))
    assert {"code": "stage_manager", "name": "Stage Manager"} in roles

    outsider = _user(db_session, admin.organization_id, "role-outsider")
    db_session.commit()
    denied = client.get(
        f"/api/productions/{production.id}/people/roles",
        headers=_login(client, "role-outsider"),
    )
    assert denied.status_code == 404


def test_create_multiple_roles_and_reactivate_without_duplicate(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _fixture(db_session, test_settings)
    person = _user(db_session, admin.organization_id, "multi")
    db_session.commit()
    headers = _login(client, "admin", "admin")

    created = client.post(
        f"/api/productions/{production.id}/people",
        json={"user_id": person.id, "role_codes": ["actor", "director"]},
        headers=headers,
    )
    assert created.status_code == 201
    assert [role["code"] for role in created.json()["roles"]] == ["actor", "director"]

    db_session.rollback()
    membership = db_session.query(ProductionMembership).one()
    deactivate_membership(db_session, membership)
    db_session.commit()

    reactivated = client.post(
        f"/api/productions/{production.id}/people",
        json={"user_id": person.id, "role_codes": ["member"]},
        headers=headers,
    )
    assert reactivated.status_code == 201
    assert [role["code"] for role in reactivated.json()["roles"]] == ["member"]
    assert db_session.query(ProductionMembership).count() == 1
    assert reactivated.json()["is_active"] is True


def test_role_update_rejects_roleless_membership_and_deactivation_preserves_rows(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _fixture(db_session, test_settings)
    person = _user(db_session, admin.organization_id, "director")
    membership = create_or_reactivate_membership(
        db_session,
        production.id,
        person.id,
        ["member"],
    )
    db_session.commit()
    headers = _login(client, "admin", "admin")

    updated = client.patch(
        f"/api/productions/{production.id}/people/{person.id}",
        json={"role_codes": ["director", "actor"]},
        headers=headers,
    )
    assert updated.status_code == 200
    assert [role["code"] for role in updated.json()["roles"]] == ["actor", "director"]

    roleless = client.patch(
        f"/api/productions/{production.id}/people/{person.id}",
        json={"role_codes": []},
        headers=headers,
    )
    assert roleless.status_code == 422

    deactivated = client.post(
        f"/api/productions/{production.id}/people/{person.id}/deactivate",
        headers=headers,
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    db_session.refresh(membership)
    assert membership.is_active is False
    assert len(membership.membership_roles) == 2


def test_create_rejects_cross_org_and_inactive_users(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _fixture(db_session, test_settings)
    other_org = Organization(name="Other Organization")
    db_session.add(other_org)
    db_session.flush()
    foreign_user = _user(db_session, other_org.id, "foreign")
    inactive_user = _user(
        db_session,
        admin.organization_id,
        "inactive-person",
        is_active=False,
    )
    db_session.commit()
    headers = _login(client, "admin", "admin")

    for user_id in (foreign_user.id, inactive_user.id):
        response = client.post(
            f"/api/productions/{production.id}/people",
            json={"user_id": user_id, "role_codes": ["member"]},
            headers=headers,
        )
        assert response.status_code == 404


def test_permission_matrix_is_admin_only_and_updates_effective_access(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _fixture(db_session, test_settings)
    member = _user(db_session, admin.organization_id, "matrix-member")
    create_or_reactivate_membership(db_session, production.id, member.id, ["member"])
    db_session.commit()

    member_headers = _login(client, "matrix-member")
    assert (
        client.get(
            "/api/settings/production-role-permissions",
            headers=member_headers,
        ).status_code
        == 403
    )

    admin_headers = _login(client, "admin", "admin")
    matrix = client.get(
        "/api/settings/production-role-permissions",
        headers=admin_headers,
    )
    assert matrix.status_code == 200
    rows = matrix.json()
    assert len(rows) == 3 * 22 * 4
    assert rows[0]["role_code"] == "actor"

    update = client.put(
        "/api/settings/production-role-permissions",
        json={
            "permissions": [
                {
                    "role_code": "member",
                    "resource": "people",
                    "action": "read",
                    "enabled": False,
                }
            ]
        },
        headers=admin_headers,
    )
    assert update.status_code == 200
    assert (
        client.get(
            f"/api/productions/{production.id}/people",
            headers=member_headers,
        ).status_code
        == 403
    )
