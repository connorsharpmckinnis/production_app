"""Phase 11: singer attribution, footnotes, and lyric Character links."""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import (
    Character,
    LyricLine,
    Moment,
    MomentType,
    Production,
    SongAttributionCharacter,
)
from app.services.importer import ImportLineError, import_script
from app.services.importer.grammar import parse_performer_line
from app.services.importer.preprocessing import strip_inline_footnotes


MINI_SONG_SCRIPT = """\
# Title: Phase 11 Song Test
## Author: Test
# Act One
## Scene One - Deck
SHACKLETON: We sail at dawn.
VERA: Ready.
MOM: Ready.
### INTO THE DEEP (PRE-PRISE)
ALL
INTO THE DEEEEEEEEEP[^2]
INTO THE DEEEEEEEEEP
### US WHO TRAVEL (2)
VERA & MOM
O GOD WHOSE GLORY FILLS CREATION,
SHACKLETON (WILD)
PRESERVE THOSE WHO TRAVEL, GUARD THEM NIGHT AND DAY
"""


@pytest.fixture
def seeded_db(db_session: Session, test_settings) -> Session:
    seed_database(db_session, test_settings)
    return db_session


@pytest.fixture
def production(seeded_db: Session) -> Production:
    from app.models import Organization

    organization = seeded_db.query(Organization).first()
    production = Production(organization_id=organization.id, title="Phase 11")
    seeded_db.add(production)
    seeded_db.commit()
    return production


def test_strip_inline_footnotes():
    assert strip_inline_footnotes("right, it's the Nimrod[^2]") == "right, it's the Nimrod"
    assert strip_inline_footnotes("AMEN[^9]") == "AMEN"


def test_parse_performer_line_parenthetical_split():
    known = {"SHACKLETON", "WILD", "ALL"}
    assert parse_performer_line("SHACKLETON (WILD)", known) == ["SHACKLETON", "WILD"]
    assert parse_performer_line(
        "SHACKLETON (WILD)",
        {"SHACKLETON"},
        allow_new_parenthetical_names=True,
    ) == ["SHACKLETON", "WILD"]
    assert parse_performer_line("SHACKLETON (WILD)", {"SHACKLETON"}) is None


def test_import_persists_singers_and_strips_footnotes(
    seeded_db: Session,
    production: Production,
):
    import_script(seeded_db, production, MINI_SONG_SCRIPT)

    moments = seeded_db.query(Moment).order_by(Moment.sequence_number).all()
    by_type: dict[str, list[Moment]] = {}
    for moment in moments:
        by_type.setdefault(moment.moment_type.name, []).append(moment)

    attributions = by_type["song_attribution"]
    assert len(attributions) == 3

    all_attr = attributions[0]
    all_names = {row.character.name for row in all_attr.song_attribution_characters}
    assert all_names == {"ALL"}

    lyrics = by_type["lyric"]
    first_lyric = lyrics[0]
    assert "[^" not in first_lyric.original_text
    assert first_lyric.original_text == "INTO THE DEEEEEEEEEP"
    assert {line.character.name for line in first_lyric.lyric_lines} == {"ALL"}
    assert {line.lyric_text for line in first_lyric.lyric_lines} == {"INTO THE DEEEEEEEEEP"}

    vera_mom_attr = attributions[1]
    assert {row.character.name for row in vera_mom_attr.song_attribution_characters} == {
        "VERA",
        "MOM",
    }
    vera_mom_lyric = lyrics[2]
    assert {line.character.name for line in vera_mom_lyric.lyric_lines} == {"VERA", "MOM"}

    split_attr = attributions[2]
    assert {row.character.name for row in split_attr.song_attribution_characters} == {
        "SHACKLETON",
        "WILD",
    }
    split_lyric = lyrics[3]
    assert {line.character.name for line in split_lyric.lyric_lines} == {
        "SHACKLETON",
        "WILD",
    }
    assert (
        seeded_db.query(Character)
        .filter_by(production_id=production.id, name="WILD")
        .one()
    )


def test_lyric_before_attribution_fails(seeded_db: Session, production: Production):
    script = """\
# Act One
## Scene One - Deck
SHACKLETON: Hello.
### SAD SONG
INTO THE DEEP WITHOUT A SINGER
"""
    with pytest.raises(ImportLineError) as exc_info:
        import_script(seeded_db, production, script)
    messages = " ".join(issue.message for issue in exc_info.value.issues)
    assert "before any performer attribution" in messages
    assert seeded_db.query(Moment).count() == 0


def test_blank_lines_do_not_clear_performers(seeded_db: Session, production: Production):
    script = """\
# Act One
## Scene One - Deck
SHACKLETON: Hello.
### SEA SONG
ALL
LINE ONE
LINE TWO STILL ALL
"""
    import_script(seeded_db, production, script)
    lyrics = (
        seeded_db.query(Moment)
        .join(MomentType)
        .filter(MomentType.name == "lyric")
        .order_by(Moment.sequence_number)
        .all()
    )
    assert len(lyrics) == 2
    for lyric in lyrics:
        assert {line.character.name for line in lyric.lyric_lines} == {"ALL"}


def test_lyric_line_count_matches_performers(
    seeded_db: Session,
    production: Production,
):
    script = """\
# Act One
## Scene One - Deck
VERA: Hi.
MOM: Hi.
### DUET
VERA & MOM
SHARED LINE HERE NOW
"""
    import_script(seeded_db, production, script)
    lyric = (
        seeded_db.query(Moment)
        .join(MomentType)
        .filter(MomentType.name == "lyric")
        .one()
    )
    assert seeded_db.query(LyricLine).filter_by(moment_id=lyric.id).count() == 2
    assert seeded_db.query(SongAttributionCharacter).count() == 2
