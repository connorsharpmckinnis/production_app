"""Build on-stage presence intervals for the Reports chart prototype.

Presence follows the same scene-scoped rules as ``on_stage.py``: the on-stage
set starts empty at every scene, and a moment applies all entrances before all
exits. Intervals are compressed so the UI draws bars, not per-moment cells.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Act, Character, Group, Moment, MomentEntrance, MomentExit, Scene
from app.schemas.reports import (
    OnStageChartActBand,
    OnStageChartCharacterRow,
    OnStageChartGroupRow,
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
    character_entrances: tuple[tuple[int, str | None], ...]
    character_exits: tuple[tuple[int, str | None], ...]
    group_entrances: tuple[tuple[int, str | None], ...]
    group_exits: tuple[tuple[int, str | None], ...]


@dataclass
class _OpenInterval:
    subject_id: int
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


def _assemble_intervals(
    moments: list[ChartMoment],
    entrances_for_moment: Callable[[ChartMoment], tuple[tuple[int, str | None], ...]],
    exits_for_moment: Callable[[ChartMoment], tuple[tuple[int, str | None], ...]],
) -> dict[int, list[OnStageChartInterval]]:
    open_by_subject: dict[int, _OpenInterval] = {}
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
        closed[opened.subject_id].append(
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
        for opened in open_by_subject.values():
            close_interval(opened, end_index, None, None, True)
        open_by_subject.clear()

    previous_scene_id: int | None = None

    for index, moment in enumerate(moments):
        if previous_scene_id is not None and moment.scene_id != previous_scene_id:
            close_scene(index)
        previous_scene_id = moment.scene_id

        for subject_id, notes in entrances_for_moment(moment):
            if subject_id in open_by_subject:
                continue
            open_by_subject[subject_id] = _OpenInterval(
                subject_id=subject_id,
                start_index=index,
                entrance=moment_ref(moment),
                entrance_notes=notes,
            )

        for subject_id, notes in exits_for_moment(moment):
            opened = open_by_subject.pop(subject_id, None)
            if opened is None:
                continue
            close_interval(opened, index, moment_ref(moment), notes, False)

    if open_by_subject:
        close_scene(len(moments))

    return closed


def assemble_on_stage_chart(
    moments: list[ChartMoment],
    character_names: dict[int, str],
    group_names: dict[int, str],
) -> OnStageChartReport:
    """Turn an ordered moment spine into act/scene bands and presence bars."""
    acts: list[OnStageChartActBand] = []
    scenes: list[OnStageChartSceneBand] = []
    previous_act_id: int | None = None

    for index, moment in enumerate(moments):
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

    character_closed = _assemble_intervals(
        moments,
        lambda moment: moment.character_entrances,
        lambda moment: moment.character_exits,
    )
    group_closed = _assemble_intervals(
        moments,
        lambda moment: moment.group_entrances,
        lambda moment: moment.group_exits,
    )

    character_rows: list[OnStageChartCharacterRow] = []
    for character_id, intervals in character_closed.items():
        name = character_names.get(character_id, f"Character {character_id}")
        intervals.sort(key=lambda item: item.start_index)
        character_rows.append(
            OnStageChartCharacterRow(
                character_id=character_id,
                character_name=name,
                intervals=intervals,
            )
        )
    character_rows.sort(key=lambda row: (row.character_name.lower(), row.character_id))

    group_rows: list[OnStageChartGroupRow] = []
    for group_id, intervals in group_closed.items():
        name = group_names.get(group_id, f"Group {group_id}")
        intervals.sort(key=lambda item: item.start_index)
        group_rows.append(
            OnStageChartGroupRow(
                group_id=group_id,
                group_name=name,
                intervals=intervals,
            )
        )
    group_rows.sort(key=lambda row: (row.group_name.lower(), row.group_id))

    return OnStageChartReport(
        moment_count=len(moments),
        acts=acts,
        scenes=scenes,
        characters=character_rows,
        groups=group_rows,
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
        entrance_rows = entrances_by_moment[moment.id]
        exit_rows = exits_by_moment[moment.id]
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
                character_entrances=tuple(
                    (row.character_id, row.notes)
                    for row in entrance_rows
                    if row.character_id is not None
                ),
                character_exits=tuple(
                    (row.character_id, row.notes)
                    for row in exit_rows
                    if row.character_id is not None
                ),
                group_entrances=tuple(
                    (row.group_id, row.notes)
                    for row in entrance_rows
                    if row.group_id is not None
                ),
                group_exits=tuple(
                    (row.group_id, row.notes)
                    for row in exit_rows
                    if row.group_id is not None
                ),
            )
        )
    return chart_moments


def build_on_stage_chart(db: Session, production_id: int) -> OnStageChartReport:
    """Assemble the Reports on-stage chart for one production."""
    moments = load_chart_moments(db, production_id)
    character_ids: set[int] = set()
    group_ids: set[int] = set()
    for moment in moments:
        character_ids.update(subject_id for subject_id, _notes in moment.character_entrances)
        character_ids.update(subject_id for subject_id, _notes in moment.character_exits)
        group_ids.update(subject_id for subject_id, _notes in moment.group_entrances)
        group_ids.update(subject_id for subject_id, _notes in moment.group_exits)

    character_names: dict[int, str] = {}
    if character_ids:
        characters = (
            db.query(Character)
            .filter(
                Character.production_id == production_id,
                Character.id.in_(character_ids),
            )
            .all()
        )
        character_names = {character.id: character.name for character in characters}

    group_names: dict[int, str] = {}
    if group_ids:
        groups = (
            db.query(Group)
            .filter(Group.production_id == production_id, Group.id.in_(group_ids))
            .all()
        )
        group_names = {group.id: group.name for group in groups}

    return assemble_on_stage_chart(moments, character_names, group_names)
