"""Evaluate suggestion rules and apply accept/dismiss."""

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models import MomentEntrance, Production, SuggestionDismissal, User
from app.schemas.suggestions import (
    SuggestionAcceptResponse,
    SuggestionActionResponse,
    SuggestionResponse,
    SuggestionSubjectResponse,
)
from app.services.analytics import record_event
from app.services.prep_records import prepare_new_attachment
from app.services.suggestions.context import load_scene_suggestion_context
from app.services.suggestions.rules.entrance_imminence import (
    RULE_SPEC as ENTRANCE_RULE,
    evaluate_entrance_imminence,
)
from app.services.suggestions.types import SuggestionDraft


RULE_EVALUATORS = {
    ENTRANCE_RULE.id: evaluate_entrance_imminence,
}


def _draft_to_response(
    draft: SuggestionDraft,
    *,
    dismissed: bool = False,
) -> SuggestionResponse:
    return SuggestionResponse(
        fingerprint=draft.fingerprint,
        rule_id=draft.rule_id,
        severity=draft.severity,
        title=draft.title,
        rationale=draft.rationale,
        anchor_moment_id=draft.anchor_moment_id,
        speaking_moment_id=draft.speaking_moment_id,
        scene_id=draft.scene_id,
        subject=SuggestionSubjectResponse(
            kind=draft.subject.kind,
            id=draft.subject.id,
            name=draft.subject.name,
        ),
        actions=[
            SuggestionActionResponse(
                kind=action.kind,
                moment_id=action.moment_id,
                character_id=action.character_id,
                group_id=action.group_id,
                user_id=action.user_id,
                notes=action.notes,
            )
            for action in draft.actions
        ],
        dismissed=dismissed,
    )


def list_dismissed_fingerprints(
    db: Session,
    production_id: int,
) -> set[str]:
    rows = (
        db.query(SuggestionDismissal.fingerprint)
        .filter(SuggestionDismissal.production_id == production_id)
        .all()
    )
    return {row[0] for row in rows}


def evaluate_scene_suggestions(
    db: Session,
    *,
    production_id: int,
    scene_id: int,
    rule_id: str | None = None,
    moment_id: int | None = None,
    include_dismissed: bool = False,
) -> list[SuggestionResponse]:
    ctx = load_scene_suggestion_context(
        db, production_id=production_id, scene_id=scene_id
    )
    dismissed = list_dismissed_fingerprints(db, production_id)

    drafts: list[SuggestionDraft] = []
    for rid, evaluator in RULE_EVALUATORS.items():
        if rule_id is not None and rid != rule_id:
            continue
        drafts.extend(evaluator(ctx))

    # Dedupe by fingerprint (later rules shouldn't collide in v1, but be safe)
    by_fp: dict[str, SuggestionDraft] = {}
    for draft in drafts:
        by_fp.setdefault(draft.fingerprint, draft)

    results: list[SuggestionResponse] = []
    for fingerprint, draft in by_fp.items():
        is_dismissed = fingerprint in dismissed
        if is_dismissed and not include_dismissed:
            continue
        if moment_id is not None and draft.anchor_moment_id != moment_id:
            continue
        results.append(_draft_to_response(draft, dismissed=is_dismissed))

    results.sort(key=lambda item: (item.anchor_moment_id, item.subject.name.lower()))
    return results


def _suggestion_event_properties(
    draft: SuggestionDraft,
    *,
    attachment_id: int | None = None,
    already_present: bool = False,
) -> dict:
    props: dict = {
        "rule_id": draft.rule_id,
        "fingerprint": draft.fingerprint,
        "scene_id": draft.scene_id,
        "anchor_moment_id": draft.anchor_moment_id,
        "speaking_moment_id": draft.speaking_moment_id,
        "subject_kind": draft.subject.kind,
        "subject_id": draft.subject.id,
        "subject_name": draft.subject.name,
    }
    if draft.actions:
        props["action_kind"] = draft.actions[0].kind
    if attachment_id is not None:
        props["attachment_id"] = attachment_id
    if already_present:
        props["already_present"] = True
    return props


def _ensure_dismissal(
    db: Session,
    *,
    production: Production,
    user: User,
    fingerprint: str,
) -> SuggestionDismissal:
    """Insert suppress-list row if missing (no commit)."""
    existing = (
        db.query(SuggestionDismissal)
        .filter(
            SuggestionDismissal.production_id == production.id,
            SuggestionDismissal.fingerprint == fingerprint,
        )
        .first()
    )
    if existing is not None:
        return existing

    row = SuggestionDismissal(
        production_id=production.id,
        fingerprint=fingerprint,
        dismissed_by_user_id=user.id,
    )
    db.add(row)
    return row


