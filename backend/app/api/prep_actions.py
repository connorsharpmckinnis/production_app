"""Approve a suggested Timeline attachment."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_accessible_production, require_production_capability
from app.db.session import get_db
from app.models import (
    Act,
    Cue,
    Moment,
    MomentBlocking,
    MomentCostumeEvent,
    MomentEntrance,
    MomentExit,
    MomentPropEvent,
    MomentSetPieceEvent,
    Scene,
    User,
)
from app.services.prep_records import approve_attachment, can_approve, prep_fields

router = APIRouter(prefix="/productions", tags=["prep-actions"])

AttachmentKind = Literal[
    "entrance",
    "exit",
    "blocking",
    "prop_event",
    "set_piece_event",
    "costume_event",
    "cue",
]

_MODELS = {
    "entrance": MomentEntrance,
    "exit": MomentExit,
    "blocking": MomentBlocking,
    "prop_event": MomentPropEvent,
    "set_piece_event": MomentSetPieceEvent,
    "costume_event": MomentCostumeEvent,
    "cue": Cue,
}


class ApproveAttachmentRequest(BaseModel):
    kind: AttachmentKind
    id: int


class ApproveAttachmentResponse(BaseModel):
    kind: AttachmentKind
    id: int
    status: str
    updated_by_display_name: str | None = None
    rehearsal_id: int | None = None
    rehearsal_label: str | None = None


@router.post(
    "/{production_id}/attachments/approve",
    response_model=ApproveAttachmentResponse,
)
def approve_suggested_attachment(
    production_id: int,
    body: ApproveAttachmentRequest,
    user: User = Depends(require_production_capability("timeline", "read")),
    db: Session = Depends(get_db),
) -> ApproveAttachmentResponse:
    production = get_accessible_production(db, user, production_id)
    if not can_approve(db, user, production):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="timeline approve access required",
        )

    model = _MODELS[body.kind]
    row = db.get(model, body.id)
    if row is None or not _row_in_production(db, production_id, row.moment_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    if row.status == "official":
        fields = prep_fields(row, db)
        return ApproveAttachmentResponse(kind=body.kind, id=row.id, **_approve_subset(fields))

    approve_attachment(row, user)
    db.commit()
    db.refresh(row)
    fields = prep_fields(row, db)
    return ApproveAttachmentResponse(kind=body.kind, id=row.id, **_approve_subset(fields))


def _row_in_production(db: Session, production_id: int, moment_id: int) -> bool:
    moment = (
        db.query(Moment.id)
        .join(Scene)
        .join(Act)
        .filter(Moment.id == moment_id, Act.production_id == production_id)
        .first()
    )
    return moment is not None


def _approve_subset(fields: dict) -> dict:
    return {
        "status": fields["status"],
        "updated_by_display_name": fields["updated_by_display_name"],
        "rehearsal_id": fields["rehearsal_id"],
        "rehearsal_label": fields["rehearsal_label"],
    }
