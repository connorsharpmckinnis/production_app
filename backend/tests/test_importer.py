"""Unit tests for script importer classification."""

import pytest
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Act, Character, Moment, Production, Song
from app.services.importer import ImportLineError, import_script


@pytest.fixture
def seeded_db(db_session: Session, test_settings) -> Session:
    seed_database(db_session, test_settings)
    return db_session


@pytest.fixture
def production(seeded_db: Session, test_settings) -> Production:
    from app.models import Organization

    org = seeded_db.query(Organization).first()
    prod = Production(organization_id=org.id, title="Test Production")
    seeded_db.add(prod)
    seeded_db.commit()
    seeded_db.refresh(prod)
    return prod


def _import(db: Session, production: Production, script: str):
    return import_script(db, production, script)


class TestPreprocessing:
    def test_mojibake_repair(self, seeded_db, production):
        script = """# Act One
## Scene One - Test
CREAN: That\u00e2\u20ac\u2122ll work \u00e2\u20ac\u201c sure.
"""
        result = _import(seeded_db, production, script)
        assert result.moments_created == 1
        moment = seeded_db.query(Moment).first()
        assert "That'll" in moment.original_text
        assert "–" in moment.original_text


class TestStructure:
    def test_act_and_scene(self, seeded_db, production):
        script = """# Title: My Show
## Author: Writer
# Act One
## Scene One - Opening
*Lights up.*
"""
        result = _import(seeded_db, production, script)
        assert result.acts_created == 1
        assert result.scenes_created == 1
        seeded_db.refresh(production)
        assert production.title == "My Show"
        assert production.author == "Writer"

    def test_scene_before_act_fails(self, seeded_db, production):
        script = "## Scene One - Oops\n*Bad.*\n"
        with pytest.raises(ImportLineError) as exc:
            _import(seeded_db, production, script)
        assert "before any Act" in exc.value.message


class TestDialogue:
    def test_simple_dialogue(self, seeded_db, production):
        script = """# Act One
## Scene One - Test
SHACKLETON: Hello world.
"""
        result = _import(seeded_db, production, script)
        assert result.characters_created == 3  # SHACKLETON + built-in ALL, ENSEMBLE
        char = seeded_db.query(Character).filter(Character.name == "SHACKLETON").one()
        assert char is not None

    def test_group_dialogue(self, seeded_db, production):
        script = """# Act One
## Scene One - Test
SHACKLETON, WORSLEY: Together.
"""
        result = _import(seeded_db, production, script)
        assert result.characters_created == 4  # SHACKLETON, WORSLEY + built-ins


class TestSongs:
    def test_song_header_and_plain_lyrics(self, seeded_db, production):
        script = """# Act One
## Scene One - Test
### [MY SONG](https://example.com)
ALL
LINE ONE HERE
LINE TWO HERE
"""
        result = _import(seeded_db, production, script)
        assert result.songs_created == 1
        song = seeded_db.query(Song).one()
        assert song.title == "MY SONG"
        assert result.moments_created == 4  # header + attribution + 2 lyrics

    def test_builtin_ensemble_singer_without_dialogue(self, seeded_db, production):
        script = """# Act One
## Scene One - Test
### [CHORUS](https://example.com)
ENSEMBLE
WE ARE THE CHORUS LINE
"""
        result = _import(seeded_db, production, script)
        assert result.moments_created == 3
        ensemble = seeded_db.query(Character).filter(Character.name == "ENSEMBLE").one()
        assert ensemble is not None
        all_char = seeded_db.query(Character).filter(Character.name == "ALL").one()
        assert all_char is not None


class TestErrors:
    def test_unrecognized_line(self, seeded_db, production):
        script = """# Act One
## Scene One - Test
This is not valid script content.
"""
        with pytest.raises(ImportLineError) as exc:
            _import(seeded_db, production, script)
        assert exc.value.line_number == 3

    def test_reimport_rejected(self, seeded_db, production):
        script = """# Act One
## Scene One - Test
*Ok.*
"""
        _import(seeded_db, production, script)
        with pytest.raises(ValueError, match="re-import"):
            _import(seeded_db, production, script)


class TestEnduranceScene1:
    def test_full_fixture_import(self, seeded_db, production):
        from pathlib import Path

        fixture_path = (
            Path(__file__).resolve().parents[2]
            / "fixtures"
            / "scripts"
            / "endurance-scene1.md"
        )
        content = fixture_path.read_bytes()
        result = _import(seeded_db, production, content)

        assert result.acts_created == 1
        assert result.scenes_created == 1
        assert result.songs_created >= 2
        assert result.characters_created >= 6  # dialogue chars + ALL + ENSEMBLE
        assert result.moments_created >= 30

        act = seeded_db.query(Act).one()
        assert act.number == 1

        songs = seeded_db.query(Song).all()
        song_titles = {s.title for s in songs}
        assert "INTO THE DEEP (PRE-PRISE)" in song_titles
        assert "AGE OF ADVENTURE" in song_titles

        # Song-linked moments should have song_id set
        song_moments = seeded_db.query(Moment).filter(Moment.song_id.isnot(None)).all()
        assert len(song_moments) > 0

        crean = seeded_db.query(Character).filter(Character.name == "CREAN").first()
        assert crean is not None

        bri = seeded_db.query(Character).filter(Character.name == "BRI'ISH NEWSIE").first()
        assert bri is not None

        ensemble = seeded_db.query(Character).filter(Character.name == "ENSEMBLE").first()
        assert ensemble is not None

        # Mojibake sequences should be repaired in stored text
        moments = seeded_db.query(Moment).all()
        all_text = " ".join(m.original_text for m in moments)
        assert "\u00e2\u20ac\u2122" not in all_text
        assert "\u00e2\u20ac\u201c" not in all_text
