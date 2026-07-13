"""Unit tests for script importer classification."""

from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Act, Character, Moment, Organization, Production, Song
from app.services.importer import ImportLineError, import_script
from app.services.importer.extract import extract_script_lines
from app.services.importer.preprocessing import (
    ScriptDecodeError,
    decode_script_bytes,
    preprocess_script,
    unescape_markdown_artifacts,
)


FIXTURES = Path(__file__).resolve().parents[2] / "fixtures" / "scripts"


@pytest.fixture
def seeded_db(db_session: Session, test_settings) -> Session:
    seed_database(db_session, test_settings)
    return db_session


@pytest.fixture
def production(seeded_db: Session, test_settings) -> Production:
    org = seeded_db.query(Organization).first()
    prod = Production(organization_id=org.id, title="Test Production")
    seeded_db.add(prod)
    seeded_db.commit()
    seeded_db.refresh(prod)
    return prod


def _import(db: Session, production: Production, script: str | bytes, filename: str | None = None):
    return import_script(db, production, script, filename=filename)


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

    def test_mojibake_repair_modifier_tilde_quotes(self, seeded_db, production):
        script = """# Act One
## Scene One - Test
*Music freezes on \u00e2\u20ac\u02dcTom. Danger. Crean.\u00e2\u20ac\u2122*
"""
        result = _import(seeded_db, production, script)
        assert result.moments_created == 1
        moment = seeded_db.query(Moment).first()
        assert "'Tom. Danger. Crean.'" in moment.original_text
        assert "\u00e2" not in moment.original_text

    def test_mojibake_smart_double_quotes(self):
        lines = preprocess_script(
            'CREAN: He said \u00e2\u20ac\u0153hello\u00e2\u20ac\u009d there.',
        )
        assert lines[0] == 'CREAN: He said "hello" there.'

    def test_markdown_unescape(self):
        assert unescape_markdown_artifacts(r"everybody\!") == "everybody!"
        assert unescape_markdown_artifacts(r"Scene One \- Title") == "Scene One - Title"
        text = preprocess_script(r"CREAN: everybody\! go.")[0]
        assert text == "CREAN: everybody! go."

    def test_decode_non_utf8_fails_clearly(self):
        with pytest.raises(ScriptDecodeError, match="UTF-8"):
            decode_script_bytes(b"\xff\xfe\x00\x00 bad")


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
        # Admin create-time title wins; script title is reported only.
        assert production.title == "Test Production"
        assert result.script_title == "My Show"
        assert production.author == "Writer"

    def test_admin_title_not_overwritten(self, seeded_db, production):
        production.title = "Admin Chosen Name"
        seeded_db.commit()

        script = """# Title: Script Name
## Author: Playwright
# Act One
## Scene One - Opening
*Lights up.*
"""
        result = _import(seeded_db, production, script)
        seeded_db.refresh(production)
        assert production.title == "Admin Chosen Name"
        assert result.script_title == "Script Name"
        assert production.author == "Playwright"

    def test_plain_script_format_aliases(self, seeded_db, production):
        script = """Title: Plain Show
Author: Plain Writer
Act 1
Scene 1 - Opening Bit
*Lights up.*
NAME: Hello.
"""
        result = _import(seeded_db, production, script)
        assert result.acts_created == 1
        assert result.scenes_created == 1
        seeded_db.refresh(production)
        assert production.title == "Test Production"
        assert production.author == "Plain Writer"
        assert result.script_title == "Plain Show"

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

    def test_plain_song_header_without_link(self, seeded_db, production):
        script = """# Act One
## Scene One - Test
### MY SONG (REPRISE)
ALL
LINE ONE HERE
"""
        result = _import(seeded_db, production, script)
        assert result.songs_created == 1
        song = seeded_db.query(Song).one()
        assert song.title == "MY SONG (REPRISE)"
        assert result.moments_created == 3

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
        content = (FIXTURES / "endurance-scene1.md").read_bytes()
        result = _import(seeded_db, production, content, filename="endurance-scene1.md")

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
        # Markdown escapes should not remain in sacred text
        assert r"\!" not in all_text


class TestDocxImport:
    def test_endurance_scene1_docx(self, seeded_db, production):
        fixture = FIXTURES / "Endurance Scene 1.docx"
        content = fixture.read_bytes()
        result = _import(
            seeded_db,
            production,
            content,
            filename="Endurance Scene 1.docx",
        )

        assert result.acts_created == 1
        assert result.scenes_created == 1
        assert result.songs_created >= 2
        assert result.characters_created >= 6
        assert result.moments_created >= 30

        seeded_db.refresh(production)
        assert production.title == "Test Production"
        assert result.script_title == "Endurance"
        assert production.author == "Connor McKinnis"

        song_titles = {s.title for s in seeded_db.query(Song).all()}
        assert "INTO THE DEEP (PRE-PRISE)" in song_titles
        assert "AGE OF ADVENTURE" in song_titles

        age = seeded_db.query(Song).filter(Song.title == "AGE OF ADVENTURE").one()
        assert age.description is not None
        assert "bold, optimistic" in age.description.lower()

        crean = seeded_db.query(Character).filter(Character.name == "CREAN").first()
        assert crean is not None

    def test_corrupt_docx_fails_clearly(self, seeded_db, production):
        with pytest.raises(ValueError, match="DOCX|Word"):
            _import(seeded_db, production, b"not a docx", filename="bad.docx")

    def test_unsupported_extension_rejected(self):
        with pytest.raises(ValueError, match="Unsupported"):
            extract_script_lines("script.txt", b"Act 1\n")
