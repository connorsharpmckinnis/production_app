"""Transactional sequence_number helpers for structural moment editing."""

from sqlalchemy.orm import Session

from app.models import Moment


def shift_moments_from(db: Session, scene_id: int, from_sequence: int, delta: int) -> None:
    """Shift sequence numbers at or after from_sequence by delta within a scene."""
    moments = (
        db.query(Moment)
        .filter(Moment.scene_id == scene_id, Moment.sequence_number >= from_sequence)
        .order_by(Moment.sequence_number.desc() if delta > 0 else Moment.sequence_number)
        .all()
    )
    for moment in moments:
        moment.sequence_number += delta


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
            .order_by(Moment.sequence_number.desc())
            .all()
        )
        for sibling in siblings:
            sibling.sequence_number += 1
    else:
        siblings = (
            db.query(Moment)
            .filter(
                Moment.scene_id == scene_id,
                Moment.sequence_number > old_sequence,
                Moment.sequence_number <= new_sequence,
                Moment.id != moment.id,
            )
            .order_by(Moment.sequence_number)
            .all()
        )
        for sibling in siblings:
            sibling.sequence_number -= 1

    moment.sequence_number = new_sequence
