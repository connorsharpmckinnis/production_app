from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.db.seed import seed_database
from app.models import (
    AppRole,
    Character,
    Organization,
    Production,
    ProductionMembership,
    User,
    UserAppRole,
    UserCharacterAssignment,
)
from app.services.production_memberships import (
    create_or_reactivate_membership,
    deactivate_membership,
    list_active_production_users,
)


def _login_admin(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin"},
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
        last_name="Test",
        is_active=is_active,
    )
    db.add(user)
    db.flush()
    return user


def _production(db: Session, organization_id: int, title: str) -> Production:
    production = Production(organization_id=organization_id, title=title)
    db.add(production)
    db.flush()
    return production


def _fixture(
    db: Session,
    test_settings,
) -> tuple[User, Production, Production, Organization]:
    seed_database(db, test_settings)
    admin = db.query(User).filter(User.username == "admin").one()
    first = _production(db, admin.organization_id, "Casting One")
    second = _production(db, admin.organization_id, "Casting Two")
    other_org = Organization(name="Other Casting Organization")
    db.add(other_org)
    db.flush()
    db.commit()
    return admin, first, second, other_org


def _character(db: Session, production_id: int, name: str) -> Character:
    character = Character(production_id=production_id, name=name)
    db.add(character)
    db.flush()
    return character


def _add_global_role(db: Session, user: User, name: str) -> None:
    role = AppRole(name=name, description="Legacy global role")
    db.add(role)
    db.flush()
    db.add(UserAppRole(user_id=user.id, app_role_id=role.id))
    db.flush()


def test_casting_requires_active_actor_membership_and_scopes_selectors(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    _, production, other_production, other_org = _fixture(
        db_session,
        test_settings,
    )
    actor = _user(db_session, production.organization_id, "actor-member")
    member = _user(db_session, production.organization_id, "member-only")
    uncast_actor = _user(db_session, production.organization_id, "uncast-actor")
    different_role = _user(db_session, production.organization_id, "different-role")
    foreign = _user(db_session, other_org.id, "foreign")
    inactive = _user(
        db_session,
        production.organization_id,
        "inactive",
        is_active=False,
    )
    create_or_reactivate_membership(db_session, production.id, actor.id, ["actor"])
    create_or_reactivate_membership(db_session, production.id, member.id, ["member"])
    create_or_reactivate_membership(
        db_session,
        production.id,
        uncast_actor.id,
        ["actor"],
    )
    create_or_reactivate_membership(
        db_session,
        other_production.id,
        different_role.id,
        ["member"],
    )
    create_or_reactivate_membership(
        db_session,
        production.id,
        different_role.id,
        ["actor"],
    )
    # A legacy global role must not make a non-actor production member castable.
    _add_global_role(db_session, member, "Actor")
    _add_global_role(db_session, member, "Director")
    db_session.commit()

    headers = _login_admin(client)
    castable = client.get(
        f"/api/productions/{production.id}/castable-users",
        headers=headers,
    )
    assert castable.status_code == 200
    assert {item["id"] for item in castable.json()} == {
        actor.id,
        uncast_actor.id,
        different_role.id,
    }

    active_users = client.get(
        f"/api/productions/{production.id}/active-users",
        headers=headers,
    )
    assert active_users.status_code == 200
    assert {item["id"] for item in active_users.json()} == {
        actor.id,
        member.id,
        uncast_actor.id,
        different_role.id,
    }
    assert foreign.id not in {item["id"] for item in active_users.json()}
    assert inactive.id not in {item["id"] for item in active_users.json()}
    assert {
        user.id
        for user in list_active_production_users(db_session, production.id)
    } == {
        actor.id,
        member.id,
        uncast_actor.id,
        different_role.id,
    }

    first_character = _character(db_session, production.id, "First Role")
    second_character = _character(db_session, other_production.id, "Second Role")
    db_session.commit()

    eligible = client.put(
        f"/api/productions/{production.id}/characters/{first_character.id}/cast",
        json={"user_id": actor.id},
        headers=headers,
    )
    assert eligible.status_code == 200

    member_response = client.put(
        f"/api/productions/{production.id}/characters/{first_character.id}/cast",
        json={"user_id": member.id},
        headers=headers,
    )
    assert member_response.status_code == 422

    cross_production = client.put(
        f"/api/productions/{other_production.id}/characters/{second_character.id}/cast",
        json={"user_id": different_role.id},
        headers=headers,
    )
    assert cross_production.status_code == 422

    for user_id, expected_status in (
        (foreign.id, 422),
        (inactive.id, 404),
    ):
        response = client.put(
            f"/api/productions/{production.id}/characters/{first_character.id}/cast",
            json={"user_id": user_id},
            headers=headers,
        )
        assert response.status_code == expected_status

    nonmember = _user(db_session, production.organization_id, "nonmember")
    db_session.commit()
    nonmember_response = client.put(
        f"/api/productions/{production.id}/characters/{first_character.id}/cast",
        json={"user_id": nonmember.id},
        headers=headers,
    )
    assert nonmember_response.status_code == 422


def test_cast_removal_preserves_membership_and_deactivation_preserves_assignment(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> None:
    _, production, _, _ = _fixture(db_session, test_settings)
    actor = _user(db_session, production.organization_id, "retained-actor")
    membership = create_or_reactivate_membership(
        db_session,
        production.id,
        actor.id,
        ["actor"],
    )
    character = _character(db_session, production.id, "Retained Role")
    db_session.commit()

    headers = _login_admin(client)
    cast_path = f"/api/productions/{production.id}/characters/{character.id}/cast"
    assigned = client.put(
        cast_path,
        json={"user_id": actor.id},
        headers=headers,
    )
    assert assigned.status_code == 200

    removed = client.put(cast_path, json={"user_id": None}, headers=headers)
    assert removed.status_code == 200
    db_session.expire_all()
    assert db_session.get(ProductionMembership, membership.id) is not None
    assert db_session.get(ProductionMembership, membership.id).is_active is True
    assert (
        db_session.query(UserCharacterAssignment)
        .filter(UserCharacterAssignment.character_id == character.id)
        .count()
        == 0
    )

    reassigned = client.put(
        cast_path,
        json={"user_id": actor.id},
        headers=headers,
    )
    assert reassigned.status_code == 200
    deactivate_membership(db_session, membership)
    db_session.commit()

    assert client.get(f"/api/productions/{production.id}", headers=headers).status_code == 200
    # The retained assignment remains in storage, but the member can no longer
    # use production-scoped routes after membership deactivation.
    actor_login = client.post(
        "/api/auth/login",
        json={"username": "retained-actor", "password": "password"},
    )
    actor_headers = {
        "Authorization": f"Bearer {actor_login.json()['access_token']}",
    }
    assert client.get(
        f"/api/productions/{production.id}",
        headers=actor_headers,
    ).status_code == 404
    characters = client.get(
        f"/api/productions/{production.id}/characters",
        headers=headers,
    )
    assert characters.status_code == 200
    retained_character = next(
        item for item in characters.json() if item["id"] == character.id
    )
    assert retained_character["assigned_actor"] is None

    casting = client.get(
        f"/api/productions/{production.id}/casting",
        headers=headers,
    )
    assert casting.status_code == 200
    retained_cast = next(
        item for item in casting.json() if item["character_id"] == character.id
    )
    assert retained_cast["user_id"] is None

    overview = client.get(
        f"/api/productions/{production.id}/overview",
        headers=headers,
    )
    assert overview.status_code == 200
    assert overview.json()["cast_count"] == 0

    db_session.expire_all()
    assert db_session.query(UserCharacterAssignment).count() == 1
