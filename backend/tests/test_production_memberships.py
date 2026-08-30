from sqlalchemy.exc import IntegrityError

import pytest

from app.db.production_role_defaults import (
    PERMISSION_ACTIONS,
    PRODUCTION_PERMISSION_RESOURCES,
)
from app.db.seed import seed_database
from app.models import (
    AppRole,
    Character,
    Organization,
    Production,
    ProductionMembership,
    ProductionMembershipRole,
    ProductionRole,
    ProductionRolePermission,
    User,
    UserAppRole,
    UserCharacterAssignment,
)
from app.services.production_memberships import (
    MembershipNotFoundError,
    ProductionMembershipError,
    UserNotEligibleError,
    active_role_codes,
    create_or_reactivate_membership,
    deactivate_membership,
    effective_permissions,
    get_membership,
    replace_membership_roles,
    validate_active_same_org_user,
)


@pytest.fixture
def seeded_db(db_session, test_settings):
    seed_database(db_session, test_settings)
    return db_session


@pytest.fixture
def production_and_users(seeded_db):
    organization = seeded_db.query(Organization).one()
    production = Production(organization_id=organization.id, title="Membership Test")
    seeded_db.add(production)
    seeded_db.flush()

    users = []
    for username in ("member-one", "member-two"):
        user = User(
            organization_id=organization.id,
            username=username,
            password_hash="not-used",
            first_name=username,
            last_name="Test",
            is_active=True,
        )
        seeded_db.add(user)
        users.append(user)
    seeded_db.flush()
    return seeded_db, production, users


def test_membership_is_unique_and_repeated_add_reuses_row(production_and_users):
    db, production, users = production_and_users

    first = create_or_reactivate_membership(
        db, production.id, users[0].id, ["member", "actor"]
    )
    second = create_or_reactivate_membership(
        db, production.id, users[0].id, ["member", "actor"]
    )

    assert first.id == second.id
    assert db.query(ProductionMembership).count() == 1
    assert active_role_codes(db, first) == {"member", "actor"}


def test_duplicate_membership_is_rejected_by_database(production_and_users):
    db, production, users = production_and_users
    db.add(
        ProductionMembership(
            production_id=production.id,
            user_id=users[0].id,
            is_active=True,
        )
    )
    db.flush()
    db.add(
        ProductionMembership(
            production_id=production.id,
            user_id=users[0].id,
            is_active=True,
        )
    )

    with pytest.raises(IntegrityError):
        db.flush()
    db.rollback()


def test_new_membership_requires_active_same_org_user(production_and_users):
    db, production, users = production_and_users
    users[0].is_active = False
    db.flush()

    with pytest.raises(UserNotEligibleError):
        validate_active_same_org_user(db, production.id, users[0].id)

    other_org = Organization(name="Other Organization")
    db.add(other_org)
    db.flush()
    other_user = User(
        organization_id=other_org.id,
        username="other-org-user",
        password_hash="not-used",
        first_name="Other",
        last_name="Org",
        is_active=True,
    )
    db.add(other_user)
    db.flush()

    with pytest.raises(UserNotEligibleError):
        create_or_reactivate_membership(
            db, production.id, other_user.id, ["member"]
        )


def test_create_membership_with_multiple_roles(production_and_users):
    db, production, users = production_and_users

    membership = create_or_reactivate_membership(
        db, production.id, users[0].id, ["director", "actor"]
    )

    assert membership.is_active is True
    assert active_role_codes(db, membership) == {"director", "actor"}
    assert (
        db.query(ProductionMembershipRole)
        .filter(ProductionMembershipRole.membership_id == membership.id)
        .count()
        == 2
    )


def test_reactivation_preserves_identity_and_restores_submitted_roles(production_and_users):
    db, production, users = production_and_users
    membership = create_or_reactivate_membership(
        db, production.id, users[0].id, ["member"]
    )
    deactivate_membership(db, membership)

    reactivated = create_or_reactivate_membership(
        db, production.id, users[0].id, ["director", "actor"]
    )

    assert reactivated.id == membership.id
    assert reactivated.is_active is True
    assert active_role_codes(db, reactivated) == {"director", "actor"}
    assert db.query(ProductionMembership).count() == 1


