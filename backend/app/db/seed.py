from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.config import Settings
from app.models import AppRole, MomentType, Organization, User, UserAppRole
APP_ROLES = [
    ("Admin", "Full system access; import scripts; manage users"),
    ("Director", "Edit timeline; cast actors; no create/delete production, import, or user management"),
    ("Actor", "View timeline; add notes and bookmarks"),
]

MOMENT_TYPES = [
    ("stage_direction", "Prose stage direction (*...*)"),
    ("dialogue", "Character spoken line"),
    ("song_header", "Song title line"),
    ("song_attribution", "Performer attribution (ALL, SHACKLETON, etc.)"),
    ("lyric", "Single lyric line"),
    ("author_note", "Non-performance note (Note: prefix)"),
]

DEV_USERS = [
    {
        "username": "director",
        "password": "director",
        "first_name": "Dev",
        "last_name": "Director",
        "role_name": "Director",
    },
    {
        "username": "actor",
        "password": "actor",
        "first_name": "Dev",
        "last_name": "Actor",
        "role_name": "Actor",
    },
]


def _get_or_create_organization(db: Session, org_name: str) -> Organization:
    organization = db.query(Organization).filter(Organization.name == org_name).first()
    if organization is None:
        organization = Organization(name=org_name)
        db.add(organization)
        db.flush()
    return organization


def _seed_app_roles(db: Session) -> dict[str, AppRole]:
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


def seed_database(db: Session, settings: Settings) -> None:
    organization = _get_or_create_organization(db, settings.ORG_NAME)
    roles_by_name = _seed_app_roles(db)
    _seed_moment_types(db)

    user_count = db.query(User).count()
    if user_count == 0:
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

    if settings.ENVIRONMENT == "dev":
        for dev_user in DEV_USERS:
            existing = (
                db.query(User)
                .filter(User.username == dev_user["username"])
                .first()
            )
            if existing is None:
                _create_user(
                    db=db,
                    organization=organization,
                    username=dev_user["username"],
                    password=dev_user["password"],
                    first_name=dev_user["first_name"],
                    last_name=dev_user["last_name"],
                    role=roles_by_name[dev_user["role_name"]],
                )

    db.commit()
