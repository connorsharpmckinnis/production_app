"""Stamp a rehearsal onto notes and attachments at save time."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Rehearsal

_WINDOW = timedelta(hours=1)


def matching_rehearsal_id(
    db: Session,
    production_id: int,
    now: datetime | None = None,
) -> int | None:
    """Return the rehearsal this save belongs to, or None.

    A save belongs to a rehearsal when its time falls in that rehearsal's slot
    plus or minus one hour. Stamp only when exactly one non-cancelled rehearsal
    matches. Open and complete status are ignored.
    """

    moment = now or datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)

    rehearsals = (
        db.query(Rehearsal)
        .filter(
            Rehearsal.production_id == production_id,
            Rehearsal.status != "cancelled",
            Rehearsal.starts_at <= moment + _WINDOW,
            Rehearsal.ends_at >= moment - _WINDOW,
        )
        .all()
    )
    if len(rehearsals) == 1:
        return rehearsals[0].id
    return None
