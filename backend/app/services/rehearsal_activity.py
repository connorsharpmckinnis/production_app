"""What was captured during one rehearsal."""

from datetime import timedelta

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import user_display_name
from app.api.notes import notes_visible_to_user
from app.models import (
    Cue,
    Moment,
    MomentBlocking,
    MomentCostumeEvent,
    MomentEntrance,
    MomentExit,
    MomentPropEvent,
    MomentSetPieceEvent,
    Note,
    Rehearsal,
    Scene,
    User,
)
from app.schemas.rehearsals import RehearsalActivityItem

_WINDOW = timedelta(hours=1)


def rehearsal_activity(
    db: Session,
    rehearsal: Rehearsal,
    user: User,
) -> list[RehearsalActivityItem]:
    window_start = rehearsal.starts_at - _WINDOW
    window_end = rehearsal.ends_at + _WINDOW
    items: list[RehearsalActivityItem] = []

    notes = (
        db.query(Note)
        .options(
            joinedload(Note.user),
            joinedload(Note.moment).joinedload(Moment.scene).joinedload(Scene.act),
            joinedload(Note.character),
        )
        .filter(Note.rehearsal_id == rehearsal.id)
        .all()
    )
    unstamped_notes = (
        db.query(Note)
        .options(
            joinedload(Note.user),
            joinedload(Note.moment).joinedload(Moment.scene).joinedload(Scene.act),
            joinedload(Note.character),
        )
        .filter(
            Note.rehearsal_id.is_(None),
            or_(
                Note.created_at.between(window_start, window_end),
                Note.updated_at.between(window_start, window_end),
            ),
        )
        .all()
    )
    production_id = rehearsal.production_id
    for note in notes_visible_to_user([*notes, *unstamped_notes], user):
        if not _note_in_production(note, production_id):
            continue
        items.append(
            RehearsalActivityItem(
                kind="note",
                id=note.id,
                summary=_note_summary(note),
                visibility=note.visibility,
                created_at=note.created_at,
                created_by_display_name=user_display_name(note.user),
                moment_id=note.moment_id,
                scene_id=note.moment.scene_id if note.moment is not None else None,
            )
        )

    specs = (
        (MomentEntrance, "entrance", _movement_summary),
        (MomentExit, "exit", _movement_summary),
        (MomentBlocking, "blocking", _blocking_summary),
        (MomentPropEvent, "prop_event", _prop_summary),
        (MomentSetPieceEvent, "set_piece_event", _set_piece_summary),
        (MomentCostumeEvent, "costume_event", _costume_summary),
        (Cue, "cue", _cue_summary),
    )
    for model, kind, summarizer in specs:
        rows = _rows_for_rehearsal(db, model, rehearsal, window_start, window_end)
        for row in rows:
            moment = row.moment
            if moment is None or moment.scene is None or moment.scene.act is None:
                continue
            if moment.scene.act.production_id != production_id:
                continue
            created_by = db.get(User, row.created_by_user_id) if row.created_by_user_id else None
            items.append(
                RehearsalActivityItem(
                    kind=kind,
                    id=row.id,
                    summary=summarizer(row),
                    status=row.status,
                    created_at=row.created_at,
                    created_by_display_name=user_display_name(created_by) if created_by else None,
                    moment_id=row.moment_id,
                    scene_id=moment.scene_id,
                )
            )

    items.sort(key=lambda item: item.created_at)
    return items


def _rows_for_rehearsal(db: Session, model, rehearsal: Rehearsal, window_start, window_end):
    stamped = (
        db.query(model)
        .options(_load_options(model))
        .filter(model.rehearsal_id == rehearsal.id)
        .all()
    )
    unstamped = (
        db.query(model)
        .options(_load_options(model))
        .filter(
            model.rehearsal_id.is_(None),
            or_(
                model.created_at.between(window_start, window_end),
                model.updated_at.between(window_start, window_end),
            ),
        )
        .all()
    )
    return [*stamped, *unstamped]


def _load_options(model):
    options = [joinedload(model.moment).joinedload(Moment.scene).joinedload(Scene.act)]
    if model is MomentEntrance or model is MomentExit:
        options.extend(
            [joinedload(model.character), joinedload(model.group), joinedload(model.user)]
        )
    elif model is MomentBlocking:
        options.extend(
            [joinedload(model.character), joinedload(model.group), joinedload(model.user)]
        )
    elif model is MomentPropEvent:
        options.append(joinedload(model.prop))
    elif model is MomentSetPieceEvent:
        options.append(joinedload(model.set_piece))
    elif model is MomentCostumeEvent:
        options.extend([joinedload(model.character), joinedload(model.costume)])
    elif model is Cue:
        options.append(joinedload(model.cue_category))
    return options


def _note_in_production(note: Note, production_id: int) -> bool:
    if note.rehearsal_id is not None:
        return True
    if note.moment is not None and note.moment.scene is not None and note.moment.scene.act is not None:
        return note.moment.scene.act.production_id == production_id
    if note.character is not None:
        return note.character.production_id == production_id
    return False


def _note_summary(note: Note) -> str:
    text = note.content.strip().replace("\n", " ")
    if len(text) > 140:
        text = text[:137] + "..."
    if note.moment_id is None:
        return f"Rehearsal note: {text}"
    return f"Moment note: {text}"


def _subject_name(row) -> str:
    if getattr(row, "character", None) is not None:
        return row.character.name
    if getattr(row, "group", None) is not None:
        return row.group.name
    if getattr(row, "user", None) is not None:
        return user_display_name(row.user)
    return "Someone"


def _movement_summary(row) -> str:
    label = "Entrance" if isinstance(row, MomentEntrance) else "Exit"
    return f"{label}: {_subject_name(row)}"


def _blocking_summary(row) -> str:
    return f"Blocking: {_subject_name(row)}"


def _prop_summary(row) -> str:
    return f"Prop {row.kind}: {row.prop.name}"


def _set_piece_summary(row) -> str:
    return f"Set piece {row.kind}: {row.set_piece.name}"


def _costume_summary(row) -> str:
    name = row.costume.name if row.costume is not None else "clear"
    return f"Costume {row.kind}: {row.character.name} — {name}"


def _cue_summary(row) -> str:
    return f"Cue: {row.title}"
