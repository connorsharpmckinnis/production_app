from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.api.deps import require_production_capability, user_display_name
from app.db.session import get_db
from app.models import (
    Act,
    Cue,
    CueCategory,
    Moment,
    MomentBlocking,
    MomentCostumeEvent,
    MomentEntrance,
    MomentExit,
    MomentPropEvent,
    Prop,
    Scene,
    User,
)
from app.schemas.reports import (
    BlockingSheetEntry,
    CostumeChangeEntry,
    CueSheetCategory,
    CueSheetMomentReference,
    EntranceExitSheetGroup,
    EntranceExitSheetRow,
    OnStageChartReport,
    PropSheetEntry,
    PropSheetMomentReference,
)
from app.services.on_stage_chart import build_on_stage_chart

router = APIRouter(prefix="/productions", tags=["reports"])


def _timeline_moment_order(db: Session, production_id: int) -> list[tuple[Moment, Act, Scene]]:
    """Return all production moments in timeline order with act/scene context."""
    rows = (
        db.query(Moment, Act, Scene)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(Act.sort_order, Scene.sort_order, Moment.sequence_number)
        .all()
    )
    return rows


@router.get("/{production_id}/reports/prop-sheet", response_model=list[PropSheetEntry])
def prop_sheet(
    production_id: int,
    user: User = Depends(require_production_capability("reports", "read")),
    db: Session = Depends(get_db),
) -> list[PropSheetEntry]:
    timeline = _timeline_moment_order(db, production_id)
    moment_context = {moment.id: (moment, act, scene) for moment, act, scene in timeline}

    props = (
        db.query(Prop)
        .filter(Prop.production_id == production_id)
        .order_by(Prop.name)
        .all()
    )

    prop_events = (
        db.query(MomentPropEvent)
        .options(
            joinedload(MomentPropEvent.character),
            joinedload(MomentPropEvent.user),
            joinedload(MomentPropEvent.moment).joinedload(Moment.scene).joinedload(Scene.act),
        )
        .join(Moment, MomentPropEvent.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .all()
    )

    events_by_prop: dict[int, list[MomentPropEvent]] = {prop.id: [] for prop in props}
    for event in prop_events:
        if event.prop_id in events_by_prop:
            events_by_prop[event.prop_id].append(event)

    entries: list[PropSheetEntry] = []
    for prop in props:
        references: list[PropSheetMomentReference] = []
        for event in events_by_prop[prop.id]:
            moment, act, scene = moment_context[event.moment_id]
            references.append(
                PropSheetMomentReference(
                    moment_id=moment.id,
                    sequence_number=moment.sequence_number,
                    act_number=act.number,
                    scene_number=scene.number,
                    scene_title=scene.title,
                    kind=event.kind,
                    character_name=event.character.name if event.character else None,
                    user_display_name=(
                        user_display_name(event.user) if event.user else None
                    ),
                    notes=event.notes,
                )
            )
        references.sort(
            key=lambda ref: (
                next(act.number for m, act, _ in timeline if m.id == ref.moment_id),
                next(scene.number for m, _, scene in timeline if m.id == ref.moment_id),
                ref.sequence_number,
            )
        )
        entries.append(
            PropSheetEntry(
                prop_id=prop.id,
                prop_name=prop.name,
                description=prop.description,
                moments=references,
            )
        )
    return entries


@router.get("/{production_id}/reports/cue-sheet", response_model=list[CueSheetCategory])
def cue_sheet(
    production_id: int,
    user: User = Depends(require_production_capability("reports", "read")),
    db: Session = Depends(get_db),
) -> list[CueSheetCategory]:
    timeline = _timeline_moment_order(db, production_id)
    moment_context = {moment.id: (moment, act, scene) for moment, act, scene in timeline}

    categories = (
        db.query(CueCategory)
        .filter(CueCategory.production_id == production_id)
        .order_by(CueCategory.name)
        .all()
    )

    cues = (
        db.query(Cue)
        .options(joinedload(Cue.cue_category))
        .join(Moment, Cue.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .all()
    )

    cues_by_category: dict[int, list[Cue]] = {category.id: [] for category in categories}
    for cue in cues:
        if cue.cue_category_id in cues_by_category:
            cues_by_category[cue.cue_category_id].append(cue)

    result: list[CueSheetCategory] = []
    for category in categories:
        references: list[CueSheetMomentReference] = []
        for cue in cues_by_category[category.id]:
            moment, act, scene = moment_context[cue.moment_id]
            references.append(
                CueSheetMomentReference(
                    moment_id=moment.id,
                    sequence_number=moment.sequence_number,
                    act_number=act.number,
                    scene_number=scene.number,
                    scene_title=scene.title,
                    cue_id=cue.id,
                    title=cue.title,
                    notes=cue.notes,
                    payload=cue.payload,
                )
            )
        references.sort(
            key=lambda ref: (ref.act_number, ref.scene_number, ref.sequence_number)
        )
        result.append(
            CueSheetCategory(
                cue_category_id=category.id,
                cue_category_name=category.name,
                cues=references,
            )
        )
    return result


@router.get(
    "/{production_id}/reports/costume-changes",
    response_model=list[CostumeChangeEntry],
)
def costume_changes(
    production_id: int,
    user: User = Depends(require_production_capability("reports", "read")),
    db: Session = Depends(get_db),
) -> list[CostumeChangeEntry]:
    timeline = _timeline_moment_order(db, production_id)

    events = (
        db.query(MomentCostumeEvent)
        .options(
            joinedload(MomentCostumeEvent.character),
            joinedload(MomentCostumeEvent.costume),
        )
        .join(Moment, MomentCostumeEvent.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .all()
    )

    moment_context = {moment.id: (moment, act, scene) for moment, act, scene in timeline}

    entries: list[CostumeChangeEntry] = []
    for event in events:
        moment, act, scene = moment_context[event.moment_id]
        entries.append(
            CostumeChangeEntry(
                moment_id=moment.id,
                sequence_number=moment.sequence_number,
                act_number=act.number,
                scene_number=scene.number,
                scene_title=scene.title,
                character_id=event.character_id,
                character_name=event.character.name,
                kind=event.kind,
                costume_id=event.costume_id,
                costume_name=event.costume.name if event.costume else None,
                notes=event.notes,
            )
        )

    entries.sort(key=lambda entry: (entry.act_number, entry.scene_number, entry.sequence_number))
    return entries


@router.get(
    "/{production_id}/reports/entrance-exit-sheet",
    response_model=list[EntranceExitSheetGroup],
)
def entrance_exit_sheet(
    production_id: int,
    user: User = Depends(require_production_capability("reports", "read")),
    db: Session = Depends(get_db),
) -> list[EntranceExitSheetGroup]:
    scenes = (
        db.query(Scene)
        .join(Act)
        .options(joinedload(Scene.act))
        .filter(Act.production_id == production_id)
        .order_by(Act.sort_order, Scene.sort_order)
        .all()
    )

    entrances = (
        db.query(MomentEntrance)
        .options(
            joinedload(MomentEntrance.character),
            joinedload(MomentEntrance.moment).joinedload(Moment.scene).joinedload(Scene.act),
        )
        .join(Moment, MomentEntrance.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .all()
    )
    exits = (
        db.query(MomentExit)
        .options(
            joinedload(MomentExit.character),
            joinedload(MomentExit.moment).joinedload(Moment.scene).joinedload(Scene.act),
        )
        .join(Moment, MomentExit.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .all()
    )

    rows_by_scene: dict[int, list[EntranceExitSheetRow]] = {scene.id: [] for scene in scenes}

    for entrance in entrances:
        moment = entrance.moment
        rows_by_scene[moment.scene_id].append(
            EntranceExitSheetRow(
                moment_id=moment.id,
                sequence_number=moment.sequence_number,
                movement_type="entrance",
                character_id=entrance.character_id,
                character_name=entrance.character.name,
                notes=entrance.notes,
            )
        )

    for exit_row in exits:
        moment = exit_row.moment
        rows_by_scene[moment.scene_id].append(
            EntranceExitSheetRow(
                moment_id=moment.id,
                sequence_number=moment.sequence_number,
                movement_type="exit",
                character_id=exit_row.character_id,
                character_name=exit_row.character.name,
                notes=exit_row.notes,
            )
        )

    groups: list[EntranceExitSheetGroup] = []
    for scene in scenes:
        scene_rows = rows_by_scene[scene.id]
        if not scene_rows:
            continue
        scene_rows.sort(key=lambda row: (row.sequence_number, row.movement_type, row.character_name))
        groups.append(
            EntranceExitSheetGroup(
                scene_id=scene.id,
                act_number=scene.act.number,
                scene_number=scene.number,
                scene_title=scene.title,
                rows=scene_rows,
            )
        )
    return groups


@router.get(
    "/{production_id}/reports/blocking-sheet",
    response_model=list[BlockingSheetEntry],
)
def blocking_sheet(
    production_id: int,
    user: User = Depends(require_production_capability("reports", "read")),
    db: Session = Depends(get_db),
) -> list[BlockingSheetEntry]:
    timeline = _timeline_moment_order(db, production_id)

    blocking_rows = (
        db.query(MomentBlocking)
        .options(
            joinedload(MomentBlocking.character),
            joinedload(MomentBlocking.user),
            joinedload(MomentBlocking.group),
            joinedload(MomentBlocking.moment).joinedload(Moment.scene).joinedload(Scene.act),
        )
        .join(Moment, MomentBlocking.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .all()
    )

    entries: list[BlockingSheetEntry] = []
    for blocking in blocking_rows:
        moment, act, scene = next(
            (m, a, s) for m, a, s in timeline if m.id == blocking.moment_id
        )
        entries.append(
            BlockingSheetEntry(
                moment_id=moment.id,
                sequence_number=moment.sequence_number,
                act_number=act.number,
                scene_number=scene.number,
                scene_title=scene.title,
                character_id=blocking.character_id,
                character_name=blocking.character.name if blocking.character else None,
                user_id=blocking.user_id,
                user_display_name=(
                    user_display_name(blocking.user) if blocking.user else None
                ),
                group_id=blocking.group_id,
                group_name=blocking.group.name if blocking.group else None,
                notes=blocking.notes,
            )
        )

    entries.sort(key=lambda entry: (entry.act_number, entry.scene_number, entry.sequence_number))
    return entries


@router.get(
    "/{production_id}/reports/on-stage-chart",
    response_model=OnStageChartReport,
)
def on_stage_chart(
    production_id: int,
    user: User = Depends(require_production_capability("reports", "read")),
    db: Session = Depends(get_db),
) -> OnStageChartReport:
    return build_on_stage_chart(db, production_id)
