from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.config import Settings
from app.db.encouragement_defaults import (
    DEFAULT_ENCOURAGEMENT_MESSAGES,
    DEFAULT_MESSAGE_ROTATION_SECONDS,
)
from app.db.production_role_defaults import (
    PERMISSION_ACTIONS,
    PRODUCTION_PERMISSION_RESOURCES,
    PRODUCTION_ROLE_DEFINITIONS,
    enabled_actions_for,
)
from app.models import (
    AppOverviewMessageDefault,
    AppRole,
    AppSetting,
    Location,
    MomentType,
    Organization,
    ProductionRole,
    ProductionRolePermission,
    User,
    UserAppRole,
)

DEFAULT_LOCATIONS = [
    ("Main Stage", 0),
    ("Dance Room", 1),
    ("Music Room", 2),
    ("Cafe", 3),
]
APP_ROLES = [
    ("Admin", "Full system access; import scripts; manage users"),
]

MOMENT_TYPES = [
    ("stage_direction", "Prose stage direction (*...*)"),
    ("dialogue", "Character spoken line"),
    ("song_header", "Song title line"),
    ("song_attribution", "Performer attribution (ALL, SHACKLETON, etc.)"),
    ("lyric", "Single lyric line"),
    ("author_note", "Non-performance note (Note: prefix)"),
]

def _get_or_create_organization(db: Session, org_name: str) -> Organization:
    organization = db.query(Organization).filter(Organization.name == org_name).first()
    if organization is None:
        organization = Organization(name=org_name)
        db.add(organization)
        db.flush()
    return organization


def _seed_app_roles(db: Session) -> dict[str, AppRole]:
    legacy_roles = db.query(AppRole).filter(AppRole.name.in_(("Director", "Actor"))).all()
    if legacy_roles:
        legacy_role_ids = [role.id for role in legacy_roles]
        db.query(UserAppRole).filter(
            UserAppRole.app_role_id.in_(legacy_role_ids)
        ).delete(synchronize_session=False)
        db.query(AppRole).filter(AppRole.id.in_(legacy_role_ids)).delete(
            synchronize_session=False
        )

    roles_by_name: dict[str, AppRole] = {}
    for name, description in APP_ROLES:
        role = db.query(AppRole).filter(AppRole.name == name).first()
        if role is None:
            role = AppRole(name=name, description=description)
            db.add(role)
            db.flush()
        roles_by_name[name] = role
    return roles_by_name


def _seed_moment_types(db: Session) -> None:
    for name, description in MOMENT_TYPES:
        moment_type = db.query(MomentType).filter(MomentType.name == name).first()
        if moment_type is None:
            db.add(MomentType(name=name, description=description))
    db.flush()


def _assign_role(db: Session, user: User, role: AppRole) -> None:
    existing = (
        db.query(UserAppRole)
        .filter(
            UserAppRole.user_id == user.id,
            UserAppRole.app_role_id == role.id,
        )
        .first()
    )
    if existing is None:
        db.add(UserAppRole(user_id=user.id, app_role_id=role.id))


def _create_user(
    db: Session,
    organization: Organization,
    username: str,
    password: str,
    first_name: str,
    last_name: str,
    role: AppRole,
) -> User:
    user = User(
        organization_id=organization.id,
        username=username,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        is_active=True,
    )
    db.add(user)
    db.flush()
    _assign_role(db, user, role)
    return user


def _seed_app_settings(db: Session) -> None:
    settings = db.query(AppSetting).filter(AppSetting.id == 1).first()
    if settings is None:
        db.add(
            AppSetting(
                id=1,
                show_original_text=True,
                show_parsed_text=True,
                default_message_rotation_seconds=DEFAULT_MESSAGE_ROTATION_SECONDS,
            )
        )
        db.flush()


def _seed_locations(db: Session, organization: Organization) -> None:
    for name, sort_order in DEFAULT_LOCATIONS:
        existing = (
            db.query(Location)
            .filter(
                Location.organization_id == organization.id,
                Location.name == name,
            )
            .first()
        )
        if existing is None:
            db.add(
                Location(
                    organization_id=organization.id,
                    name=name,
                    sort_order=sort_order,
                )
            )
    db.flush()


def _seed_overview_message_defaults(db: Session) -> None:
    # Only insert the built-in band copy when the table is empty so admin edits survive re-seed.
    existing = db.query(AppOverviewMessageDefault).count()
    if existing > 0:
        return
    for row in DEFAULT_ENCOURAGEMENT_MESSAGES:
        db.add(
            AppOverviewMessageDefault(
                band=row["band"],
                title=row["title"],
                body=row["body"],
                sort_order=row["sort_order"],
                active=row["active"],
            )
        )
    db.flush()


def _seed_production_roles(db: Session) -> None:
    for code, name, description in PRODUCTION_ROLE_DEFINITIONS:
        role = db.query(ProductionRole).filter(ProductionRole.code == code).first()
        if role is None:
            role = ProductionRole(code=code, name=name, description=description)
            db.add(role)
            db.flush()

        for resource in PRODUCTION_PERMISSION_RESOURCES:
            enabled_actions = enabled_actions_for(code, resource)
            for action in PERMISSION_ACTIONS:
                existing = (
                    db.query(ProductionRolePermission)
                    .filter(
                        ProductionRolePermission.production_role_id == role.id,
                        ProductionRolePermission.resource == resource,
                        ProductionRolePermission.action == action,
                    )
                    .first()
                )
                if existing is None:
                    db.add(
                        ProductionRolePermission(
                            production_role_id=role.id,
                            resource=resource,
                            action=action,
                            enabled=action in enabled_actions,
                        )
                    )
    db.flush()


def seed_database(db: Session, settings: Settings) -> None:
    organization = _get_or_create_organization(db, settings.ORG_NAME)
    roles_by_name = _seed_app_roles(db)
    _seed_moment_types(db)
    _seed_app_settings(db)
    _seed_overview_message_defaults(db)
    _seed_locations(db, organization)
    _seed_production_roles(db)

    admin = db.query(User).filter(User.username == settings.ADMIN_USERNAME).first()
    if admin is None:
        admin_password = settings.ADMIN_PASSWORD or "admin"
        _create_user(
            db=db,
            organization=organization,
            username=settings.ADMIN_USERNAME,
            password=admin_password,
            first_name="Admin",
            last_name="User",
            role=roles_by_name["Admin"],
        )
    else:
        _assign_role(db, admin, roles_by_name["Admin"])

    db.commit()