def dismiss_suggestion(
    db: Session,
    *,
    production: Production,
    user: User,
    fingerprint: str,
    draft: SuggestionDraft | None = None,
    record_analytics: bool = True,
) -> SuggestionDismissal:
    existing = (
        db.query(SuggestionDismissal)
        .filter(
            SuggestionDismissal.production_id == production.id,
            SuggestionDismissal.fingerprint == fingerprint,
        )
        .first()
    )
    if existing is not None:
        # Idempotent suppress — do not double-count dismissals.
        return existing

    row = SuggestionDismissal(
        production_id=production.id,
        fingerprint=fingerprint,
        dismissed_by_user_id=user.id,
    )
    db.add(row)

    if record_analytics:
        live = draft or _find_live_draft(
            db, production_id=production.id, fingerprint=fingerprint
        )
        properties = (
            _suggestion_event_properties(live)
            if live is not None
            else {"fingerprint": fingerprint}
        )
        # Prefer rule_id from fingerprint when draft already gone.
        if "rule_id" not in properties:
            properties["rule_id"] = fingerprint.split(":", 1)[0]
        record_event(
            db,
            event_name="suggestion.dismissed",
            user=user,
            production=production,
            properties=properties,
        )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(SuggestionDismissal)
            .filter(
                SuggestionDismissal.production_id == production.id,
                SuggestionDismissal.fingerprint == fingerprint,
            )
            .first()
        )
        if existing is None:
            raise
        return existing
    db.refresh(row)
    return row


def _find_live_draft(
    db: Session,
    *,
    production_id: int,
    fingerprint: str,
) -> SuggestionDraft | None:
    """Re-evaluate scenes until the fingerprint matches a live draft.

    Fingerprints encode scene_id, so we can parse it when present.
    """
    # fingerprint: rule:scene:{scene_id}:...
    parts = fingerprint.split(":")
    scene_id: int | None = None
    if len(parts) >= 3 and parts[1] == "scene":
        try:
            scene_id = int(parts[2])
        except ValueError:
            scene_id = None

    if scene_id is None:
        return None

    try:
        ctx = load_scene_suggestion_context(
            db, production_id=production_id, scene_id=scene_id
        )
    except ValueError:
        return None

    for evaluator in RULE_EVALUATORS.values():
        for draft in evaluator(ctx):
            if draft.fingerprint == fingerprint:
                return draft
    return None


def accept_suggestion(
    db: Session,
    *,
    production: Production,
    user: User,
    fingerprint: str,
) -> SuggestionAcceptResponse:
    draft = _find_live_draft(
        db, production_id=production.id, fingerprint=fingerprint
    )
    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Suggestion is no longer applicable",
        )

    if not draft.actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Suggestion has no actions",
        )

    action = draft.actions[0]
    if action.kind != "create_entrance":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported action kind: {action.kind}",
        )

    # Conflict / already present → treat as applied
    existing_query = db.query(MomentEntrance).filter(
        MomentEntrance.moment_id == action.moment_id
    )
    if action.character_id is not None:
        existing_query = existing_query.filter(
            MomentEntrance.character_id == action.character_id
        )
    elif action.group_id is not None:
        existing_query = existing_query.filter(
            MomentEntrance.group_id == action.group_id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Entrance action missing subject",
        )
    existing = existing_query.first()
    if existing is not None:
        _ensure_dismissal(
            db, production=production, user=user, fingerprint=fingerprint
        )
        record_event(
            db,
            event_name="suggestion.accepted",
            user=user,
            production=production,
            properties=_suggestion_event_properties(
                draft,
                attachment_id=existing.id,
                already_present=True,
            ),
        )
        db.commit()
        return SuggestionAcceptResponse(
            fingerprint=fingerprint,
            applied=True,
            detail="Entrance already present",
        )

    entrance = MomentEntrance(
        moment_id=action.moment_id,
        character_id=action.character_id,
        user_id=action.user_id,
        group_id=action.group_id,
        notes=action.notes,
    )
    prepare_new_attachment(
        db,
        production,
        user,
        entrance,
        "official",
        legacy_resource="timeline",
    )
    db.add(entrance)
    db.flush()

    _ensure_dismissal(db, production=production, user=user, fingerprint=fingerprint)
    record_event(
        db,
        event_name="suggestion.accepted",
        user=user,
        production=production,
        properties=_suggestion_event_properties(
            draft,
            attachment_id=entrance.id,
        ),
    )
    db.commit()

    # Reload for sanity (response does not need full entrance payload)
    _ = (
        db.query(MomentEntrance)
        .options(
            joinedload(MomentEntrance.character),
            joinedload(MomentEntrance.group),
        )
        .filter(MomentEntrance.id == entrance.id)
        .one()
    )

    return SuggestionAcceptResponse(
        fingerprint=fingerprint,
        applied=True,
        detail="Entrance created",
    )