def test_role_update_rejects_roleless_active_membership(production_and_users):
    db, production, users = production_and_users
    membership = create_or_reactivate_membership(
        db, production.id, users[0].id, ["member"]
    )

    with pytest.raises(ProductionMembershipError):
        replace_membership_roles(db, membership, [])

    assert active_role_codes(db, membership) == {"member"}


def test_deactivation_preserves_membership_roles_and_cast(production_and_users):
    db, production, users = production_and_users
    membership = create_or_reactivate_membership(
        db, production.id, users[0].id, ["actor"]
    )
    character = Character(production_id=production.id, name="Lead")
    db.add(character)
    db.flush()
    db.add(
        UserCharacterAssignment(
            user_id=users[0].id,
            character_id=character.id,
        )
    )
    db.flush()

    deactivate_membership(db, membership)

    assert get_membership(db, production.id, users[0].id).is_active is False
    assert active_role_codes(db, membership) == set()
    assert db.query(ProductionMembershipRole).count() == 1
    assert db.query(UserCharacterAssignment).count() == 1


def test_effective_permissions_are_union_of_enabled_roles(production_and_users):
    db, production, users = production_and_users
    membership = create_or_reactivate_membership(
        db, production.id, users[0].id, ["member", "director"]
    )

    member_read = ("timeline", "read")
    director_write = ("timeline", "update")
    assert member_read in effective_permissions(db, membership)
    assert director_write in effective_permissions(db, membership)

    deactivate_membership(db, membership)
    assert effective_permissions(db, membership) == set()


def test_seed_production_roles_and_complete_permission_defaults(seeded_db):
    roles = seeded_db.query(ProductionRole).order_by(ProductionRole.code).all()
    assert [role.code for role in roles] == ["actor", "director", "member"]
    assert seeded_db.query(AppRole).count() == 1
    assert seeded_db.query(AppRole).one().name == "Admin"
    assert seeded_db.query(User).count() == 1

    assert seeded_db.query(ProductionRolePermission).count() == (
        len(roles) * len(PRODUCTION_PERMISSION_RESOURCES) * len(PERMISSION_ACTIONS)
    )
    member = next(role for role in roles if role.code == "member")
    member_people_read = (
        seeded_db.query(ProductionRolePermission)
        .filter_by(
            production_role_id=member.id,
            resource="people",
            action="read",
        )
        .one()
    )
    assert member_people_read.enabled is True
    assert (
        seeded_db.query(ProductionRolePermission)
        .filter_by(
            production_role_id=member.id,
            resource="people",
            action="update",
        )
        .one()
        .enabled
        is False
    )


def test_role_seed_does_not_overwrite_existing_edits(seeded_db, test_settings):
    role = (
        seeded_db.query(ProductionRole)
        .filter(ProductionRole.code == "member")
        .one()
    )
    permission = (
        seeded_db.query(ProductionRolePermission)
        .filter_by(
            production_role_id=role.id,
            resource="people",
            action="update",
        )
        .one()
    )
    role.name = "Crew Member"
    role.description = "Owner-defined description"
    permission.enabled = True
    seeded_db.commit()

    seed_database(seeded_db, test_settings)

    seeded_db.refresh(role)
    seeded_db.refresh(permission)
    assert role.name == "Crew Member"
    assert role.description == "Owner-defined description"
    assert permission.enabled is True


def test_missing_membership_is_reported(production_and_users):
    db, production, users = production_and_users
    with pytest.raises(MembershipNotFoundError):
        deactivate_membership(db, production.id, users[0].id)


def test_seed_removes_legacy_global_director_and_actor_roles(seeded_db, test_settings):
    director_role = AppRole(name="Director", description="Legacy role")
    actor_role = AppRole(name="Actor", description="Legacy role")
    seeded_db.add_all([director_role, actor_role])
    seeded_db.flush()
    legacy_user = User(
        organization_id=seeded_db.query(Organization).one().id,
        username="legacy-director",
        password_hash="not-used",
        first_name="Legacy",
        last_name="Director",
        is_active=True,
    )
    seeded_db.add(legacy_user)
    seeded_db.flush()
    seeded_db.add(
        UserAppRole(user_id=legacy_user.id, app_role_id=director_role.id)
    )
    seeded_db.commit()

    seed_database(seeded_db, test_settings)

    assert seeded_db.query(AppRole).filter(AppRole.name != "Admin").count() == 0
    assert seeded_db.query(UserAppRole).filter(
        UserAppRole.user_id == legacy_user.id
    ).count() == 0
