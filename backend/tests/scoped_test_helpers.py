"""Shared fixtures for tests that exercise the membership-scoped model."""

from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.db.seed import seed_database
from app.models import Production, User
from app.services.production_memberships import create_or_reactivate_membership


def seed_database_with_test_users(db: Session, settings) -> None:
    """Seed Admin plus ordinary users used by migrated legacy tests."""
    seed_database(db, settings)
    organization_id = db.query(User).filter(User.username == "admin").one().organization_id
    users = (
        ("director", "Dev", "Director", "director"),
        ("actor", "Dev", "Actor", "actor"),
    )
    for username, first_name, last_name, password in users:
        if db.query(User).filter(User.username == username).first() is not None:
            continue
        db.add(
            User(
                organization_id=organization_id,
                username=username,
                password_hash=hash_password(password),
                first_name=first_name,
                last_name=last_name,
                is_active=True,
            )
        )
    db.commit()


def add_test_production_memberships(
    db: Session,
    production: Production | int,
    *,
    include_director: bool = True,
    include_actor: bool = True,
) -> None:
    """Grant the legacy test users explicit production-scoped roles."""
    production_id = production.id if isinstance(production, Production) else production
    role_by_username = {}
    if include_director:
        role_by_username["director"] = ["director"]
    if include_actor:
        role_by_username["actor"] = ["actor"]
    for username, role_codes in role_by_username.items():
        user = db.query(User).filter(User.username == username).one()
        create_or_reactivate_membership(db, production_id, user.id, role_codes)
    # Client requests use a separate Session. Commit here so SQLite's
    # StaticPool exposes these memberships across the session boundary.
    db.commit()
