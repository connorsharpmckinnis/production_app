"""Production prep readiness scoring (derived, not stored).

Soft catalog dimensions (cues, props, lav chart, set pieces):
  score = (40 if catalog has ≥1 row else 0) + 60 * (scenes_with_use / scene_count)

When scene_count == 0, soft coverage has no denominator — the dimension is N/A
and excluded from the overall average.

Hard dimensions use simple coverage fractions:
  casting, costumes, entrances/exits, blocking.

Builtin characters (ALL, ENSEMBLE) are excluded from casting and costume
denominators. Costume coverage is distinct non-builtin speaking (Dialogue)
character × scene pairs with at least one costume for that exact scene.

When act_count == 0, overall readiness is 0 (no fake progress before import).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import distinct, func
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Act,
    Character,
    Costume,
    Cue,
    CueCategory,
    Dialogue,
    LavPackAssignment,
    LavWireAssignment,
    Moment,
    MomentBlocking,
    MomentEntrance,
    MomentExit,
    MomentProp,
    MomentSetPiece,
    Pack,
    Prop,
    Scene,
    SetPiece,
    Wire,
)
from app.services.importer.builtins import BUILTIN_CHARACTER_NAMES

# Soft dimensions: partial credit for seeding a catalog, majority for timeline use.
SOFT_SEEDED_WEIGHT = 40
SOFT_COVERAGE_WEIGHT = 60

_GAP_LIMIT = 25
_BUILTIN_NAMES = frozenset(BUILTIN_CHARACTER_NAMES)


@dataclass(frozen=True)
class ReadinessDimensionResult:
    key: str
    label: str
    score: int | None
    summary: str
    href_hint: str
    gaps: list[str]


@dataclass(frozen=True)
class ReadinessResult:
    readiness_percent: int | None
    dimensions: list[ReadinessDimensionResult]


def compute_readiness(db: Session, production_id: int) -> ReadinessResult:
    act_count = (
        db.query(func.count(Act.id)).filter(Act.production_id == production_id).scalar() or 0
    )
    if act_count == 0:
        return ReadinessResult(readiness_percent=0, dimensions=[])

    scenes = _production_scenes(db, production_id)
    scene_count = len(scenes)
    scene_ids = [scene.id for scene, _act in scenes]

    cue_scenes = _scenes_with_cues(db, production_id)
    prop_scenes = _scenes_with_attachment(db, production_id, MomentProp)
    lav_scenes = _scenes_with_lav_assignments(db, production_id)
    set_piece_scenes = _scenes_with_attachment(db, production_id, MomentSetPiece)
    lav_catalog_count = (
        _count_for_production(db, Wire, production_id)
        + _count_for_production(db, Pack, production_id)
    )

    dimensions = [
        _casting_dimension(db, production_id),
        _costume_dimension(db, production_id, scenes),
        _soft_catalog_dimension(
            key="cues",
            label="Cues",
            href_hint="cue-categories",
            catalog_count=_count_for_production(db, CueCategory, production_id),
            scenes_with_use=len(cue_scenes),
            scene_count=scene_count,
            empty_catalog_summary="No cue categories yet",
            unused_summary="Cue categories seeded but unused on the timeline",
            coverage_summary_fn=lambda used, total: (
                f"{used} of {total} scenes have at least one cue"
            ),
            gaps=_soft_scene_gaps(scenes, cue_scenes, "no cues"),
        ),
        _soft_catalog_dimension(
            key="props",
            label="Props",
            href_hint="props",
            catalog_count=_count_for_production(db, Prop, production_id),
            scenes_with_use=len(prop_scenes),
            scene_count=scene_count,
            empty_catalog_summary="No props in the catalog yet",
            unused_summary="Props catalog seeded but unused on the timeline",
            coverage_summary_fn=lambda used, total: (
                f"{used} of {total} scenes have at least one prop"
            ),
            gaps=_soft_scene_gaps(scenes, prop_scenes, "no props"),
        ),
        _soft_catalog_dimension(
            key="lav_chart",
            label="Lav chart",
            href_hint="lav-chart",
            catalog_count=lav_catalog_count,
            scenes_with_use=len(lav_scenes),
            scene_count=scene_count,
            empty_catalog_summary="No wires or packs in the lav inventory yet",
            unused_summary="Lav inventory seeded but no scene assignments on the lav chart",
            coverage_summary_fn=lambda used, total: (
                f"{used} of {total} scenes have lav wire/pack assignments"
            ),
            gaps=_soft_scene_gaps(scenes, lav_scenes, "no lav assignments"),
        ),
        _soft_catalog_dimension(
            key="set_pieces",
            label="Set pieces",
            href_hint="set-pieces",
            catalog_count=_count_for_production(db, SetPiece, production_id),
            scenes_with_use=len(set_piece_scenes),
            scene_count=scene_count,
            empty_catalog_summary="No set pieces in the catalog yet",
            unused_summary="Set piece catalog seeded but unused on the timeline",
            coverage_summary_fn=lambda used, total: (
                f"{used} of {total} scenes have at least one set piece"
            ),
            gaps=_soft_scene_gaps(scenes, set_piece_scenes, "no set pieces"),
        ),
        _entrances_exits_dimension(db, scenes, scene_ids),
        _blocking_dimension(db, scenes, scene_ids),
    ]

    scored = [dimension.score for dimension in dimensions if dimension.score is not None]
    if not scored:
        readiness_percent: int | None = None
    else:
        readiness_percent = round(sum(scored) / len(scored))

    return ReadinessResult(readiness_percent=readiness_percent, dimensions=dimensions)


def _production_scenes(db: Session, production_id: int) -> list[tuple[Scene, Act]]:
    rows = (
        db.query(Scene, Act)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(Act.sort_order, Scene.sort_order)
        .all()
    )
    return [(scene, act) for scene, act in rows]


def _count_for_production(db: Session, model: type, production_id: int) -> int:
    return db.query(func.count(model.id)).filter(model.production_id == production_id).scalar() or 0


def _scene_label(act: Act, scene: Scene) -> str:
    title = scene.title.strip() if scene.title and scene.title.strip() else f"Scene {scene.number}"
    return f"Act {act.number} / {title}"


def _limit_gaps(gaps: list[str]) -> list[str]:
    return gaps[:_GAP_LIMIT]


def _soft_score(catalog_count: int, scenes_with_use: int, scene_count: int) -> int | None:
    if scene_count == 0:
        return None
    seeded = SOFT_SEEDED_WEIGHT if catalog_count > 0 else 0
    coverage = SOFT_COVERAGE_WEIGHT * (scenes_with_use / scene_count)
    return round(seeded + coverage)


def _soft_catalog_dimension(
    *,
    key: str,
    label: str,
    href_hint: str,
    catalog_count: int,
    scenes_with_use: int,
    scene_count: int,
    empty_catalog_summary: str,
    unused_summary: str,
    coverage_summary_fn: Callable[[int, int], str],
    gaps: list[str],
) -> ReadinessDimensionResult:
    score = _soft_score(catalog_count, scenes_with_use, scene_count)
    if score is None:
        summary = "No scenes yet"
    elif catalog_count == 0 and scenes_with_use == 0:
        summary = empty_catalog_summary
    elif catalog_count > 0 and scenes_with_use == 0:
        summary = unused_summary
    else:
        summary = coverage_summary_fn(scenes_with_use, scene_count)
        if catalog_count == 0:
            summary = f"{summary} (catalog empty)"

    return ReadinessDimensionResult(
        key=key,
        label=label,
        score=score,
        summary=summary,
        href_hint=href_hint,
        gaps=_limit_gaps(gaps) if score is not None and score < 100 else [],
    )


def _casting_dimension(db: Session, production_id: int) -> ReadinessDimensionResult:
    characters = (
        db.query(Character)
        .options(joinedload(Character.actor_assignment))
        .filter(Character.production_id == production_id)
        .order_by(Character.name)
        .all()
    )
    castable = [character for character in characters if character.name not in _BUILTIN_NAMES]
    if not castable:
        return ReadinessDimensionResult(
            key="casting",
            label="Casting",
            score=None,
            summary="No castable characters",
            href_hint="characters",
            gaps=[],
        )

    uncast = [character for character in castable if character.actor_assignment is None]
    cast_count = len(castable) - len(uncast)
    score = round(100 * cast_count / len(castable))
    if uncast:
        summary = f"{len(uncast)} of {len(castable)} castable characters still need an actor"
    else:
        summary = f"All {len(castable)} castable characters are cast"

    return ReadinessDimensionResult(
        key="casting",
        label="Casting",
        score=score,
        summary=summary,
        href_hint="characters",
        gaps=_limit_gaps([character.name for character in uncast]),
    )


def _costume_dimension(
    db: Session,
    production_id: int,
    scenes: list[tuple[Scene, Act]],
) -> ReadinessDimensionResult:
    speaking_rows = (
        db.query(
            Dialogue.character_id,
            Scene.id,
            Character.name,
        )
        .join(Moment, Dialogue.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .join(Character, Character.id == Dialogue.character_id)
        .filter(Act.production_id == production_id)
        .filter(Character.name.notin_(_BUILTIN_NAMES))
        .distinct()
        .all()
    )

    scene_by_id = {scene.id: (scene, act) for scene, act in scenes}
    pairs: dict[tuple[int, int], tuple[str, Act, Scene]] = {}
    for character_id, scene_id, character_name in speaking_rows:
        scene_act = scene_by_id.get(scene_id)
        if scene_act is None:
            continue
        scene, act = scene_act
        pairs[(character_id, scene_id)] = (character_name, act, scene)

    denominator = len(pairs)
    if denominator == 0:
        return ReadinessDimensionResult(
            key="costumes",
            label="Costumes",
            score=None,
            summary="No speaking character × scene pairs",
            href_hint="costumes",
            gaps=[],
        )

    costume_pairs = {
        (costume.character_id, costume.scene_id)
        for costume in db.query(Costume).filter(Costume.production_id == production_id).all()
    }
    missing = [
        (character_name, act, scene)
        for (character_id, scene_id), (character_name, act, scene) in sorted(
            pairs.items(),
            key=lambda item: (item[1][1].number, item[1][2].number, item[1][0]),
        )
        if (character_id, scene_id) not in costume_pairs
    ]
    numerator = denominator - len(missing)
    score = round(100 * numerator / denominator)

    if missing:
        summary = f"{len(missing)} of {denominator} speaking roles missing a scene costume"
    else:
        summary = f"All {denominator} speaking character × scene pairs have costumes"

    gaps = [
        f"{character_name} in {_scene_label(act, scene)} — no costume"
        for character_name, act, scene in missing
    ]
    return ReadinessDimensionResult(
        key="costumes",
        label="Costumes",
        score=score,
        summary=summary,
        href_hint="costumes",
        gaps=_limit_gaps(gaps),
    )


def _scenes_with_cues(db: Session, production_id: int) -> set[int]:
    rows = (
        db.query(distinct(Scene.id))
        .join(Moment, Moment.scene_id == Scene.id)
        .join(Cue, Cue.moment_id == Moment.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .all()
    )
    return {row[0] for row in rows}


def _scenes_with_attachment(db: Session, production_id: int, attachment_model: type) -> set[int]:
    rows = (
        db.query(distinct(Scene.id))
        .join(Moment, Moment.scene_id == Scene.id)
        .join(attachment_model, attachment_model.moment_id == Moment.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .all()
    )
    return {row[0] for row in rows}


def _scenes_with_lav_assignments(db: Session, production_id: int) -> set[int]:
    """Scene IDs that appear in lav wire or pack assignments for this production."""
    wire_rows = (
        db.query(distinct(LavWireAssignment.scene_id))
        .filter(LavWireAssignment.production_id == production_id)
        .all()
    )
    pack_rows = (
        db.query(distinct(LavPackAssignment.scene_id))
        .filter(LavPackAssignment.production_id == production_id)
        .all()
    )
    return {row[0] for row in wire_rows} | {row[0] for row in pack_rows}


def _soft_scene_gaps(
    scenes: list[tuple[Scene, Act]],
    scenes_with_use: set[int],
    missing_label: str,
) -> list[str]:
    return [
        f"{_scene_label(act, scene)} — {missing_label}"
        for scene, act in scenes
        if scene.id not in scenes_with_use
    ]


def _entrances_exits_dimension(
    db: Session,
    scenes: list[tuple[Scene, Act]],
    scene_ids: list[int],
) -> ReadinessDimensionResult:
    if not scene_ids:
        return ReadinessDimensionResult(
            key="entrances_exits",
            label="Entrances / exits",
            score=None,
            summary="No scenes yet",
            href_hint="timeline",
            gaps=[],
        )

    entrance_scenes = {
        row[0]
        for row in (
            db.query(distinct(Moment.scene_id))
            .join(MomentEntrance, MomentEntrance.moment_id == Moment.id)
            .filter(Moment.scene_id.in_(scene_ids))
            .all()
        )
    }
    exit_scenes = {
        row[0]
        for row in (
            db.query(distinct(Moment.scene_id))
            .join(MomentExit, MomentExit.moment_id == Moment.id)
            .filter(Moment.scene_id.in_(scene_ids))
            .all()
        )
    }
    complete = entrance_scenes & exit_scenes
    missing = [(scene, act) for scene, act in scenes if scene.id not in complete]
    score = round(100 * len(complete) / len(scene_ids))
    if missing:
        summary = f"{len(missing)} of {len(scene_ids)} scenes missing an entrance or exit"
    else:
        summary = f"All {len(scene_ids)} scenes have entrances and exits"

    gaps: list[str] = []
    for scene, act in missing:
        has_entrance = scene.id in entrance_scenes
        has_exit = scene.id in exit_scenes
        if not has_entrance and not has_exit:
            detail = "no entrances or exits"
        elif not has_entrance:
            detail = "no entrances"
        else:
            detail = "no exits"
        gaps.append(f"{_scene_label(act, scene)} — {detail}")

    return ReadinessDimensionResult(
        key="entrances_exits",
        label="Entrances / exits",
        score=score,
        summary=summary,
        href_hint="timeline",
        gaps=_limit_gaps(gaps),
    )


def _blocking_dimension(
    db: Session,
    scenes: list[tuple[Scene, Act]],
    scene_ids: list[int],
) -> ReadinessDimensionResult:
    if not scene_ids:
        return ReadinessDimensionResult(
            key="blocking",
            label="Blocking",
            score=None,
            summary="No scenes yet",
            href_hint="timeline",
            gaps=[],
        )

    blocking_scenes = {
        row[0]
        for row in (
            db.query(distinct(Moment.scene_id))
            .join(MomentBlocking, MomentBlocking.moment_id == Moment.id)
            .filter(Moment.scene_id.in_(scene_ids))
            .all()
        )
    }
    missing = [(scene, act) for scene, act in scenes if scene.id not in blocking_scenes]
    score = round(100 * len(blocking_scenes) / len(scene_ids))
    if missing:
        summary = f"{len(missing)} of {len(scene_ids)} scenes have no blocking"
    else:
        summary = f"All {len(scene_ids)} scenes have blocking"

    gaps = [f"{_scene_label(act, scene)} — no blocking" for scene, act in missing]
    return ReadinessDimensionResult(
        key="blocking",
        label="Blocking",
        score=score,
        summary=summary,
        href_hint="timeline",
        gaps=_limit_gaps(gaps),
    )
