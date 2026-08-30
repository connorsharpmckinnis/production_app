from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.db.seed import seed_database
from app.models import (
    Organization,
    Production,
    ProductionRole,
    ProductionRolePermission,
    User,
)
from app.services.production_memberships import (
    create_or_reactivate_membership,
    deactivate_membership,
    effective_permissions,
)


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _user(db: Session, organization_id: int, username: str) -> User:
    user = User(
        organization_id=organization_id,
        username=username,
        password_hash=hash_password("password"),
        first_name=username,
        last_name="Test",
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _production(db: Session, organization_id: int, title: str) -> Production:
    production = Production(organization_id=organization_id, title=title)
    db.add(production)
    db.flush()
    return production


def _seeded_access_fixture(db: Session, test_settings) -> tuple[User, Production]:
    seed_database(db, test_settings)
    admin = db.query(User).filter(User.username == "admin").one()
    production = _production(db, admin.organization_id, "Access Test")
    db.commit()
    return admin, production


def test_admin_sees_all_same_org_productions_but_not_other_org(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, first = _seeded_access_fixture(db_session, test_settings)
    second = _production(db_session, admin.organization_id, "Second Show")
    other_org = Organization(name="Other Organization")
    db_session.add(other_org)
    db_session.flush()
    _production(db_session, other_org.id, "Other Show")
    db_session.commit()

    response = client.get("/api/productions", headers=_login(client, "admin", "admin"))

    assert response.status_code == 200
    assert {item["id"] for item in response.json()} == {first.id, second.id}


def test_unassigned_user_sees_no_productions_and_get_is_404(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _seeded_access_fixture(db_session, test_settings)
    _user(db_session, admin.organization_id, "unassigned")
    db_session.commit()

    headers = _login(client, "unassigned", "password")
    assert client.get("/api/productions", headers=headers).json() == []
    assert client.get(f"/api/productions/{production.id}", headers=headers).status_code == 404


def test_active_member_sees_production_before_casting(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _seeded_access_fixture(db_session, test_settings)
    member = _user(db_session, admin.organization_id, "member")
    create_or_reactivate_membership(db_session, production.id, member.id, ["member"])
    db_session.commit()

    headers = _login(client, "member", "password")
    listed = client.get("/api/productions", headers=headers)
    detail = client.get(f"/api/productions/{production.id}", headers=headers)

    assert [item["id"] for item in listed.json()] == [production.id]
    assert detail.status_code == 200


def test_inactive_membership_loses_production_access(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _seeded_access_fixture(db_session, test_settings)
    member = _user(db_session, admin.organization_id, "inactive-member")
    membership = create_or_reactivate_membership(
        db_session,
        production.id,
        member.id,
        ["member"],
    )
    deactivate_membership(db_session, membership)
    db_session.commit()

    headers = _login(client, "inactive-member", "password")
    assert client.get("/api/productions", headers=headers).json() == []
    assert client.get(f"/api/productions/{production.id}", headers=headers).status_code == 404


def test_multiple_production_roles_union_capabilities(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _seeded_access_fixture(db_session, test_settings)
    member = _user(db_session, admin.organization_id, "multi-role")
    membership = create_or_reactivate_membership(
        db_session,
        production.id,
        member.id,
        ["member", "actor"],
    )

    permissions = effective_permissions(db_session, membership)

    assert ("production", "read") in permissions
    assert ("notes", "create") in permissions


def test_disabled_capability_returns_403_for_active_member(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, production = _seeded_access_fixture(db_session, test_settings)
    member = _user(db_session, admin.organization_id, "limited-member")
    create_or_reactivate_membership(db_session, production.id, member.id, ["member"])
    member_role = (
        db_session.query(ProductionRole)
        .filter(ProductionRole.code == "member")
        .one()
    )
    permission = (
        db_session.query(ProductionRolePermission)
        .filter_by(
            production_role_id=member_role.id,
            resource="production",
            action="read",
        )
        .one()
    )
    permission.enabled = False
    db_session.commit()

    response = client.get(
        f"/api/productions/{production.id}",
        headers=_login(client, "limited-member", "password"),
    )

    assert response.status_code == 403


def test_other_org_production_id_returns_404(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    admin, _ = _seeded_access_fixture(db_session, test_settings)
    other_org = Organization(name="Other Organization")
    db_session.add(other_org)
    db_session.flush()
    other_production = _production(db_session, other_org.id, "Private Show")
    db_session.commit()

    response = client.get(
        f"/api/productions/{other_production.id}",
        headers=_login(client, "admin", "admin"),
    )

    assert response.status_code == 404
