"""Rehearsal management API: slots, planner, publish, notes, complete."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_accessible_production, user_display_name
from app.auth.dependencies import (
    require_authenticated,
    require_director_or_admin,
    user_has_role,
)
from app.db.session import get_db
from app.models import Location, Scene, User
from app.models.rehearsal import (
    ACTOR_VISIBLE_STATUSES,
    REHEARSAL_STATUS_COMPLETED,
    REHEARSAL_STATUS_IN_PROGRESS,
    REHEARSAL_STATUS_PLANNED,
    REHEARSAL_STATUS_PUBLISHED,
    REHEARSAL_STATUS_SCHEDULED,
    Rehearsal,
    RehearsalBlock,
    RehearsalBlockCall,
    RehearsalNote,
)
from app.schemas.rehearsals import (
    LocationCreate,
    LocationResponse,
    MyCallBlockResponse,
    MyCallResponse,
    RehearsalBlockCallResponse,
    RehearsalBlockResponse,
    RehearsalBlockSceneResponse,
    RehearsalCreate,
    RehearsalDetailResponse,
    RehearsalNoteCreate,
    RehearsalNoteResponse,
    RehearsalNoteUpdate,
    RehearsalPlanReplace,
    RehearsalStatusUpdate,
    RehearsalSummaryResponse,
    RehearsalUpdate,
    SceneRecommendationResponse,
    SuggestedCallResponse,
)
from app.services.rehearsal_cast import (
    scene_recommendations,
    suggested_users_for_scenes,
    validate_scenes_in_production,
)

router = APIRouter(prefix="/productions", tags=["rehearsals"])


def _is_director_or_admin(user: User) -> bool:
    return user_has_role(user, "Admin") or user_has_role(user, "Director")


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
            .selectinload(RehearsalBlock.scenes)
            .joinedload(Scene.act),
            selectinload(Rehearsal.blocks)
            .selectinload(RehearsalBlock.calls)
            .joinedload(RehearsalBlockCall.user),
            selectinload(Rehearsal.notes).joinedload(RehearsalNote.author),
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


def _overlapping_user_ids(blocks: list[RehearsalBlock]) -> dict[int, set[int]]:
    """Map block_id -> user_ids also called on an overlapping other block."""
    result: dict[int, set[int]] = {b.id: set() for b in blocks}
    for i, a in enumerate(blocks):
        a_users = {c.user_id for c in a.calls}
        for b in blocks[i + 1 :]:
            if a.starts_at < b.ends_at and b.starts_at < a.ends_at:
                overlap = a_users & {c.user_id for c in b.calls}
                if overlap:
                    result[a.id] |= overlap
                    result[b.id] |= overlap
    return result


def _block_scene_response(scene: Scene) -> RehearsalBlockSceneResponse:
    act_number = scene.act.number if scene.act is not None else None
    return RehearsalBlockSceneResponse(
        id=scene.id,
        number=scene.number,
        title=scene.title,
        act_number=act_number,
        times_rehearsed=scene.times_rehearsed,
    )


def _block_response(
    block: RehearsalBlock,
    double_book: set[int] | None = None,
) -> RehearsalBlockResponse:
    return RehearsalBlockResponse(
        id=block.id,
        starts_at=block.starts_at,
        ends_at=block.ends_at,
        location_id=block.location_id,
        location_name=block.location.name if block.location else None,
        label=block.label,
        sort_order=block.sort_order,
        scenes=[_block_scene_response(s) for s in block.scenes],
        calls=[
            RehearsalBlockCallResponse(
                user_id=c.user_id,
                display_name=user_display_name(c.user),
                available=True,
            )
            for c in block.calls
        ],
        double_book_user_ids=sorted(double_book or ()),
    )


def _note_response(note: RehearsalNote) -> RehearsalNoteResponse:
    return RehearsalNoteResponse(
        id=note.id,
        author_user_id=note.author_user_id,
        author_display_name=user_display_name(note.author),
        content=note.content,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def _detail_response(rehearsal: Rehearsal, user: User) -> RehearsalDetailResponse:
    is_mgr = _is_director_or_admin(user)
    actor_may_see_plan = is_mgr or rehearsal.status in ACTOR_VISIBLE_STATUSES

    overlaps: dict[int, set[int]] = {}
    blocks: list[RehearsalBlockResponse] = []
    if actor_may_see_plan:
        overlaps = _overlapping_user_ids(list(rehearsal.blocks))
        blocks = [
            _block_response(b, overlaps.get(b.id))
            for b in sorted(rehearsal.blocks, key=lambda x: (x.sort_order, x.starts_at))
        ]

    notes: list[RehearsalNoteResponse] = []
    if is_mgr:
        notes = [_note_response(n) for n in rehearsal.notes]

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
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[LocationResponse]:
    production = get_accessible_production(db, user, production_id)
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
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> LocationResponse:
    production = get_accessible_production(db, director, production_id)
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
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[RehearsalSummaryResponse]:
    get_accessible_production(db, user, production_id)
    rehearsals = (
        db.query(Rehearsal)
        .options(joinedload(Rehearsal.location), selectinload(Rehearsal.blocks))
        .filter(Rehearsal.production_id == production_id)
        .order_by(Rehearsal.starts_at.asc())
        .all()
    )
    is_mgr = _is_director_or_admin(user)
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
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    production = get_accessible_production(db, director, production_id)
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
        _get_rehearsal_or_404(db, production_id, rehearsal.id),
        director,
    )


# --- Suggestions & actor calls (static paths before {rehearsal_id}) ---


@router.get(
    "/{production_id}/rehearsals/suggest-calls",
    response_model=list[SuggestedCallResponse],
)
def suggest_calls(
    production_id: int,
    scene_ids: list[int] = Query(default=[]),
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> list[SuggestedCallResponse]:
    get_accessible_production(db, director, production_id)
    suggestions = suggested_users_for_scenes(db, production_id, scene_ids)
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
    "/{production_id}/rehearsals/scene-recommendations",
    response_model=list[SceneRecommendationResponse],
)
def list_scene_recommendations(
    production_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> list[SceneRecommendationResponse]:
    get_accessible_production(db, director, production_id)
    scenes = scene_recommendations(db, production_id)
    return [
        SceneRecommendationResponse(
            id=s.id,
            act_number=s.act.number,
            number=s.number,
            title=s.title,
            times_rehearsed=s.times_rehearsed,
            last_rehearsed_at=s.last_rehearsed_at,
        )
        for s in scenes
    ]


@router.get(
    "/{production_id}/rehearsals/my-calls",
    response_model=list[MyCallResponse],
)
def list_my_calls(
    production_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[MyCallResponse]:
    get_accessible_production(db, user, production_id)
    rehearsals = (
        db.query(Rehearsal)
        .options(
            joinedload(Rehearsal.location),
            selectinload(Rehearsal.blocks).joinedload(RehearsalBlock.location),
            selectinload(Rehearsal.blocks)
            .selectinload(RehearsalBlock.scenes)
            .joinedload(Scene.act),
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
                        scenes=[_block_scene_response(s) for s in block.scenes],
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
                        scenes=[],
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
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    get_accessible_production(db, user, production_id)
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    return _detail_response(rehearsal, user)


@router.patch(
    "/{production_id}/rehearsals/{rehearsal_id}",
    response_model=RehearsalDetailResponse,
)
def update_rehearsal(
    production_id: int,
    rehearsal_id: int,
    body: RehearsalUpdate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    production = get_accessible_production(db, director, production_id)
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
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        director,
    )


@router.delete(
    "/{production_id}/rehearsals/{rehearsal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_rehearsal(
    production_id: int,
    rehearsal_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    get_accessible_production(db, director, production_id)
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
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    production = get_accessible_production(db, director, production_id)
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    _ensure_writable(rehearsal)

    all_scene_ids: list[int] = []
    all_user_ids: set[int] = set()
    for block in body.blocks:
        all_scene_ids.extend(block.scene_ids)
        all_user_ids.update(block.user_ids)
        if block.location_id is not None:
            _get_location_for_org_or_404(
                db, production.organization_id, block.location_id
            )

    try:
        validate_scenes_in_production(db, production_id, list(set(all_scene_ids)))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    if all_user_ids:
        users = (
            db.query(User)
            .filter(
                User.id.in_(all_user_ids),
                User.organization_id == production.organization_id,
                User.is_active.is_(True),
            )
            .all()
        )
        found = {u.id for u in users}
        missing = all_user_ids - found
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Users not in organization: {sorted(missing)}",
            )

    # Replace blocks
    for existing in list(rehearsal.blocks):
        db.delete(existing)
    db.flush()

    scenes_by_id = {
        s.id: s
        for s in validate_scenes_in_production(
            db, production_id, list(set(all_scene_ids))
        )
    }

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
        block.scenes = [scenes_by_id[sid] for sid in block_in.scene_ids if sid in scenes_by_id]
        for uid in block_in.user_ids:
            db.add(RehearsalBlockCall(block_id=block.id, user_id=uid))

    if body.mark_planned and rehearsal.status == REHEARSAL_STATUS_SCHEDULED:
        rehearsal.status = REHEARSAL_STATUS_PLANNED

    db.commit()
    return _detail_response(
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        director,
    )


# --- Status transitions ---


@router.post(
    "/{production_id}/rehearsals/{rehearsal_id}/publish",
    response_model=RehearsalDetailResponse,
)
def publish_rehearsal(
    production_id: int,
    rehearsal_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    get_accessible_production(db, director, production_id)
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
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        director,
    )


@router.post(
    "/{production_id}/rehearsals/{rehearsal_id}/open",
    response_model=RehearsalDetailResponse,
)
def open_rehearsal(
    production_id: int,
    rehearsal_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    get_accessible_production(db, director, production_id)
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
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        director,
    )


@router.post(
    "/{production_id}/rehearsals/{rehearsal_id}/complete",
    response_model=RehearsalDetailResponse,
)
def complete_rehearsal(
    production_id: int,
    rehearsal_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    get_accessible_production(db, director, production_id)
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    if rehearsal.status == REHEARSAL_STATUS_COMPLETED:
        return _detail_response(rehearsal, director)
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
    for block in rehearsal.blocks:
        for scene in block.scenes:
            scene_ids.add(scene.id)

    if scene_ids:
        scenes = db.query(Scene).filter(Scene.id.in_(scene_ids)).all()
        for scene in scenes:
            scene.times_rehearsed = (scene.times_rehearsed or 0) + 1
            scene.last_rehearsed_at = now

    rehearsal.status = REHEARSAL_STATUS_COMPLETED
    db.commit()
    return _detail_response(
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        director,
    )


@router.patch(
    "/{production_id}/rehearsals/{rehearsal_id}/status",
    response_model=RehearsalDetailResponse,
)
def set_rehearsal_status(
    production_id: int,
    rehearsal_id: int,
    body: RehearsalStatusUpdate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    """Admin/director escape hatch (e.g. reopen completed → planned)."""
    get_accessible_production(db, director, production_id)
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    rehearsal.status = body.status
    db.commit()
    return _detail_response(
        _get_rehearsal_or_404(db, production_id, rehearsal_id),
        director,
    )


# --- Notes ---


@router.post(
    "/{production_id}/rehearsals/{rehearsal_id}/notes",
    response_model=RehearsalNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_rehearsal_note(
    production_id: int,
    rehearsal_id: int,
    body: RehearsalNoteCreate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> RehearsalNoteResponse:
    get_accessible_production(db, director, production_id)
    rehearsal = _get_rehearsal_or_404(db, production_id, rehearsal_id)
    note = RehearsalNote(
        rehearsal_id=rehearsal.id,
        author_user_id=director.id,
        content=body.content.strip(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    note = (
        db.query(RehearsalNote)
        .options(joinedload(RehearsalNote.author))
        .filter(RehearsalNote.id == note.id)
        .one()
    )
    return _note_response(note)


@router.patch(
    "/{production_id}/rehearsals/{rehearsal_id}/notes/{note_id}",
    response_model=RehearsalNoteResponse,
)
def update_rehearsal_note(
    production_id: int,
    rehearsal_id: int,
    note_id: int,
    body: RehearsalNoteUpdate,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> RehearsalNoteResponse:
    get_accessible_production(db, director, production_id)
    _get_rehearsal_or_404(db, production_id, rehearsal_id)
    note = (
        db.query(RehearsalNote)
        .options(joinedload(RehearsalNote.author))
        .filter(
            RehearsalNote.id == note_id,
            RehearsalNote.rehearsal_id == rehearsal_id,
        )
        .first()
    )
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    if note.author_user_id != director.id and not user_has_role(director, "Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only edit your own notes",
        )
    note.content = body.content.strip()
    db.commit()
    db.refresh(note)
    return _note_response(note)


@router.delete(
    "/{production_id}/rehearsals/{rehearsal_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_rehearsal_note(
    production_id: int,
    rehearsal_id: int,
    note_id: int,
    director: User = Depends(require_director_or_admin),
    db: Session = Depends(get_db),
) -> None:
    get_accessible_production(db, director, production_id)
    _get_rehearsal_or_404(db, production_id, rehearsal_id)
    note = (
        db.query(RehearsalNote)
        .filter(
            RehearsalNote.id == note_id,
            RehearsalNote.rehearsal_id == rehearsal_id,
        )
        .first()
    )
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    if note.author_user_id != director.id and not user_has_role(director, "Admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete your own notes",
        )
    db.delete(note)
    db.commit()


@router.get(
    "/{production_id}/rehearsals/{rehearsal_id}/call-sheet",
    response_model=RehearsalDetailResponse,
)
def get_call_sheet(
    production_id: int,
    rehearsal_id: int,
    user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> RehearsalDetailResponse:
    """Same payload as detail; directors always; actors only when published+."""
    return get_rehearsal(production_id, rehearsal_id, user, db)
