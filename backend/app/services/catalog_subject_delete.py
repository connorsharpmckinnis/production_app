"""Safe delete for Characters and Groups with optional subject reassignment.

Moment subjects (dialogue, lyrics, song attribution, entrances/exits, blocking)
use Character XOR Group. When the deleted subject is still referenced, callers
must supply a same-production reassignment target. Character-only rows
(costumes, lav, etc.) can move to another Character but not to a Group.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import func, update
from sqlalchemy.orm import Session

from app.models import (
    Character,
    CharacterGroup,
    Costume,
    Dialogue,
    Group,
    LavPackAssignment,
    LavWireAssignment,
    LyricLine,
    MomentBlocking,
    MomentCostumeEvent,
    MomentEntrance,
    MomentExit,
    MomentPropEvent,
    MomentSetPieceEvent,
    Note,
    SongAttributionCharacter,
    UserCharacterAssignment,
    UserGroup,
)

SubjectType = Literal["character", "group"]

# Tables that use character XOR group as the moment subject.
_XOR_MODELS: tuple[type, ...] = (
    Dialogue,
    LyricLine,
    SongAttributionCharacter,
    MomentEntrance,
    MomentExit,
    MomentBlocking,
)

_XOR_LABELS = {
    Dialogue: "dialogue",
    LyricLine: "lyric_lines",
    SongAttributionCharacter: "song_attributions",
    MomentEntrance: "entrances",
    MomentExit: "exits",
    MomentBlocking: "blocking",
}


@dataclass
class DeleteImpact:
    reassignable: dict[str, int] = field(default_factory=dict)
    character_only_blockers: dict[str, int] = field(default_factory=dict)
    auto_removed: dict[str, int] = field(default_factory=dict)

    @property
    def reassignable_total(self) -> int:
        return sum(self.reassignable.values())

    @property
    def blocker_total(self) -> int:
        return sum(self.character_only_blockers.values())

    @property
    def requires_reassignment(self) -> bool:
        return self.reassignable_total > 0 or self.blocker_total > 0

    @property
    def can_delete_without_reassignment(self) -> bool:
        return not self.requires_reassignment


def _count(db: Session, model: type, **filters: int) -> int:
    query = db.query(func.count()).select_from(model)
    for column_name, value in filters.items():
        query = query.filter(getattr(model, column_name) == value)
    return int(query.scalar() or 0)


def character_delete_impact(db: Session, character_id: int) -> DeleteImpact:
    reassignable = {
        label: _count(db, model, character_id=character_id)
        for model, label in _XOR_LABELS.items()
    }
    blockers = {
        "costumes": _count(db, Costume, character_id=character_id),
        "costume_events": _count(db, MomentCostumeEvent, character_id=character_id),
        "lav_pack_assignments": _count(db, LavPackAssignment, character_id=character_id),
        "lav_wire_assignments": _count(db, LavWireAssignment, character_id=character_id),
        "prop_events": _count(db, MomentPropEvent, character_id=character_id),
        "set_piece_events": _count(db, MomentSetPieceEvent, character_id=character_id),
    }
    auto_removed = {
        "casting": _count(db, UserCharacterAssignment, character_id=character_id),
        "notes": _count(db, Note, character_id=character_id),
        "group_memberships": _count(db, CharacterGroup, character_id=character_id),
    }
    return DeleteImpact(
        reassignable={k: v for k, v in reassignable.items() if v},
        character_only_blockers={k: v for k, v in blockers.items() if v},
        auto_removed={k: v for k, v in auto_removed.items() if v},
    )


def group_delete_impact(db: Session, group_id: int) -> DeleteImpact:
    reassignable = {
        label: _count(db, model, group_id=group_id) for model, label in _XOR_LABELS.items()
    }
    auto_removed = {
        "character_memberships": _count(db, CharacterGroup, group_id=group_id),
        "user_memberships": _count(db, UserGroup, group_id=group_id),
    }
    return DeleteImpact(
        reassignable={k: v for k, v in reassignable.items() if v},
        character_only_blockers={},
        auto_removed={k: v for k, v in auto_removed.items() if v},
    )


def _impact_http_detail(impact: DeleteImpact, *, entity: str) -> dict:
    if impact.blocker_total and impact.reassignable_total:
        message = (
            f"This {entity} has attributed Moments and character-only records. "
            "Reassign Moments to another character or group; character-only "
            "records (costumes, lav, etc.) can only move to another character."
        )
        code = "reassignment_required"
    elif impact.blocker_total:
        message = (
            f"This {entity} has character-only records that cannot move to a group. "
            "Reassign them to another character, or remove costumes/lav/prop "
            "affiliations first."
        )
        code = "character_only_blockers"
    else:
        message = (
            f"This {entity} is still used on Moments. Choose another character "
            "or group to receive those attributions before deleting."
        )
        code = "reassignment_required"
    return {
        "code": code,
        "message": message,
        "reassignable": impact.reassignable,
        "character_only_blockers": impact.character_only_blockers,
        "auto_removed": impact.auto_removed,
    }


def _resolve_target(
    db: Session,
    production_id: int,
    *,
    source_type: SubjectType,
    source_id: int,
    target_type: SubjectType,
    target_id: int,
) -> Character | Group:
    if target_type == source_type and target_id == source_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot reassign to the same character or group being deleted",
        )
    if target_type == "character":
        target = (
            db.query(Character)
            .filter(Character.id == target_id, Character.production_id == production_id)
            .first()
        )
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reassignment target character not found",
            )
        return target
    target = (
        db.query(Group)
        .filter(Group.id == target_id, Group.production_id == production_id)
        .first()
    )
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reassignment target group not found",
        )
    return target


def _target_filters(target_type: SubjectType, target_id: int) -> dict[str, int | None]:
    if target_type == "character":
        return {"character_id": target_id, "group_id": None}
    return {"character_id": None, "group_id": target_id}


def _reassign_xor_rows(
    db: Session,
    *,
    source_type: SubjectType,
    source_id: int,
    target_type: SubjectType,
    target_id: int,
) -> None:
    """Move XOR subject rows to the target, dropping source rows that would collide."""
    source_col = "character_id" if source_type == "character" else "group_id"
    target_col = "character_id" if target_type == "character" else "group_id"
    target_values = _target_filters(target_type, target_id)

    for model in _XOR_MODELS:
        source_rows = (
            db.query(model).filter(getattr(model, source_col) == source_id).all()
        )
        for row in source_rows:
            collision = (
                db.query(model.id)
                .filter(
                    model.moment_id == row.moment_id,
                    getattr(model, target_col) == target_id,
                )
                .first()
            )
            if collision is not None:
                db.delete(row)
                continue
            row.character_id = target_values["character_id"]
            row.group_id = target_values["group_id"]


def _reassign_character_only_to_character(
    db: Session,
    *,
    source_id: int,
    target_id: int,
) -> None:
    """Move character-only FKs to another character; drop rows that would collide."""

    # Costumes: always remappable (no uniqueness on character).
    db.execute(
        update(Costume)
        .where(Costume.character_id == source_id)
        .values(character_id=target_id)
    )

    # Costume events: unique (moment_id, character_id)
    for row in (
        db.query(MomentCostumeEvent)
        .filter(MomentCostumeEvent.character_id == source_id)
        .all()
    ):
        collision = (
            db.query(MomentCostumeEvent.id)
            .filter(
                MomentCostumeEvent.moment_id == row.moment_id,
                MomentCostumeEvent.character_id == target_id,
            )
            .first()
        )
        if collision is not None:
            db.delete(row)
        else:
            row.character_id = target_id

    # Lav pack/wire: unique (production_id, scene_id, character_id)
    for model in (LavPackAssignment, LavWireAssignment):
        for row in db.query(model).filter(model.character_id == source_id).all():
            collision = (
                db.query(model.id)
                .filter(
                    model.production_id == row.production_id,
                    model.scene_id == row.scene_id,
                    model.character_id == target_id,
                )
                .first()
            )
            if collision is not None:
                db.delete(row)
            else:
                row.character_id = target_id

    # Prop / set events: soft affiliation; remapping is fine (no unique on character).
    db.execute(
        update(MomentPropEvent)
        .where(MomentPropEvent.character_id == source_id)
        .values(character_id=target_id)
    )
    db.execute(
        update(MomentSetPieceEvent)
        .where(MomentSetPieceEvent.character_id == source_id)
        .values(character_id=target_id)
    )

    # Notes: optional character target — move rather than drop when remapping.
    db.execute(
        update(Note).where(Note.character_id == source_id).values(character_id=target_id)
    )

    # Casting: one actor per character. Prefer keeping the target's cast if both exist.
    source_cast = (
        db.query(UserCharacterAssignment)
        .filter(UserCharacterAssignment.character_id == source_id)
        .first()
    )
    if source_cast is not None:
        target_cast = (
            db.query(UserCharacterAssignment)
            .filter(UserCharacterAssignment.character_id == target_id)
            .first()
        )
        if target_cast is not None:
            db.delete(source_cast)
        else:
            source_cast.character_id = target_id


def delete_character(
    db: Session,
    production_id: int,
    character_id: int,
    *,
    reassign_to_type: SubjectType | None = None,
    reassign_to_id: int | None = None,
) -> None:
    character = (
        db.query(Character)
        .filter(Character.id == character_id, Character.production_id == production_id)
        .first()
    )
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")

    impact = character_delete_impact(db, character_id)
    has_target = reassign_to_type is not None and reassign_to_id is not None

    if not has_target:
        if impact.requires_reassignment:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_impact_http_detail(impact, entity="character"),
            )
    else:
        assert reassign_to_type is not None and reassign_to_id is not None
        _resolve_target(
            db,
            production_id,
            source_type="character",
            source_id=character_id,
            target_type=reassign_to_type,
            target_id=reassign_to_id,
        )
        if impact.blocker_total and reassign_to_type == "group":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "character_only_blockers",
                    "message": (
                        "Cannot reassign to a group while this character still has "
                        "costumes, lav assignments, or prop/set affiliations. "
                        "Choose another character, or remove those records first."
                    ),
                    "reassignable": impact.reassignable,
                    "character_only_blockers": impact.character_only_blockers,
                    "auto_removed": impact.auto_removed,
                },
            )
        if impact.reassignable_total:
            _reassign_xor_rows(
                db,
                source_type="character",
                source_id=character_id,
                target_type=reassign_to_type,
                target_id=reassign_to_id,
            )
        if impact.blocker_total and reassign_to_type == "character":
            _reassign_character_only_to_character(
                db,
                source_id=character_id,
                target_id=reassign_to_id,
            )

    # Clear group memberships (association table has no ON DELETE CASCADE).
    db.query(CharacterGroup).filter(CharacterGroup.character_id == character_id).delete(
        synchronize_session=False
    )

    # Drop casting / detach notes that were not remapped (group target or no target).
    if not (has_target and reassign_to_type == "character"):
        db.query(UserCharacterAssignment).filter(
            UserCharacterAssignment.character_id == character_id
        ).delete(synchronize_session=False)
        # Keep notes that still target a moment or rehearsal; delete character-only notes.
        db.query(Note).filter(
            Note.character_id == character_id,
            Note.moment_id.is_(None),
            Note.rehearsal_id.is_(None),
        ).delete(synchronize_session=False)
        db.execute(
            update(Note)
            .where(Note.character_id == character_id)
            .values(character_id=None)
        )

    db.delete(character)
    db.commit()


def delete_group(
    db: Session,
    production_id: int,
    group_id: int,
    *,
    reassign_to_type: SubjectType | None = None,
    reassign_to_id: int | None = None,
) -> None:
    group = (
        db.query(Group)
        .filter(Group.id == group_id, Group.production_id == production_id)
        .first()
    )
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    impact = group_delete_impact(db, group_id)
    has_target = reassign_to_type is not None and reassign_to_id is not None

    if not has_target:
        if impact.requires_reassignment:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=_impact_http_detail(impact, entity="group"),
            )
    else:
        assert reassign_to_type is not None and reassign_to_id is not None
        _resolve_target(
            db,
            production_id,
            source_type="group",
            source_id=group_id,
            target_type=reassign_to_type,
            target_id=reassign_to_id,
        )
        if impact.reassignable_total:
            _reassign_xor_rows(
                db,
                source_type="group",
                source_id=group_id,
                target_type=reassign_to_type,
                target_id=reassign_to_id,
            )

    db.query(CharacterGroup).filter(CharacterGroup.group_id == group_id).delete(
        synchronize_session=False
    )
    db.query(UserGroup).filter(UserGroup.group_id == group_id).delete(
        synchronize_session=False
    )

    db.delete(group)
    db.commit()
