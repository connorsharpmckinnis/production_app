"""Persistence helpers and read-only starter import profiles."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import ImportProfile
from app.services.importer.profiles import ImportProfileDefinition


def lifehouse_profile_definition() -> ImportProfileDefinition:
    """Return a cloneable two-column PDF starter, not engine configuration."""
    return ImportProfileDefinition.model_validate(
        {
            "name": "LifeHouse two-column PDF",
            "description": (
                "Starter for scripts with speaker labels in a left column and "
                "dialogue or lyrics in a right column. Tuned for LifeHouse-style "
                "Pages/Quartz PDFs (Scrooge pilot)."
            ),
            "source_formats": ["pdf"],
            "version": 2,
            "pdf": {"start_page": 5},
            "speakers": {
                "require_all_caps": False,
                "allow_parentheses": True,
            },
            "rules": [
                {
                    "id": "page-number",
                    "name": "Ignore standalone page numbers",
                    "priority": 100,
                    "match": {"regex_match": r"\d+"},
                    "action": {"type": "ignore"},
                },
                {
                    "id": "copyright-header",
                    "name": "Ignore copyright header",
                    "priority": 100,
                    "match": {"text_contains": "Copyright"},
                    "action": {"type": "ignore"},
                },
                {
                    "id": "rights-header",
                    "name": "Ignore rights header",
                    "priority": 100,
                    "match": {"text_contains": "All rights reserved"},
                    "action": {"type": "ignore"},
                },
                {
                    "id": "running-title",
                    "name": "Ignore running show title",
                    "priority": 100,
                    "match": {"regex_match": "[\"“]Scrooge![\"”]"},
                    "action": {"type": "ignore"},
                },
                {
                    "id": "stray-punctuation",
                    "name": "Ignore standalone punctuation artifacts",
                    "priority": 100,
                    "match": {"regex_match": r"[.\-–—]+"},
                    "action": {"type": "ignore"},
                },
                {
                    "id": "finale-heading",
                    "name": "Ignore FINALE section marker",
                    "priority": 95,
                    "match": {"regex_match": r"FINALE"},
                    "action": {"type": "ignore"},
                },
                {
                    "id": "composer-credit-open",
                    "name": "Ignore split composer-credit openings",
                    "priority": 95,
                    "match": {"regex_match": r"\([^)\n]*/\s*"},
                    "action": {"type": "ignore"},
                },
                {
                    "id": "composer-credit-close",
                    "name": "Ignore split composer-credit closings",
                    "priority": 95,
                    # Scrooge finale splits credits across lines: "(Watts/Handel/" then "Traditional)"
                    "match": {"regex_match": r"Traditional\)"},
                    "action": {"type": "ignore"},
                },
                {
                    "id": "act",
                    "name": "Act heading",
                    "priority": 90,
                    "match": {"regex_match": r"ACT\s+(?P<number>[IVXLC]+|\d+)"},
                    "action": {"type": "set_act", "number_capture": "number"},
                },
                {
                    "id": "scene",
                    "name": "Scene heading",
                    "priority": 90,
                    "match": {
                        "regex_match": (
                            r"SCENE\s+(?P<number>\d+)\s*:\s*(?P<title>.*)"
                        )
                    },
                    "action": {
                        "type": "set_scene",
                        "number_capture": "number",
                        "title_capture": "title",
                    },
                },
                {
                    "id": "song-header",
                    "name": "Song heading (allows Reprise / credits after title)",
                    "priority": 85,
                    "match": {
                        # fullmatch: allow trailing (Reprise), composer notes, etc.
                        "regex_match": r'SONG:\s*["“](?P<title>.+?)["”].*'
                    },
                    "action": {
                        "type": "song_header",
                        "text_capture": "title",
                    },
                },
                {
                    "id": "song-transition",
                    "name": "Parenthetical that ends the current song",
                    "priority": 84,
                    "match": {
                        "regex_match": (
                            r"\(.*(?:transition|introduction|segue|"
                            r"underscore|reprise).*\)"
                        ),
                        "inside_song_block": True,
                    },
                    "action": {
                        "type": "stage_direction",
                        "strip_outer_parens": True,
                        "end_song_block": True,
                    },
                },
                {
                    "id": "song-segue-line",
                    "name": "Segue line ends the current song",
                    "priority": 83,
                    "match": {
                        "text_contains": "Segue",
                        "inside_song_block": True,
                    },
                    "action": {
                        "type": "stage_direction",
                        "end_song_block": True,
                    },
                },
                {
                    "id": "parenthetical-continuation",
                    "name": "Continue a multi-line parenthetical",
                    "priority": 82,
                    "match": {"inside_parenthetical_block": True},
                    "action": {"type": "continue_previous"},
                },
                {
                    "id": "stage-direction",
                    "name": "Whole-line parenthetical stage direction",
                    "priority": 80,
                    "match": {"is_wrapped_in_parens": True},
                    "action": {
                        "type": "stage_direction",
                        "strip_outer_parens": True,
                    },
                },
                {
                    "id": "stage-direction-start",
                    "name": "Start a multi-line parenthetical",
                    "priority": 79,
                    "match": {"text_starts_with": "("},
                    "action": {"type": "stage_direction"},
                },
                {
                    "id": "span-stage-direction",
                    "name": "Parenthetical note near the speaker column",
                    "priority": 78,
                    "scope": "span",
                    "match": {
                        "is_wrapped_in_parens": True,
                        "x0_lte": 130,
                    },
                    "action": {"type": "stage_direction"},
                },
                {
                    "id": "speaker",
                    "name": "Character name in the left (speaker) column",
                    "priority": 70,
                    "scope": "span",
                    "match": {
                        "x0_lte": 130,
                        "word_count_lte": 6,
                        "char_count_lte": 40,
                    },
                    "action": {"type": "speaker"},
                },
                {
                    "id": "lyric",
                    "name": "Right-column lyric while a song is open",
                    "priority": 65,
                    "scope": "span",
                    "match": {"x0_gte": 130, "inside_song_block": True},
                    "action": {"type": "lyric"},
                },
                {
                    "id": "dialogue",
                    "name": "Right-column dialogue (outside or after a song)",
                    "priority": 60,
                    "scope": "span",
                    "match": {"x0_gte": 130},
                    "action": {"type": "dialogue"},
                },
            ],
        }
    )


def definition_from_model(profile: ImportProfile) -> ImportProfileDefinition:
    return ImportProfileDefinition(
        name=profile.name,
        description=profile.description,
        source_formats=profile.source_formats,
        version=profile.version,
        rules=profile.rules,
        pdf=profile.pdf_options,
        speakers=profile.speaker_options,
    )


def apply_definition(
    profile: ImportProfile,
    definition: ImportProfileDefinition,
) -> None:
    data = definition.model_dump(mode="json")
    profile.name = data["name"]
    profile.description = data["description"]
    profile.source_formats = data["source_formats"]
    profile.version = data["version"]
    profile.rules = data["rules"]
    profile.pdf_options = data["pdf"]
    profile.speaker_options = data["speakers"]


def ensure_builtin_import_profiles(db: Session) -> None:
    """Create or refresh code-owned templates without touching user profiles."""
    definition = lifehouse_profile_definition()
    existing = (
        db.query(ImportProfile)
        .filter(
            ImportProfile.organization_id.is_(None),
            ImportProfile.name == "LifeHouse two-column PDF",
            ImportProfile.is_builtin.is_(True),
        )
        .first()
    )
    if existing is not None:
        apply_definition(existing, definition)
        db.flush()
        return

    profile = ImportProfile(organization_id=None, is_builtin=True)
    apply_definition(profile, definition)
    db.add(profile)
    db.flush()
