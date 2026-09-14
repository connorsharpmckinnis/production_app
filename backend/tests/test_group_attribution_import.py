"""Group attribution subjects on dialogue / lyrics / song attribution."""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Character, Dialogue, Group, Organization, Production
from app.services.importer import import_script


@pytest.fixture
def seeded_db(db_session: Session, test_settings) -> Session:
    seed_database(db_session, test_settings)
    return db_session


@pytest.fixture
def production(seeded_db: Session) -> Production:
    org = seeded_db.query(Organization).first()
    prod = Production(organization_id=org.id, title="Group Attr")
    seeded_db.add(prod)
    seeded_db.commit()
    seeded_db.refresh(prod)
    return prod


def test_mixed_character_and_group_dialogue(seeded_db: Session, production: Production):
    script = """# Act One
## Scene One - Test
VERA & ENSEMBLE: Hello everyone.
"""
    result = import_script(
        seeded_db,
        production,
        script,
        speaker_kinds={"VERA": "character", "ENSEMBLE": "group"},
    )
    assert result.characters_created == 1
    assert result.groups_created == 1

    lines = seeded_db.query(Dialogue).all()
    assert len(lines) == 2
    by_kind = {(line.character_id is not None, line.group_id is not None) for line in lines}
    assert by_kind == {(True, False), (False, True)}

    vera = seeded_db.query(Character).filter_by(name="VERA").one()
    ensemble = seeded_db.query(Group).filter_by(name="ENSEMBLE").one()
    assert any(line.character_id == vera.id for line in lines)
    assert any(line.group_id == ensemble.id for line in lines)


def test_speaker_kinds_override_recommended_group(seeded_db: Session, production: Production):
    script = """# Act One
## Scene One - Test
ALL: Solo somehow.
"""
    import_script(
        seeded_db,
        production,
        script,
        speaker_kinds={"ALL": "character"},
    )
    assert seeded_db.query(Character).filter_by(name="ALL").one() is not None
    assert seeded_db.query(Group).filter_by(name="ALL").first() is None
