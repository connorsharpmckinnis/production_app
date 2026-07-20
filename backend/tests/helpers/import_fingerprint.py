"""Normalized semantic fingerprints for Markdown/DOCX import parity tests."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.models import Act, Character, Production, Song


def normalize_source_markup(text: str | None) -> str | None:
    """Strip Markdown-only footnotes and emphasis for cross-format comparison."""
    if text is None:
        return None
    without_footnotes = re.sub(r"\s*\[\^\d+\]", "", text)
    return without_footnotes.replace("*", "")


def semantic_import_fingerprint(db: Session, production: Production) -> dict:
    """Build an exact, format-normalized comparison of imported production data."""
    acts = (
        db.query(Act)
        .filter(Act.production_id == production.id)
        .order_by(Act.sort_order, Act.id)
        .all()
    )
    structure = []
    moments = []
    for act in acts:
        for scene in sorted(act.scenes, key=lambda item: (item.sort_order, item.id)):
            structure.append((act.number, act.title, scene.number, scene.title))
            for moment in sorted(
                scene.moments,
                key=lambda item: (item.sequence_number, item.id),
            ):
                moment_type = moment.moment_type.name
                speakers = tuple(
                    dialogue.character.name
                    for dialogue in sorted(
                        moment.dialogue_lines,
                        key=lambda item: item.id,
                    )
                )
                if moment_type == "dialogue":
                    semantic_text = normalize_source_markup(moment.parsed_text)
                elif moment_type == "stage_direction":
                    semantic_text = normalize_source_markup(
                        moment.stage_directions[0].direction_text,
                    )
                elif moment_type == "song_header":
                    semantic_text = moment.song.title if moment.song else None
                else:
                    semantic_text = normalize_source_markup(
                        moment.original_text.removeprefix("#### ").strip(),
                    )
                moments.append(
                    (
                        act.number,
                        scene.number,
                        moment.sequence_number,
                        moment_type,
                        semantic_text,
                        speakers,
                        moment.song.title if moment.song else None,
                    ),
                )

    songs = tuple(
        (song.title, song.description)
        for song in db.query(Song)
        .filter(Song.production_id == production.id)
        .order_by(Song.id)
    )
    characters = tuple(
        character.name
        for character in db.query(Character)
        .filter(Character.production_id == production.id)
        .order_by(Character.name)
    )
    return {
        "structure": tuple(structure),
        "moments": tuple(moments),
        "songs": songs,
        "characters": characters,
    }
