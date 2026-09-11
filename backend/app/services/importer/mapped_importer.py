"""Persist a validated profile-classified preview into Timeline records."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import (
    Act,
    Character,
    Dialogue,
    LyricLine,
    Moment,
    MomentType,
    Production,
    Scene,
    Song,
    SongAttributionCharacter,
    StageDirection,
)
from app.services.importer.errors import ImportIssue, ImportLineError
from app.services.importer.importer import ImportResult
from app.services.importer.rule_engine import ImportPreview, PreviewMoment


def _preview_issues(preview: ImportPreview) -> list[ImportIssue]:
    issues = [
        ImportIssue(
            line_number=item.line_number,
            line_content=item.text,
            message="No import-profile rule matched this line",
            source_format="pdf",
        )
        for item in preview.unclassified
    ]
    issues.extend(
        ImportIssue(
            line_number=warning.line_number,
            line_content="",
            message=f"Import blocked by warning: {warning.message}",
            source_format="pdf",
        )
        for warning in preview.warnings
    )
    return sorted(issues, key=lambda issue: issue.line_number)


def _get_character(
    db: Session,
    production: Production,
    characters: dict[str, Character],
    name: str,
) -> Character:
    if name not in characters:
        character = Character(production_id=production.id, name=name)
        db.add(character)
        db.flush()
        characters[name] = character
    return characters[name]


def _add_moment_details(
    db: Session,
    production: Production,
    preview_moment: PreviewMoment,
    moment: Moment,
    characters: dict[str, Character],
) -> None:
    if preview_moment.type == "stage_direction":
        db.add(
            StageDirection(
                moment_id=moment.id,
                direction_text=preview_moment.text,
            )
        )
        return

    moment_characters = [
        _get_character(db, production, characters, name)
        for name in preview_moment.speakers
    ]
    if preview_moment.type == "dialogue":
        for character in moment_characters:
            db.add(
                Dialogue(
                    moment_id=moment.id,
                    character_id=character.id,
                    dialogue_text=preview_moment.text,
                )
            )
    elif preview_moment.type == "lyric":
        for character in moment_characters:
            db.add(
                LyricLine(
                    moment_id=moment.id,
                    character_id=character.id,
                    lyric_text=preview_moment.text,
                )
            )
    elif preview_moment.type == "song_attribution":
        for character in moment_characters:
            db.add(
                SongAttributionCharacter(
                    moment_id=moment.id,
                    character_id=character.id,
                )
            )


def persist_profile_preview(
    db: Session,
    production: Production,
    preview: ImportPreview,
) -> ImportResult:
    """Write the exact already-classified preview or roll back completely."""
    if db.query(Act).filter(Act.production_id == production.id).count():
        raise ValueError("Production already has imported content; re-import is not allowed")

    issues = _preview_issues(preview)
    if issues:
        raise ImportLineError(issues)
    if not preview.acts:
        raise ValueError("Import profile did not produce any acts")

    moment_types = {item.name: item for item in db.query(MomentType).all()}
    required_types = {moment.type for moment in preview.moments}
    missing_types = required_types.difference(moment_types)
    if missing_types:
        raise ValueError(f"Missing Moment types: {', '.join(sorted(missing_types))}")

    characters: dict[str, Character] = {}
    current_song: Song | None = None
    result = ImportResult()

    try:
        for act_order, preview_act in enumerate(preview.acts, start=1):
            act = Act(
                production_id=production.id,
                number=preview_act.number,
                # ActSummary historically required a string; keep a display default
                # when profile headings only capture a number (e.g. "ACT I").
                title=preview_act.title or f"Act {preview_act.number}",
                sort_order=act_order,
            )
            db.add(act)
            db.flush()
            result.acts_created += 1

            for scene_order, preview_scene in enumerate(preview_act.scenes, start=1):
                scene = Scene(
                    act_id=act.id,
                    number=preview_scene.number,
                    title=preview_scene.title,
                    sort_order=scene_order,
                )
                db.add(scene)
                db.flush()
                result.scenes_created += 1
                current_song = None

                for sequence_number, preview_moment in enumerate(
                    preview_scene.moments,
                    start=1,
                ):
                    if preview_moment.type == "song_header":
                        current_song = Song(
                            production_id=production.id,
                            title=preview_moment.title or preview_moment.text,
                        )
                        db.add(current_song)
                        db.flush()
                        result.songs_created += 1

                    moment = Moment(
                        scene_id=scene.id,
                        moment_type_id=moment_types[preview_moment.type].id,
                        song_id=(
                            current_song.id
                            if current_song is not None
                            and preview_moment.type
                            in {"song_header", "song_attribution", "lyric"}
                            else None
                        ),
                        sequence_number=sequence_number,
                        original_text=preview_moment.original_text or preview_moment.text,
                        parsed_text=preview_moment.text,
                    )
                    db.add(moment)
                    db.flush()
                    result.moments_created += 1
                    _add_moment_details(
                        db,
                        production,
                        preview_moment,
                        moment,
                        characters,
                    )

        result.characters_created = len(characters)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise

