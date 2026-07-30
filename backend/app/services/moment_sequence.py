"""Transactional sequence_number helpers for structural moment editing."""

from sqlalchemy.orm import Session

from app.models import Moment


def _apply_sequence_updates(
    db: Session,
    planned: list[tuple[Moment, int]],
) -> None:
    """Assign new sequence numbers without mid-update unique collisions.

    Parks rows at temporary negative values (``-id``) first, then applies finals.
    """
    if not planned:
        return
    for moment, _ in planned:
        moment.sequence_number = -moment.id
    db.flush()
    for moment, new_sequence in planned:
        moment.sequence_number = new_sequence


def shift_moments_from(db: Session, scene_id: int, from_sequence: int, delta: int) -> None:
    """Shift sequence numbers at or after from_sequence by delta within a scene."""
    moments = (
        db.query(Moment)
        .filter(Moment.scene_id == scene_id, Moment.sequence_number >= from_sequence)
        .all()
    )
    planned = [(moment, moment.sequence_number + delta) for moment in moments]
    _apply_sequence_updates(db, planned)


def renumber_moments_after_delete(db: Session, scene_id: int, deleted_sequence: int) -> None:
    """Close the gap left by deleting a moment at deleted_sequence."""
    shift_moments_from(db, scene_id, deleted_sequence + 1, -1)


def move_moment_sequence(
    db: Session,
    moment: Moment,
    new_sequence: int,
) -> None:
    """Move a moment to new_sequence within its scene, renumbering siblings."""
    old_sequence = moment.sequence_number
    if old_sequence == new_sequence:
        return

    scene_id = moment.scene_id
    if new_sequence < old_sequence:
        siblings = (
            db.query(Moment)
            .filter(
                Moment.scene_id == scene_id,
                Moment.sequence_number >= new_sequence,
                Moment.sequence_number < old_sequence,
                Moment.id != moment.id,
            )
            .all()
        )
        planned: list[tuple[Moment, int]] = [
            (sibling, sibling.sequence_number + 1) for sibling in siblings
        ]
        planned.append((moment, new_sequence))
    else:
        siblings = (
            db.query(Moment)
            .filter(
                Moment.scene_id == scene_id,
                Moment.sequence_number > old_sequence,
                Moment.sequence_number <= new_sequence,
                Moment.id != moment.id,
            )
            .all()
        )
        planned = [(sibling, sibling.sequence_number - 1) for sibling in siblings]
        planned.append((moment, new_sequence))

    _apply_sequence_updates(db, planned)
