from types import SimpleNamespace

import pytest
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import (
    Act,
    AppRole,
    Character,
    Dialogue,
    Moment,
    MomentType,
    Production,
    Scene,
    User,
    UserAppRole,
    UserCharacterAssignment,
)
from app.api.rehearsals import _is_director_or_admin
from app.services.production_memberships import (
    create_or_reactivate_membership,
    deactivate_membership,
)
from app.services.rehearsal_cast import suggested_users_for_scenes
from app.services.timeline_filters import apply_timeline_filters


@pytest.fixture
def seeded_db(db_session, test_settings):
    seed_database(db_session, test_settings)
    return db_session


def _user(db: Session, organization_id: int, username: str) -> User:
    user = User(
        organization_id=organization_id,
        username=username,
        password_hash="not-used",
        first_name=username,
        last_name="Test",
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def _production(db: Session, organization_id: int) -> Production:
    production = Production(organization_id=organization_id, title="WP5 Test")
    db.add(production)
    db.flush()
    return production


def _global_role(db: Session, user: User, name: str) -> None:
    role = AppRole(name=name, description="Legacy role")
    db.add(role)
    db.flush()
    db.add(UserAppRole(user_id=user.id, app_role_id=role.id))
    db.flush()


def test_timeline_filter_uses_active_production_roles(seeded_db) -> None:
    db = seeded_db
    admin = db.query(User).filter(User.username == "admin").one()
    production = _production(db, admin.organization_id)
    global_actor = _user(db, admin.organization_id, "global-actor")
    scoped_actor = _user(db, admin.organization_id, "scoped-actor")
    scoped_director = _user(db, admin.organization_id, "scoped-director")
    _global_role(db, global_actor, "Actor")
    create_or_reactivate_membership(db, production.id, scoped_actor.id, ["actor"])
    create_or_reactivate_membership(
        db,
        production.id,
        scoped_director.id,
        ["actor", "director"],
    )

    author_note = SimpleNamespace(
        id=1,
        moment_type=SimpleNamespace(name="author_note"),
    )
    dialogue = SimpleNamespace(
        id=2,
        moment_type=SimpleNamespace(name="dialogue"),
    )

    assert apply_timeline_filters(
        [author_note, dialogue],
        db=db,
        user=global_actor,
        production_id=production.id,
    ) == [author_note, dialogue]
    assert apply_timeline_filters(
        [author_note, dialogue],
        db=db,
        user=scoped_actor,
        production_id=production.id,
    ) == [dialogue]
    assert apply_timeline_filters(
        [author_note, dialogue],
        db=db,
        user=scoped_director,
        production_id=production.id,
    ) == [author_note, dialogue]


def test_rehearsal_director_visibility_uses_production_membership(
    seeded_db,
) -> None:
    db = seeded_db
    admin = db.query(User).filter(User.username == "admin").one()
    production = _production(db, admin.organization_id)
    global_director = _user(db, admin.organization_id, "global-director")
    member = _user(db, admin.organization_id, "member")
    director = _user(db, admin.organization_id, "director")
    _global_role(db, global_director, "Director")
    create_or_reactivate_membership(db, production.id, member.id, ["member"])
    create_or_reactivate_membership(db, production.id, director.id, ["director"])

    assert _is_director_or_admin(db, global_director, production.id) is False
    assert _is_director_or_admin(db, member, production.id) is False
    assert _is_director_or_admin(db, director, production.id) is True

    global_director_membership = create_or_reactivate_membership(
        db,
        production.id,
        global_director.id,
        ["director"],
    )
    deactivate_membership(db, global_director_membership)
    assert _is_director_or_admin(db, global_director, production.id) is False


def test_scene_suggestions_require_active_cast_actor_membership(
    seeded_db,
) -> None:
    db = seeded_db
    admin = db.query(User).filter(User.username == "admin").one()
    production = _production(db, admin.organization_id)
    active_actor = _user(db, admin.organization_id, "active-actor")
    inactive_actor = _user(db, admin.organization_id, "inactive-actor")
    uncast_actor = _user(db, admin.organization_id, "uncast-actor")
    create_or_reactivate_membership(
        db,
        production.id,
        active_actor.id,
        ["actor"],
    )
    inactive_membership = create_or_reactivate_membership(
        db,
        production.id,
        inactive_actor.id,
        ["actor"],
    )
    create_or_reactivate_membership(db, production.id, uncast_actor.id, ["actor"])
    deactivate_membership(db, inactive_membership)

    act = Act(production_id=production.id, number=1, sort_order=0)
    db.add(act)
    db.flush()
    scene = Scene(act_id=act.id, number=1, sort_order=0, title="Test Scene")
    db.add(scene)
    db.flush()
    dialogue_type = db.query(MomentType).filter(MomentType.name == "dialogue").one()
    characters = [
        Character(production_id=production.id, name="Active Character"),
        Character(production_id=production.id, name="Inactive Character"),
        Character(production_id=production.id, name="Uncast Character"),
    ]
    db.add_all(characters)
    db.flush()
    for index, character in enumerate(characters, start=1):
        moment = Moment(
            scene_id=scene.id,
            moment_type_id=dialogue_type.id,
            sequence_number=index,
            original_text=character.name,
            parsed_text=character.name,
        )
        db.add(moment)
        db.flush()
        db.add(
            Dialogue(
                moment_id=moment.id,
                character_id=character.id,
                dialogue_text=character.name,
            )
        )
    db.add_all(
        [
            UserCharacterAssignment(
                user_id=active_actor.id,
                character_id=characters[0].id,
            ),
            UserCharacterAssignment(
                user_id=inactive_actor.id,
                character_id=characters[1].id,
            ),
        ]
    )
    db.commit()

    suggestions = suggested_users_for_scenes(db, production.id, [scene.id])

    assert [(user.id, names) for user, names in suggestions] == [
        (active_actor.id, ["Active Character"])
    ]
