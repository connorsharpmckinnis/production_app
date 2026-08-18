"""Build on-stage presence intervals for the Reports chart prototype.

Presence follows the same scene-scoped rules as ``on_stage.py``: the on-stage
set starts empty at every scene, and a moment applies all entrances before all
exits. Intervals are compressed so the UI draws bars, not per-moment cells.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Act, Character, Moment, MomentEntrance, MomentExit, Scene
from app.schemas.reports import (
    OnStageChartActBand,
    OnStageChartCharacterRow,
    OnStageChartInterval,
    OnStageChartMomentRef,
    OnStageChartReport,
    OnStageChartSceneBand,
)


@dataclass(frozen=True)
class ChartMoment:
    """One spine position: a moment plus the act/scene labels around it."""

    moment_id: int
    scene_id: int
    act_id: int
    act_number: int
    act_title: str | None
    scene_number: int
    scene_title: str | None
    sequence_number: int
    # (character_id, notes) in stable id order
    entrances: tuple[tuple[int, str | None], ...]
    exits: tuple[tuple[int, str | None], ...]


@dataclass
class _OpenInterval:
    character_id: int
    start_index: int
    entrance: OnStageChartMomentRef
    entrance_notes: str | None


def moment_ref(moment: ChartMoment) -> OnStageChartMomentRef:
    return OnStageChartMomentRef(
        moment_id=moment.moment_id,
        sequence_number=moment.sequence_number,
        act_number=moment.act_number,
        scene_number=moment.scene_number,
        scene_title=moment.scene_title,
    )


def assemble_on_stage_chart(
    moments: list[ChartMoment],
    character_names: dict[int, str],
) -> OnStageChartReport:
    """Turn an ordered moment spine into act/scene bands and presence bars."""
    acts: list[OnStageChartActBand] = []
    scenes: list[OnStageChartSceneBand] = []
    open_by_character: dict[int, _OpenInterval] = {}
    closed: dict[int, list[OnStageChartInterval]] = defaultdict(list)

    def close_interval(
        opened: _OpenInterval,
        end_index: int,
        exit_ref: OnStageChartMomentRef | None,
        exit_notes: str | None,
        ends_at_scene_boundary: bool,
    ) -> None:
        if end_index <= opened.start_index:
            end_index = opened.start_index + 1
        closed[opened.character_id].append(
            OnStageChartInterval(
                start_index=opened.start_index,
                end_index=end_index,
                entrance=opened.entrance,
                entrance_notes=opened.entrance_notes,
                exit=exit_ref,
                exit_notes=exit_notes,
                ends_at_scene_boundary=ends_at_scene_boundary,
            )
        )

    def close_scene(end_index: int) -> None:
        for opened in open_by_character.values():
            close_interval(opened, end_index, None, None, True)
        open_by_character.clear()

    previous_scene_id: int | None = None
    previous_act_id: int | None = None

    for index, moment in enumerate(moments):
        if previous_scene_id is not None and moment.scene_id != previous_scene_id:
            close_scene(index)
        previous_scene_id = moment.scene_id

        if not acts or previous_act_id != moment.act_id:
            acts.append(
                OnStageChartActBand(
                    act_id=moment.act_id,
                    act_number=moment.act_number,
                    act_title=moment.act_title,
                    start_index=index,
                    moment_count=1,
                )
            )
            previous_act_id = moment.act_id
        else:
            acts[-1] = acts[-1].model_copy(
                update={"moment_count": acts[-1].moment_count + 1}
            )

        if not scenes or scenes[-1].scene_id != moment.scene_id:
            scenes.append(
                OnStageChartSceneBand(
                    scene_id=moment.scene_id,
                    act_number=moment.act_number,
                    scene_number=moment.scene_number,
                    scene_title=moment.scene_title,
                    start_index=index,
                    moment_count=1,
                )
            )
        else:
            scenes[-1] = scenes[-1].model_copy(
                update={"moment_count": scenes[-1].moment_count + 1}
            )

        for character_id, notes in moment.entrances:
            if character_id in open_by_character:
                continue
            open_by_character[character_id] = _OpenInterval(
                character_id=character_id,
                start_index=index,
                entrance=moment_ref(moment),
                entrance_notes=notes,
            )

        for character_id, notes in moment.exits:
            opened = open_by_character.pop(character_id, None)
            if opened is None:
                continue
            close_interval(opened, index, moment_ref(moment), notes, False)

    if open_by_character:
        close_scene(len(moments))

    rows: list[OnStageChartCharacterRow] = []
    for character_id, intervals in closed.items():
        name = character_names.get(character_id, f"Character {character_id}")
        intervals.sort(key=lambda item: item.start_index)
        rows.append(
            OnStageChartCharacterRow(
                character_id=character_id,
                character_name=name,
                intervals=intervals,
            )
        )
    rows.sort(key=lambda row: (row.character_name.lower(), row.character_id))

    return OnStageChartReport(
        moment_count=len(moments),
        acts=acts,
        scenes=scenes,
        characters=rows,
    )


def load_chart_moments(db: Session, production_id: int) -> list[ChartMoment]:
    """Load the production spine and attach entrance/exit events per moment."""
    timeline = (
        db.query(Moment, Act, Scene)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(Act.sort_order, Scene.sort_order, Moment.sequence_number)
        .all()
    )

    entrances_by_moment: dict[int, list[MomentEntrance]] = defaultdict(list)
    for entrance in (
        db.query(MomentEntrance)
        .join(Moment, MomentEntrance.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(MomentEntrance.id)
        .all()
    ):
        entrances_by_moment[entrance.moment_id].append(entrance)

    exits_by_moment: dict[int, list[MomentExit]] = defaultdict(list)
    for exit_row in (
        db.query(MomentExit)
        .join(Moment, MomentExit.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(MomentExit.id)
        .all()
    ):
        exits_by_moment[exit_row.moment_id].append(exit_row)

    chart_moments: list[ChartMoment] = []
    for moment, act, scene in timeline:
        chart_moments.append(
            ChartMoment(
                moment_id=moment.id,
                scene_id=scene.id,
                act_id=act.id,
                act_number=act.number,
                act_title=act.title,
                scene_number=scene.number,
                scene_title=scene.title,
                sequence_number=moment.sequence_number,
                entrances=tuple(
                    (row.character_id, row.notes)
                    for row in entrances_by_moment[moment.id]
                ),
                exits=tuple(
                    (row.character_id, row.notes) for row in exits_by_moment[moment.id]
                ),
            )
        )
    return chart_moments


def build_on_stage_chart(db: Session, production_id: int) -> OnStageChartReport:
    """Assemble the Reports on-stage chart for one production."""
    moments = load_chart_moments(db, production_id)
    character_ids: set[int] = set()
    for moment in moments:
        character_ids.update(character_id for character_id, _notes in moment.entrances)
        character_ids.update(character_id for character_id, _notes in moment.exits)

    names: dict[int, str] = {}
    if character_ids:
        characters = (
            db.query(Character)
            .filter(
                Character.production_id == production_id,
                Character.id.in_(character_ids),
            )
            .all()
        )
        names = {character.id: character.name for character in characters}

    return assemble_on_stage_chart(moments, names)
