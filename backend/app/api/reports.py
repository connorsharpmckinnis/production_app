from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import require_authenticated
from app.db.session import get_db
from app.models import (
    Act,
    Costume,
    Cue,
    CueCategory,
    Moment,
    MomentProp,
    Production,
    Prop,
    Scene,
    User,
)
from app.schemas.reports import (
    CostumeBySceneEntry,
    CostumesBySceneGroup,
    CueSheetCategory,
    CueSheetMomentReference,
    PropSheetEntry,
    PropSheetMomentReference,
)

router = APIRouter(prefix="/productions", tags=["reports"])


def _get_production_or_404(db: Session, production_id: int) -> Production:
    production = db.query(Production).filter(Production.id == production_id).first()
    if production is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production not found")
    return production


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
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[PropSheetEntry]:
    _get_production_or_404(db, production_id)
    timeline = _timeline_moment_order(db, production_id)
    moment_context = {moment.id: (moment, act, scene) for moment, act, scene in timeline}

    props = (
        db.query(Prop)
        .filter(Prop.production_id == production_id)
        .order_by(Prop.name)
        .all()
    )

    moment_props = (
        db.query(MomentProp)
        .options(
            joinedload(MomentProp.character),
            joinedload(MomentProp.moment).joinedload(Moment.scene).joinedload(Scene.act),
        )
        .join(Moment, MomentProp.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .all()
    )

    attachments_by_prop: dict[int, list[MomentProp]] = {prop.id: [] for prop in props}
    for attachment in moment_props:
        if attachment.prop_id in attachments_by_prop:
            attachments_by_prop[attachment.prop_id].append(attachment)

    entries: list[PropSheetEntry] = []
    for prop in props:
        references: list[PropSheetMomentReference] = []
        for attachment in attachments_by_prop[prop.id]:
            moment, act, scene = moment_context[attachment.moment_id]
            character_name = attachment.character.name if attachment.character else None
            references.append(
                PropSheetMomentReference(
                    moment_id=moment.id,
                    sequence_number=moment.sequence_number,
                    act_number=act.number,
                    scene_number=scene.number,
                    scene_title=scene.title,
                    character_name=character_name,
                    notes=attachment.notes,
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
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[CueSheetCategory]:
    _get_production_or_404(db, production_id)
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
    "/{production_id}/reports/costumes-by-scene",
    response_model=list[CostumesBySceneGroup],
)
def costumes_by_scene(
    production_id: int,
    _user: User = Depends(require_authenticated),
    db: Session = Depends(get_db),
) -> list[CostumesBySceneGroup]:
    _get_production_or_404(db, production_id)

    scenes = (
        db.query(Scene)
        .join(Act)
        .options(joinedload(Scene.act))
        .filter(Act.production_id == production_id)
        .order_by(Act.sort_order, Scene.sort_order)
        .all()
    )

    costumes = (
        db.query(Costume)
        .options(joinedload(Costume.character))
        .filter(Costume.production_id == production_id)
        .order_by(Costume.character_id, Costume.name)
        .all()
    )

    costumes_by_scene: dict[int, list[Costume]] = {scene.id: [] for scene in scenes}
    for costume in costumes:
        if costume.scene_id in costumes_by_scene:
            costumes_by_scene[costume.scene_id].append(costume)

    groups: list[CostumesBySceneGroup] = []
    for scene in scenes:
        scene_costumes = costumes_by_scene[scene.id]
        if not scene_costumes:
            continue
        groups.append(
            CostumesBySceneGroup(
                scene_id=scene.id,
                act_number=scene.act.number,
                scene_number=scene.number,
                scene_title=scene.title,
                costumes=[
                    CostumeBySceneEntry(
                        costume_id=costume.id,
                        character_id=costume.character_id,
                        character_name=costume.character.name,
                        name=costume.name,
                        description=costume.description,
                    )
                    for costume in scene_costumes
                ],
            )
        )
    return groups
