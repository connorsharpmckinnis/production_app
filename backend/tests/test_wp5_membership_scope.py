from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.db.seed import seed_database
from app.models import Group, Notification, Organization, Production, User
from app.services.notifications import build_inbox, resolve_audience_user_ids
from app.services.production_memberships import (
    create_or_reactivate_membership,
    deactivate_membership,
)


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


def _login(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_production_audience_uses_active_membership_role_codes(
    db_session: Session,
    test_settings,
) -> None:
    seed_database(db_session, test_settings)
    organization = db_session.query(Organization).one()
    production = Production(organization_id=organization.id, title="Audience Test")
    other_production = Production(organization_id=organization.id, title="Other Show")
    db_session.add_all([production, other_production])
    db_session.flush()

    member = _user(db_session, organization.id, "member")
    director = _user(db_session, organization.id, "director")
    actor = _user(db_session, organization.id, "actor")
    other_production_actor = _user(db_session, organization.id, "other-actor")
    inactive_user = _user(db_session, organization.id, "inactive-user")
    inactive_membership = _user(db_session, organization.id, "inactive-membership")

    create_or_reactivate_membership(db_session, production.id, member.id, ["member"])
    create_or_reactivate_membership(db_session, production.id, director.id, ["director"])
    create_or_reactivate_membership(db_session, production.id, actor.id, ["actor"])
    create_or_reactivate_membership(
        db_session,
        other_production.id,
        other_production_actor.id,
        ["actor"],
    )
    create_or_reactivate_membership(db_session, production.id, inactive_user.id, ["member"])
    inactive_user.is_active = False
    create_or_reactivate_membership(
        db_session,
        production.id,
        inactive_membership.id,
        ["actor"],
    )
    deactivate_membership(
        db_session,
        production.id,
        inactive_membership.id,
    )
    db_session.commit()

    assert resolve_audience_user_ids(
        db_session,
        organization_id=organization.id,
        production_id=production.id,
        role_names=["Member"],
    ) == [member.id]
    assert resolve_audience_user_ids(
        db_session,
        organization_id=organization.id,
        production_id=production.id,
        role_names=["Director"],
    ) == [director.id]
    assert resolve_audience_user_ids(
        db_session,
        organization_id=organization.id,
        production_id=production.id,
        role_names=["Actor"],
    ) == [actor.id]
    assert inactive_user.id not in resolve_audience_user_ids(
        db_session,
        organization_id=organization.id,
        production_id=production.id,
        role_names=["Member", "Actor"],
    )
    assert inactive_membership.id not in resolve_audience_user_ids(
        db_session,
        organization_id=organization.id,
        production_id=production.id,
        role_names=["Actor"],
    )
    assert other_production_actor.id not in resolve_audience_user_ids(
        db_session,
        organization_id=organization.id,
        production_id=production.id,
        role_names=["Actor"],
    )

    db_session.add(
        Notification(
            user_id=actor.id,
            kind="system",
            title="Production note",
            production_id=production.id,
        )
    )
    db_session.add(
        Notification(
            user_id=other_production_actor.id,
            kind="system",
            title="Wrong production note",
            production_id=production.id,
        )
    )
    db_session.commit()
    assert [item.title for item in build_inbox(db_session, actor).items] == [
        "Production note"
    ]

    deactivate_membership(db_session, production.id, actor.id)
    db_session.commit()
    assert build_inbox(db_session, actor).items == []
    assert build_inbox(db_session, other_production_actor).items == []


def test_group_user_membership_scope(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    seed_database(db_session, test_settings)
    admin = db_session.query(User).filter(User.username == "admin").one()
    production = Production(organization_id=admin.organization_id, title="Group Test")
    db_session.add(production)
    db_session.flush()

    member = _user(db_session, admin.organization_id, "group-member")
    unassigned = _user(db_session, admin.organization_id, "unassigned")
    create_or_reactivate_membership(db_session, production.id, member.id, ["member"])
    group = Group(production_id=production.id, name="Cast")
    db_session.add(group)
    db_session.commit()

    headers = _login(client)
    rejected = client.put(
        f"/api/productions/{production.id}/groups/{group.id}/members",
        json={"user_ids": [member.id, unassigned.id]},
        headers=headers,
    )
    assert rejected.status_code == 400
    assert rejected.json()["detail"] == "One or more users were not found"

    accepted = client.put(
        f"/api/productions/{production.id}/groups/{group.id}/members",
        json={"user_ids": [member.id]},
        headers=headers,
    )
    assert accepted.status_code == 200
    assert accepted.json()["user_ids"] == [member.id]
