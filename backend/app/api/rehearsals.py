"""Rehearsal management API: slots, planner, publish, notes, complete."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import (
    get_production_or_404,
    require_production_capability,
    user_display_name,
)
from app.auth.dependencies import user_has_role
from app.db.session import get_db
from app.models import Location, Scene, User
from app.models.rehearsal import (
    ACTOR_VISIBLE_STATUSES,
    REHEARSAL_FOCUS_CHOREO,
    REHEARSAL_FOCUS_DIALOG,
    REHEARSAL_FOCUS_MUSIC,
    REHEARSAL_STATUS_COMPLETED,
    REHEARSAL_STATUS_IN_PROGRESS,
    REHEARSAL_STATUS_PLANNED,
    REHEARSAL_STATUS_PUBLISHED,
    REHEARSAL_STATUS_SCHEDULED,
    Rehearsal,
    RehearsalBlock,
    RehearsalBlockCall,
    RehearsalBlockTarget,
)
from app.schemas.rehearsals import (
    LocationCreate,
    LocationResponse,
    MyCallBlockResponse,
    MyCallResponse,
    RehearsalActivityItem,
    RehearsalBlockCallResponse,
    RehearsalBlockResponse,
    RehearsalBlockTargetResponse,
    RehearsalCreate,
    RehearsalDetailResponse,
    RehearsalNoteResponse,
    RehearsalPlanReplace,
    RehearsalRecommendationResponse,
    RehearsalStatusUpdate,
    RehearsalSummaryResponse,
    RehearsalUpdate,
    SuggestedCallResponse,
)
from app.services.production_memberships import (
    active_role_codes,
    get_membership,
    list_active_production_users,
)
from app.services.rehearsal_activity import rehearsal_activity
from app.services.rehearsal_cast import (
    bump_rehearsal_progress,
    rehearsal_recommendations,
    suggested_users_for_targets,
    validate_scenes_in_production,
    validate_songs_in_production,
)

router = APIRouter(prefix="/productions", tags=["rehearsals"])


def _is_director_or_admin(db: Session, user: User, production_id: int) -> bool:
    """Return whether the user has director-level rehearsal visibility."""
    if not user.is_active:
        return False
    if user_has_role(user, "Admin"):
        return True
    membership = get_membership(db, production_id, user.id)
    return membership is not None and "director" in active_role_codes(db, membership)


def _get_location_for_org_or_404(
    db: Session,
    organization_id: int,
    location_id: int,
) -> Location:
    location = (
        db.query(Location)
        .filter(Location.id == location_id, Location.organization_id == organization_id)
        .first()
    )
    if location is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location not found for this organization",
        )
    return location


def _get_rehearsal_or_404(
    db: Session,
    production_id: int,
    rehearsal_id: int,
) -> Rehearsal:
    rehearsal = (
        db.query(Rehearsal)
        .options(
            joinedload(Rehearsal.location),
            selectinload(Rehearsal.blocks).joinedload(RehearsalBlock.location),
            selectinload(Rehearsal.blocks)
            .selectinload(RehearsalBlock.targets)
            .joinedload(RehearsalBlockTarget.scene)
            .joinedload(Scene.act),
            selectinload(Rehearsal.blocks)
            .selectinload(RehearsalBlock.targets)
            .joinedload(RehearsalBlockTarget.song),
            selectinload(Rehearsal.blocks)
            .selectinload(RehearsalBlock.calls)
            .joinedload(RehearsalBlockCall.user),
        )
        .filter(Rehearsal.id == rehearsal_id, Rehearsal.production_id == production_id)
        .first()
    )
    if rehearsal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rehearsal not found",
        )
    return rehearsal


def _ensure_writable(rehearsal: Rehearsal) -> None:
    if rehearsal.status == REHEARSAL_STATUS_COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Completed rehearsals cannot be edited",
        )


def _overlapping_user_ids(
    blocks: list[RehearsalBlock],
    visible_user_ids: set[int] | None = None,
) -> dict[int, set[int]]:
    """Map block_id -> user_ids also called on an overlapping other block."""
    result: dict[int, set[int]] = {b.id: set() for b in blocks}
    for i, a in enumerate(blocks):
        a_users = {
            c.user_id
            for c in a.calls
            if visible_user_ids is None or c.user_id in visible_user_ids
        }
        for b in blocks[i + 1 :]:
            if a.starts_at < b.ends_at and b.starts_at < a.ends_at:
                overlap = a_users & {
                    c.user_id
                    for c in b.calls
                    if visible_user_ids is None or c.user_id in visible_user_ids
                }
                if overlap:
                    result[a.id] |= overlap
                    result[b.id] |= overlap
    return result


def _target_response(target: RehearsalBlockTarget) -> RehearsalBlockTargetResponse:
    if target.focus == REHEARSAL_FOCUS_DIALOG and target.scene is not None:
        scene = target.scene
        act_number = scene.act.number if scene.act is not None else None
        base = (
            f"{act_number}.{scene.number}"
            if act_number is not None
            else f"Sc {scene.number}"
        )
        title_bit = f" — {scene.title}" if scene.title else ""
        return RehearsalBlockTargetResponse(
            focus=target.focus,
            scene_id=scene.id,
            song_id=None,
            scene_number=scene.number,
            scene_title=scene.title,
            act_number=act_number,
            song_title=None,
            times_rehearsed=scene.times_rehearsed or 0,
            label=f"{base}{title_bit} · Dialog",
        )

    song = target.song
    kind = "Music" if target.focus == REHEARSAL_FOCUS_MUSIC else "Choreo"
    times = 0
    if song is not None:
        if target.focus == REHEARSAL_FOCUS_MUSIC:
            times = song.times_music_rehearsed or 0
        elif target.focus == REHEARSAL_FOCUS_CHOREO:
            times = song.times_choreo_rehearsed or 0
    title = song.title if song is not None else "Song"
    return RehearsalBlockTargetResponse(
        focus=target.focus,
        scene_id=None,
        song_id=song.id if song is not None else target.song_id,
        scene_number=None,
        scene_title=None,
        act_number=None,
        song_title=title,
        times_rehearsed=times,
        label=f"{title} · {kind}",
    )


def _block_response(
    block: RehearsalBlock,
    double_book: set[int] | None = None,
    visible_user_ids: set[int] | None = None,
) -> RehearsalBlockResponse:
    targets = sorted(
        block.targets,
        key=lambda t: (
            0 if t.focus == REHEARSAL_FOCUS_DIALOG else 1 if t.focus == REHEARSAL_FOCUS_MUSIC else 2,
            t.scene_id or 0,
            t.song_id or 0,
        ),
    )
    return RehearsalBlockResponse(
        id=block.id,
        starts_at=block.starts_at,
        ends_at=block.ends_at,
        location_id=block.location_id,
        location_name=block.location.name if block.location else None,
        label=block.label,
        sort_order=block.sort_order,
        targets=[_target_response(t) for t in targets],
        calls=[
            RehearsalBlockCallResponse(
                user_id=c.user_id,
                display_name=user_display_name(c.user),
                available=True,
            )
            for c in block.calls
            if visible_user_ids is None or c.user_id in visible_user_ids
        ],
        double_book_user_ids=sorted(double_book or ()),
    )


def _detail_response(
    db: Session,
    rehearsal: Rehearsal,
    user: User,
) -> RehearsalDetailResponse:
    is_mgr = _is_director_or_admin(db, user, rehearsal.production_id)
    actor_may_see_plan = is_mgr or rehearsal.status in ACTOR_VISIBLE_STATUSES

    overlaps: dict[int, set[int]] = {}
    blocks: list[RehearsalBlockResponse] = []
    if actor_may_see_plan:
        visible_user_ids = {
            member.id
            for member in list_active_production_users(db, rehearsal.production_id)
        }
        overlaps = _overlapping_user_ids(list(rehearsal.blocks), visible_user_ids)
        blocks = [
            _block_response(b, overlaps.get(b.id), visible_user_ids)
            for b in sorted(rehearsal.blocks, key=lambda x: (x.sort_order, x.starts_at))
        ]

    notes: list[RehearsalNoteResponse] = []

    return RehearsalDetailResponse(
        id=rehearsal.id,
        production_id=rehearsal.production_id,
        starts_at=rehearsal.starts_at,
        ends_at=rehearsal.ends_at,
        kind=rehearsal.kind,
        status=rehearsal.status,
        title=rehearsal.title,
        location_id=rehearsal.location_id,
        location_name=rehearsal.location.name if rehearsal.location else None,
        blocks=blocks,
        notes=notes,
        created_at=rehearsal.created_at,
        updated_at=rehearsal.updated_at,
    )


def _actor_may_view_detail(rehearsal: Rehearsal) -> bool:
    """Actors may open any rehearsal slot; plan details are filtered in _detail_response."""
    return True


# --- Locations (org-scoped via production) ---


@router.get("/{production_id}/locations", response_model=list[LocationResponse])
def list_locations(
    production_id: int,
    user: User = Depends(require_production_capability("rehearsals", "read")),
    db: Session = Depends(get_db),
) -> list[LocationResponse]:
    production = get_production_or_404(db, production_id)
    locations = (
        db.query(Location)
        .filter(Location.organization_id == production.organization_id)
        .order_by(Location.sort_order, Location.name)
        .all()
    )
    return [LocationResponse.model_validate(loc) for loc in locations]


@router.post(
    "/{production_id}/locations",
    response_model=LocationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_location(
    production_id: int,
    body: LocationCreate,
    user: User = Depends(require_production_capability("rehearsals", "create")),
    db: Session = Depends(get_db),
) -> LocationResponse:
    production = get_production_or_404(db, production_id)
    location = Location(
        organization_id=production.organization_id,
        name=body.name.strip(),
        sort_order=body.sort_order,
    )
    db.add(location)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Location name already exists",
        ) from None
    db.refresh(location)
    return LocationResponse.model_validate(location)


# --- Rehearsal slots ---


@router.get(
    "/{production_id}/rehearsals",
    response_model=list[RehearsalSummaryResponse],
)
def list_rehearsals(
    production_id: int,
    user: User = Depends(require_production_capability("rehearsals", "read")),
    db: Session = Depends(get_db),
) -> list[RehearsalSummaryResponse]:
    production = get_production_or_404(db, production_id)
    rehearsals = (
        db.query(Rehearsal)
        .options(joinedload(Rehearsal.location), selectinload(Rehearsal.blocks))
        .filter(Rehearsal.production_id == production_id)
        .order_by(Rehearsal.starts_at.asc())
        .all()
    )
    is_mgr = _is_director_or_admin(db, user, production.id)
    result: list[RehearsalSummaryResponse] = []
    for r in rehearsals:
        if not is_mgr and r.status not in ACTOR_VISIBLE_STATUSES:
            # Actors see reserved slots but not call-plan details until published.
            result.append(
                RehearsalSummaryResponse(
                    id=r.id,
                    starts_at=r.starts_at,
                    ends_at=r.ends_at,
                    kind=r.kind,
                    status=r.status,
                    title=r.title,
                    location_id=r.location_id,
                    location_name=r.location.name if r.location else None,
                    block_count=0,
                )
            )
            continue
        result.append(
            RehearsalSummaryResponse(
                id=r.id,
                starts_at=r.starts_at,
                ends_at=r.ends_at,
                kind=r.kind,
                status=r.status,
                title=r.title,
                location_id=r.location_id,
                location_name=r.location.name if r.location else None,
                block_count=len(r.blocks),
            )
        )
    return result


@router.post(
    "/{production_id}/rehearsals",
    response_model=RehearsalDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_rehearsal(
    production_id: int,
    body: RehearsalCreate,
    user: User = Depends(require_production_capability("rehearsals", "create")),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    production = get_production_or_404(db, production_id)
    if body.location_id is not None:
        _get_location_for_org_or_404(db, production.organization_id, body.location_id)
    rehearsal = Rehearsal(
        production_id=production_id,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        kind=body.kind,
        status=REHEARSAL_STATUS_SCHEDULED,
        title=body.title.strip() if body.title else None,
        location_id=body.location_id,
    )
    db.add(rehearsal)
    db.commit()
    return _detail_response(
        db,
        _get_rehearsal_or_404(db, production_id, rehearsal.id),
        user,
    )


# --- Suggestions & actor calls (static paths before {rehearsal_id}) ---


@router.get(
    "/{production_id}/rehearsals/suggest-calls",
    response_model=list[SuggestedCallResponse],
)
def suggest_calls(
    production_id: int,
    scene_ids: list[int] = Query(default=[]),
    song_ids: list[int] = Query(default=[]),
    user: User = Depends(require_production_capability("rehearsals", "read")),
    db: Session = Depends(get_db),
) -> list[SuggestedCallResponse]:
    get_production_or_404(db, production_id)
    suggestions = suggested_users_for_targets(
        db, production_id, scene_ids, song_ids
    )
    return [
        SuggestedCallResponse(
            user_id=user.id,
            display_name=user_display_name(user),
            character_names=names,
            available=True,
        )
        for user, names in suggestions
    ]


@router.get(
    "/{production_id}/rehearsals/recommendations",
    response_model=list[RehearsalRecommendationResponse],
)
def list_rehearsal_recommendations(
    production_id: int,
    user: User = Depends(require_production_capability("rehearsals", "read")),
    db: Session = Depends(get_db),
) -> list[RehearsalRecommendationResponse]:
    get_production_or_404(db, production_id)
    rows = rehearsal_recommendations(db, production_id)
    return [
        RehearsalRecommendationResponse(
            focus=row["focus"],
            scene_id=row["scene_id"],
            song_id=row["song_id"],
            act_number=row["act_number"],
            number=row["number"],
            title=row["title"],
            times_rehearsed=row["times_rehearsed"],
            last_rehearsed_at=row["last_rehearsed_at"],
            label=row["label"],
        )
        for row in rows
    ]


@router.get(
    "/{production_id}/rehearsals/scene-recommendations",
    response_model=list[RehearsalRecommendationResponse],
    deprecated=True,
)
def list_scene_recommendations(
    production_id: int,
    user: User = Depends(require_production_capability("rehearsals", "read")),
    db: Session = Depends(get_db),
) -> list[RehearsalRecommendationResponse]:
    """Deprecated alias — prefer /rehearsals/recommendations."""
    return list_rehearsal_recommendations(production_id, user, db)


@router.get(
    "/{production_id}/rehearsals/my-calls",
    response_model=list[MyCallResponse],
)
def list_my_calls(
    production_id: int,
    user: User = Depends(require_production_capability("rehearsals", "read")),
    db: Session = Depends(get_db),
) -> list[MyCallResponse]:
    get_production_or_404(db, production_id)
    rehearsals = (
        db.query(Rehearsal)
        .options(
            joinedload(Rehearsal.location),
            selectinload(Rehearsal.blocks).joinedload(RehearsalBlock.location),
            selectinload(Rehearsal.blocks)
            .selectinload(RehearsalBlock.targets)
            .joinedload(RehearsalBlockTarget.scene)
            .joinedload(Scene.act),
            selectinload(Rehearsal.blocks)
            .selectinload(RehearsalBlock.targets)
            .joinedload(RehearsalBlockTarget.song),
            selectinload(Rehearsal.blocks).selectinload(RehearsalBlock.calls),
        )
        .filter(
            Rehearsal.production_id == production_id,
            Rehearsal.status.in_(ACTOR_VISIBLE_STATUSES),
        )
        .order_by(Rehearsal.starts_at.asc())
        .all()
    )
    result: list[MyCallResponse] = []
    for r in rehearsals:
        my_blocks: list[MyCallBlockResponse] = []
        for block in sorted(r.blocks, key=lambda b: (b.sort_order, b.starts_at)):
            if any(c.user_id == user.id for c in block.calls):
                my_blocks.append(
                    MyCallBlockResponse(
                        block_id=block.id,
                        starts_at=block.starts_at,
                        ends_at=block.ends_at,
                        location_name=block.location.name if block.location else None,
                        label=block.label,
                        targets=[_target_response(t) for t in block.targets],
                    )
                )
        if my_blocks or r.kind == "all_call":
            if not my_blocks and r.kind == "all_call":
                my_blocks = [
                    MyCallBlockResponse(
                        block_id=0,
                        starts_at=r.starts_at,
                        ends_at=r.ends_at,
                        location_name=r.location.name if r.location else None,
                        label="All call",
                        targets=[],
                    )
                ]
            if my_blocks:
                result.append(
                    MyCallResponse(
                        rehearsal_id=r.id,
                        starts_at=r.starts_at,
                        ends_at=r.ends_at,
                        kind=r.kind,
                        status=r.status,
                        title=r.title,
                        location_name=r.location.name if r.location else None,
                        blocks=my_blocks,
                    )
                )
    return result


@router.get(
    "/{production_id}/rehearsals/{rehearsal_id}",
    response_model=RehearsalDetailResponse,
)
def get_rehearsal(
    production_id: int,
    rehearsal_id: int,
    user: User = Depends(require_production_capability("rehearsals", "read")),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    return _detail_response(db, rehearsal, user)


@router.patch(
    "/{production_id}/rehearsals/{rehearsal_id}",
    response_model=RehearsalDetailResponse,
)
def update_rehearsal(
    production_id: int,
    rehearsal_id: int,
    body: RehearsalUpdate,
    user: User = Depends(require_production_capability("rehearsals", "update")),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    production = get_production_or_404(db, production_id)
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    _ensure_writable(rehearsal)

    data = body.model_dump(exclude_unset=True)
    if "location_id" in data and data["location_id"] is not None:
        _get_location_for_org_or_404(
            db, production.organization_id, data["location_id"]
        )
    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip() or None
    for key, value in data.items():
        setattr(rehearsal, key, value)

    starts = rehearsal.starts_at
    ends = rehearsal.ends_at
    if ends <= starts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ends_at must be after starts_at",
        )
    db.commit()
    return _detail_response(
        db,
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        user,
    )


@router.delete(
    "/{production_id}/rehearsals/{rehearsal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_rehearsal(
    production_id: int,
    rehearsal_id: int,
    user: User = Depends(require_production_capability("rehearsals", "delete")),
    db: Session = Depends(get_db),
) -> None:
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    db.delete(rehearsal)
    db.commit()


# --- Planner ---


@router.put(
    "/{production_id}/rehearsals/{rehearsal_id}/plan",
    response_model=RehearsalDetailResponse,
)
def replace_rehearsal_plan(
    production_id: int,
    rehearsal_id: int,
    body: RehearsalPlanReplace,
    user: User = Depends(require_production_capability("rehearsals", "update")),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    production = get_production_or_404(db, production_id)
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    _ensure_writable(rehearsal)

    all_scene_ids: list[int] = []
    all_song_ids: list[int] = []
    all_user_ids: set[int] = set()
    for block in body.blocks:
        for target in block.targets:
            if target.scene_id is not None:
                all_scene_ids.append(target.scene_id)
            if target.song_id is not None:
                all_song_ids.append(target.song_id)
        all_user_ids.update(block.user_ids)
        if block.location_id is not None:
            _get_location_for_org_or_404(
                db, production.organization_id, block.location_id
            )

    try:
        validate_scenes_in_production(db, production_id, list(set(all_scene_ids)))
        validate_songs_in_production(db, production_id, list(set(all_song_ids)))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if all_user_ids:
        users = [
            member
            for member in list_active_production_users(db, production_id)
            if member.id in all_user_ids
        ]
        found = {u.id for u in users}
        missing = all_user_ids - found
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Users are not active members of this production: {sorted(missing)}",
            )

    # Replace blocks
    for existing in list(rehearsal.blocks):
        db.delete(existing)
    db.flush()

    for idx, block_in in enumerate(body.blocks):
        block = RehearsalBlock(
            rehearsal_id=rehearsal.id,
            starts_at=block_in.starts_at,
            ends_at=block_in.ends_at,
            location_id=block_in.location_id,
            label=block_in.label.strip() if block_in.label else None,
            sort_order=block_in.sort_order if block_in.sort_order else idx,
        )
        db.add(block)
        db.flush()
        seen: set[tuple[str, int | None, int | None]] = set()
        for target_in in block_in.targets:
            key = (target_in.focus, target_in.scene_id, target_in.song_id)
            if key in seen:
                continue
            seen.add(key)
            db.add(
                RehearsalBlockTarget(
                    block_id=block.id,
                    focus=target_in.focus,
                    scene_id=target_in.scene_id,
                    song_id=target_in.song_id,
                )
            )
        for uid in block_in.user_ids:
            db.add(RehearsalBlockCall(block_id=block.id, user_id=uid))

    if body.mark_planned and rehearsal.status == REHEARSAL_STATUS_SCHEDULED:
        rehearsal.status = REHEARSAL_STATUS_PLANNED

    db.commit()
    return _detail_response(
        db,
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        user,
    )


# --- Status transitions ---


@router.post(
    "/{production_id}/rehearsals/{rehearsal_id}/publish",
    response_model=RehearsalDetailResponse,
)
def publish_rehearsal(
    production_id: int,
    rehearsal_id: int,
    user: User = Depends(require_production_capability("rehearsals", "update")),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    _ensure_writable(rehearsal)
    if rehearsal.status not in (
        REHEARSAL_STATUS_SCHEDULED,
        REHEARSAL_STATUS_PLANNED,
        REHEARSAL_STATUS_PUBLISHED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot publish from status {rehearsal.status}",
        )
    rehearsal.status = REHEARSAL_STATUS_PUBLISHED
    db.commit()
    return _detail_response(
        db,
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        user,
    )


@router.post(
    "/{production_id}/rehearsals/{rehearsal_id}/open",
    response_model=RehearsalDetailResponse,
)
def open_rehearsal(
    production_id: int,
    rehearsal_id: int,
    user: User = Depends(require_production_capability("rehearsals", "update")),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    _ensure_writable(rehearsal)
    if rehearsal.status not in (
        REHEARSAL_STATUS_PUBLISHED,
        REHEARSAL_STATUS_PLANNED,
        REHEARSAL_STATUS_IN_PROGRESS,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot open from status {rehearsal.status}",
        )
    rehearsal.status = REHEARSAL_STATUS_IN_PROGRESS
    db.commit()
    return _detail_response(
        db,
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        user,
    )


@router.post(
    "/{production_id}/rehearsals/{rehearsal_id}/complete",
    response_model=RehearsalDetailResponse,
)
def complete_rehearsal(
    production_id: int,
    rehearsal_id: int,
    user: User = Depends(require_production_capability("rehearsals", "update")),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    if rehearsal.status == REHEARSAL_STATUS_COMPLETED:
        return _detail_response(db, rehearsal, user)
    if rehearsal.status not in (
        REHEARSAL_STATUS_IN_PROGRESS,
        REHEARSAL_STATUS_PUBLISHED,
        REHEARSAL_STATUS_PLANNED,
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot complete from status {rehearsal.status}",
        )

    now = datetime.now(timezone.utc)
    scene_ids: set[int] = set()
    music_song_ids: set[int] = set()
    choreo_song_ids: set[int] = set()
    for block in rehearsal.blocks:
        for target in block.targets:
            if target.focus == REHEARSAL_FOCUS_DIALOG and target.scene_id is not None:
                scene_ids.add(target.scene_id)
            elif target.focus == REHEARSAL_FOCUS_MUSIC and target.song_id is not None:
                music_song_ids.add(target.song_id)
            elif target.focus == REHEARSAL_FOCUS_CHOREO and target.song_id is not None:
                choreo_song_ids.add(target.song_id)

    bump_rehearsal_progress(
        db,
        scene_ids=scene_ids,
        music_song_ids=music_song_ids,
        choreo_song_ids=choreo_song_ids,
        when=now,
    )

    rehearsal.status = REHEARSAL_STATUS_COMPLETED
    db.commit()
    return _detail_response(
        db,
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        user,
    )


@router.patch(
    "/{production_id}/rehearsals/{rehearsal_id}/status",
    response_model=RehearsalDetailResponse,
)
def set_rehearsal_status(
    production_id: int,
    rehearsal_id: int,
    body: RehearsalStatusUpdate,
    user: User = Depends(require_production_capability("rehearsals", "update")),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    """Admin/director escape hatch (e.g. reopen completed → planned)."""
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    rehearsal.status = body.status
    db.commit()
    return _detail_response(
        db,
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        user,
    )


@router.get(
    "/{production_id}/rehearsals/{rehearsal_id}/activity",
    response_model=list[RehearsalActivityItem],
)
def get_rehearsal_activity(
    production_id: int,
    rehearsal_id: int,
    user: User = Depends(require_production_capability("rehearsals", "read")),
    db: Session = Depends(get_db),
) -> list[RehearsalActivityItem]:
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    return rehearsal_activity(db, rehearsal, user)


@router.get(
    "/{production_id}/rehearsals/{rehearsal_id}/call-sheet",
    response_model=RehearsalDetailResponse,
)
def get_call_sheet(
    production_id: int,
    rehearsal_id: int,
    user: User = Depends(require_production_capability("rehearsals", "read")),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    """Same payload as detail; directors always; actors only when published+."""
    return get_rehearsal(production_id, rehearsal_id, user, db)
