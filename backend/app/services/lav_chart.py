"""Lav chart assembly, validation, and propose heuristics (Phase 12)."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Act,
    Character,
    Dialogue,
    LavPackAssignment,
    LavRowLock,
    LavWireAssignment,
    LyricLine,
    Moment,
    Pack,
    Scene,
    UserCharacterAssignment,
    Wire,
)
from app.schemas.lav_chart import (
    LavChartCatalogItem,
    LavChartIssue,
    LavChartResponse,
    LavChartRow,
    LavChartSceneColumn,
    LavPackCell,
    LavWireCell,
)
from app.services.importer.builtins import BUILTIN_CHARACTER_NAMES

LAV_CHART_RULES: list[str] = [
    "Anyone with dialogue or lyrics needs a lav when they speak or sing (ALL / ENSEMBLE excluded).",
    "Wires and packs are separate inventories; charts are planned per production.",
    "Prefer one assignment for the whole show; next preference is change only at intermission.",
    "Propose never inserts mid-act wearer swaps between people.",
    "Wires are typically worn from the top of the show; packs are assigned when speaking/singing requires them.",
    "If inventory cannot cover need scenes without mid-act changes, the chart is flagged for manual mid-act work.",
    "Propose replaces the whole sheet (wires or packs) with a fresh rule-based chart; tweak manually afterward.",
    "Tech director edits always win after Propose — re-running Propose will overwrite them.",
]


@dataclass
class _Wearer:
    row_key: str
    user_id: int | None
    character_id: int | None
    label: str
    character_ids: list[int]
    character_names: list[str]
    need_scene_ids: set[int]
    load: int = 0


@dataclass
class _SceneCol:
    id: int
    act_id: int
    act_number: int
    act_title: str | None
    scene_number: int
    scene_title: str | None


@dataclass
class _ProposeResult:
    wire_cells: list[LavWireCell] = field(default_factory=list)
    pack_cells: list[LavPackCell] = field(default_factory=list)
    issues: list[LavChartIssue] = field(default_factory=list)


def row_key_for_user(user_id: int) -> str:
    return f"user:{user_id}"


def row_key_for_character(character_id: int) -> str:
    return f"character:{character_id}"


def parse_row_key(row_key: str) -> tuple[int | None, int | None]:
    if row_key.startswith("user:"):
        return int(row_key.split(":", 1)[1]), None
    if row_key.startswith("character:"):
        return None, int(row_key.split(":", 1)[1])
    raise ValueError(f"Invalid lav chart row_key: {row_key}")


def validate_row_keys(row_keys: list[str]) -> None:
    for row_key in row_keys:
        parse_row_key(row_key)


def _merge_wire_cells(
    proposed: list[LavWireCell],
    existing: list[LavWireCell],
    locked_row_keys: set[str],
    preserve_filled_and_locked: bool,
) -> list[LavWireCell]:
    existing_by_key = {(c.row_key, c.scene_id): c for c in existing}
    proposed_by_key = {(c.row_key, c.scene_id): c for c in proposed}
    merged: list[LavWireCell] = []
    for coord in set(existing_by_key) | set(proposed_by_key):
        row_key, scene_id = coord
        existing_cell = existing_by_key.get(coord)
        proposed_cell = proposed_by_key.get(coord)
        if row_key in locked_row_keys:
            if existing_cell is not None and existing_cell.wire_id is not None:
                merged.append(existing_cell)
            continue
        if (
            preserve_filled_and_locked
            and existing_cell is not None
            and existing_cell.wire_id is not None
        ):
            merged.append(existing_cell)
            continue
        if proposed_cell is not None and proposed_cell.wire_id is not None:
            merged.append(proposed_cell)
    return merged


def _merge_pack_cells(
    proposed: list[LavPackCell],
    existing: list[LavPackCell],
    locked_row_keys: set[str],
    preserve_filled_and_locked: bool,
) -> list[LavPackCell]:
    existing_by_key = {(c.row_key, c.scene_id): c for c in existing}
    proposed_by_key = {(c.row_key, c.scene_id): c for c in proposed}
    merged: list[LavPackCell] = []
    for coord in set(existing_by_key) | set(proposed_by_key):
        row_key, scene_id = coord
        existing_cell = existing_by_key.get(coord)
        proposed_cell = proposed_by_key.get(coord)
        if row_key in locked_row_keys:
            if existing_cell is not None and existing_cell.pack_id is not None:
                merged.append(existing_cell)
            continue
        if (
            preserve_filled_and_locked
            and existing_cell is not None
            and existing_cell.pack_id is not None
        ):
            merged.append(existing_cell)
            continue
        if proposed_cell is not None and proposed_cell.pack_id is not None:
            merged.append(proposed_cell)
    return merged


def _ordered_scenes(db: Session, production_id: int) -> list[_SceneCol]:
    rows = (
        db.query(Scene, Act)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(Act.sort_order, Scene.sort_order)
        .all()
    )
    return [
        _SceneCol(
            id=scene.id,
            act_id=act.id,
            act_number=act.number,
            act_title=act.title,
            scene_number=scene.number,
            scene_title=scene.title,
        )
        for scene, act in rows
    ]


def _need_scenes_by_character(db: Session, production_id: int) -> dict[int, set[int]]:
    """Map character_id → scene ids where they speak or sing."""
    needs: dict[int, set[int]] = {}
    builtins = set(BUILTIN_CHARACTER_NAMES)

    dialogue_rows = (
        db.query(Dialogue.character_id, Scene.id, Character.name)
        .join(Moment, Dialogue.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .join(Character, Dialogue.character_id == Character.id)
        .filter(Act.production_id == production_id)
        .filter(Character.name.notin_(builtins))
        .distinct()
        .all()
    )
    for character_id, scene_id, _name in dialogue_rows:
        needs.setdefault(character_id, set()).add(scene_id)

    lyric_rows = (
        db.query(LyricLine.character_id, Scene.id, Character.name)
        .join(Moment, LyricLine.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .join(Character, LyricLine.character_id == Character.id)
        .filter(Act.production_id == production_id)
        .filter(Character.name.notin_(builtins))
        .distinct()
        .all()
    )
    for character_id, scene_id, _name in lyric_rows:
        needs.setdefault(character_id, set()).add(scene_id)

    return needs


def _build_wearers(db: Session, production_id: int) -> list[_Wearer]:
    needs = _need_scenes_by_character(db, production_id)
    if not needs:
        return []

    characters = (
        db.query(Character)
        .options(joinedload(Character.actor_assignment).joinedload(UserCharacterAssignment.user))
        .filter(Character.production_id == production_id)
        .filter(Character.id.in_(needs.keys()))
        .all()
    )
    by_id = {c.id: c for c in characters}

    actor_groups: dict[int, list[Character]] = {}
    uncast: list[Character] = []
    for character_id in needs:
        character = by_id.get(character_id)
        if character is None:
            continue
        assignment = character.actor_assignment
        if assignment is not None and assignment.user is not None:
            actor_groups.setdefault(assignment.user_id, []).append(character)
        else:
            uncast.append(character)

    wearers: list[_Wearer] = []
    for user_id, chars in actor_groups.items():
        chars_sorted = sorted(chars, key=lambda c: c.name)
        user = chars_sorted[0].actor_assignment.user
        names = [c.name for c in chars_sorted]
        need_ids: set[int] = set()
        for c in chars_sorted:
            need_ids |= needs.get(c.id, set())
        label = f"{user.first_name} {user.last_name} ({', '.join(names)})"
        wearers.append(
            _Wearer(
                row_key=row_key_for_user(user_id),
                user_id=user_id,
                character_id=None,
                label=label,
                character_ids=[c.id for c in chars_sorted],
                character_names=names,
                need_scene_ids=need_ids,
                load=len(need_ids),
            )
        )

    for character in sorted(uncast, key=lambda c: c.name):
        need_ids = needs.get(character.id, set())
        wearers.append(
            _Wearer(
                row_key=row_key_for_character(character.id),
                user_id=None,
                character_id=character.id,
                label=f"Uncast ({character.name})",
                character_ids=[character.id],
                character_names=[character.name],
                need_scene_ids=need_ids,
                load=len(need_ids),
            )
        )

    wearers.sort(key=lambda w: (-w.load, w.label.lower()))
    return wearers


def _cells_from_grid(
    grid: dict[str, dict[int, int | None]],
    *,
    kind: str,
) -> list[LavWireCell] | list[LavPackCell]:
    cells: list = []
    for row_key, scene_map in grid.items():
        for scene_id, asset_id in scene_map.items():
            if asset_id is None:
                continue
            if kind == "wire":
                cells.append(LavWireCell(row_key=row_key, scene_id=scene_id, wire_id=asset_id))
            else:
                cells.append(LavPackCell(row_key=row_key, scene_id=scene_id, pack_id=asset_id))
    return cells


def _empty_grid(wearers: list[_Wearer], scene_ids: list[int]) -> dict[str, dict[int, int | None]]:
    return {w.row_key: {sid: None for sid in scene_ids} for w in wearers}


def _propose_stable_assets(
    wearers: list[_Wearer],
    scenes: list[_SceneCol],
    asset_ids: list[int],
    *,
    cover_all_scenes_when_enough: bool,
    hold_silent_in_act: bool,
) -> tuple[dict[str, dict[int, int | None]], list[LavChartIssue]]:
    """Assign assets preferring whole-show, then act-stable reuse. Never mid-act swaps."""
    issues: list[LavChartIssue] = []
    scene_ids = [s.id for s in scenes]
    grid = _empty_grid(wearers, scene_ids)
    if not wearers:
        return grid, issues
    if not asset_ids:
        issues.append(
            LavChartIssue(
                code="no_inventory",
                severity="error",
                message="No inventory available. Add wires/packs, then run Propose again.",
            )
        )
        return grid, issues

    ordered = sorted(wearers, key=lambda w: (-w.load, w.label.lower()))
    acts: dict[int, list[_SceneCol]] = {}
    for scene in scenes:
        acts.setdefault(scene.act_id, []).append(scene)
    act_order = list(dict.fromkeys(s.act_id for s in scenes))

    def assign_wearer_scenes(wearer: _Wearer, target_scenes: list[_SceneCol], asset_id: int) -> None:
        for scene in target_scenes:
            if cover_all_scenes_when_enough:
                grid[wearer.row_key][scene.id] = asset_id
            elif scene.id in wearer.need_scene_ids:
                grid[wearer.row_key][scene.id] = asset_id
            elif hold_silent_in_act and any(
                sid in wearer.need_scene_ids for sid in [s.id for s in target_scenes]
            ):
                # Hold gear across silent scenes in this act to reduce on/off thrash.
                grid[wearer.row_key][scene.id] = asset_id

    # Whole-show unique assignment when inventory allows.
    if len(ordered) <= len(asset_ids):
        for index, wearer in enumerate(ordered):
            assign_wearer_scenes(wearer, scenes, asset_ids[index])
        return grid, issues

    # Act-stable: reuse assets across acts; within an act one asset → one wearer.
    shortfall_reported = False
    for act_id in act_order:
        act_scenes = acts[act_id]
        act_scene_ids = {s.id for s in act_scenes}
        act_wearers = [
            w for w in ordered if w.need_scene_ids.intersection(act_scene_ids)
        ]
        if len(act_wearers) > len(asset_ids):
            if not shortfall_reported:
                issues.append(
                    LavChartIssue(
                        code="mid_act_required",
                        severity="warning",
                        message=(
                            f"Inventory shortfall: at least one act needs {len(act_wearers)} wearers "
                            f"with only {len(asset_ids)} units. Mid-act changes must be added manually."
                        ),
                    )
                )
                shortfall_reported = True
            for index, wearer in enumerate(act_wearers):
                if index >= len(asset_ids):
                    break
                assign_wearer_scenes(wearer, act_scenes, asset_ids[index])
        else:
            for index, wearer in enumerate(act_wearers):
                assign_wearer_scenes(wearer, act_scenes, asset_ids[index])

    return grid, issues


def _validate_chart(
    wearers: list[_Wearer],
    scenes: list[_SceneCol],
    wire_cells: list[LavWireCell],
    pack_cells: list[LavPackCell],
) -> list[LavChartIssue]:
    issues: list[LavChartIssue] = []
    scene_ids = {s.id for s in scenes}

    wire_map: dict[tuple[str, int], int | None] = {}
    for cell in wire_cells:
        if cell.scene_id not in scene_ids:
            continue
        wire_map[(cell.row_key, cell.scene_id)] = cell.wire_id

    pack_map: dict[tuple[str, int], int | None] = {}
    for cell in pack_cells:
        if cell.scene_id not in scene_ids:
            continue
        pack_map[(cell.row_key, cell.scene_id)] = cell.pack_id

    # Conflicts: same asset on two wearers in one scene.
    for scene in scenes:
        wire_owners: dict[int, list[str]] = {}
        pack_owners: dict[int, list[str]] = {}
        for wearer in wearers:
            wire_id = wire_map.get((wearer.row_key, scene.id))
            if wire_id is not None:
                wire_owners.setdefault(wire_id, []).append(wearer.row_key)
            pack_id = pack_map.get((wearer.row_key, scene.id))
            if pack_id is not None:
                pack_owners.setdefault(pack_id, []).append(wearer.row_key)
        for asset_id, keys in wire_owners.items():
            if len(keys) > 1:
                issues.append(
                    LavChartIssue(
                        code="wire_conflict",
                        severity="error",
                        message="Wire assigned to multiple wearers in the same scene.",
                        scene_id=scene.id,
                        asset_id=asset_id,
                        row_key=keys[0],
                    )
                )
        for asset_id, keys in pack_owners.items():
            if len(keys) > 1:
                issues.append(
                    LavChartIssue(
                        code="pack_conflict",
                        severity="error",
                        message="Pack assigned to multiple wearers in the same scene.",
                        scene_id=scene.id,
                        asset_id=asset_id,
                        row_key=keys[0],
                    )
                )

    # Uncovered need scenes — one summary per wearer (cells still highlight via need ∩ empty).
    for wearer in wearers:
        missing_wire_scenes = [
            scene_id
            for scene_id in wearer.need_scene_ids
            if wire_map.get((wearer.row_key, scene_id)) is None
        ]
        missing_pack_scenes = [
            scene_id
            for scene_id in wearer.need_scene_ids
            if pack_map.get((wearer.row_key, scene_id)) is None
        ]
        if missing_wire_scenes:
            n = len(missing_wire_scenes)
            issues.append(
                LavChartIssue(
                    code="missing_wire",
                    severity="warning",
                    message=(
                        f"{wearer.label} speaks/sings without a wire in "
                        f"{n} need scene{'s' if n != 1 else ''}."
                    ),
                    row_key=wearer.row_key,
                    scene_id=missing_wire_scenes[0],
                )
            )
        if missing_pack_scenes:
            n = len(missing_pack_scenes)
            issues.append(
                LavChartIssue(
                    code="missing_pack",
                    severity="warning",
                    message=(
                        f"{wearer.label} speaks/sings without a pack in "
                        f"{n} need scene{'s' if n != 1 else ''}."
                    ),
                    row_key=wearer.row_key,
                    scene_id=missing_pack_scenes[0],
                )
            )

    # Mid-act change detection (wearer changes asset mid-act).
    acts: dict[int, list[_SceneCol]] = {}
    for scene in scenes:
        acts.setdefault(scene.act_id, []).append(scene)
    for act_scenes in acts.values():
        if len(act_scenes) < 2:
            continue
        for wearer in wearers:
            prev_wire = None
            prev_pack = None
            seen_wire = False
            seen_pack = False
            for scene in act_scenes:
                wire_id = wire_map.get((wearer.row_key, scene.id))
                pack_id = pack_map.get((wearer.row_key, scene.id))
                if wire_id is not None:
                    if seen_wire and prev_wire is not None and wire_id != prev_wire:
                        issues.append(
                            LavChartIssue(
                                code="mid_act_wire_change",
                                severity="warning",
                                message=f"{wearer.label} changes wires mid-act (manual booth change).",
                                row_key=wearer.row_key,
                                scene_id=scene.id,
                            )
                        )
                    prev_wire = wire_id
                    seen_wire = True
                if pack_id is not None:
                    if seen_pack and prev_pack is not None and pack_id != prev_pack:
                        issues.append(
                            LavChartIssue(
                                code="mid_act_pack_change",
                                severity="warning",
                                message=f"{wearer.label} changes packs mid-act (manual booth change).",
                                row_key=wearer.row_key,
                                scene_id=scene.id,
                            )
                        )
                    prev_pack = pack_id
                    seen_pack = True

    return _dedupe_issues(issues)


def _dedupe_issues(issues: list[LavChartIssue]) -> list[LavChartIssue]:
    """Keep first occurrence of identical code+message+row+scene."""
    seen: set[tuple[str, str, str | None, int | None]] = set()
    out: list[LavChartIssue] = []
    for issue in issues:
        key = (issue.code, issue.message, issue.row_key, issue.scene_id)
        if key in seen:
            continue
        seen.add(key)
        out.append(issue)
    return out


def propose_lav_chart(
    wearers: list[_Wearer],
    scenes: list[_SceneCol],
    wires: list[Wire],
    packs: list[Pack],
    *,
    sheets: list[str],
    existing_wire_cells: list[LavWireCell] | None = None,
    existing_pack_cells: list[LavPackCell] | None = None,
    locked_row_keys: set[str] | None = None,
    preserve_filled_and_locked: bool = False,
) -> _ProposeResult:
    result = _ProposeResult()
    wire_ids = [w.id for w in sorted(wires, key=lambda w: w.identifier)]
    pack_ids = [p.id for p in sorted(packs, key=lambda p: p.identifier)]
    sheet_set = {s.lower() for s in sheets}
    locked = locked_row_keys or set()
    existing_wires = list(existing_wire_cells or [])
    existing_packs = list(existing_pack_cells or [])

    if "wires" in sheet_set:
        grid, wire_issues = _propose_stable_assets(
            wearers,
            scenes,
            wire_ids,
            cover_all_scenes_when_enough=True,
            hold_silent_in_act=True,
        )
        proposed_wires = _cells_from_grid(grid, kind="wire")  # type: ignore[assignment]
        if preserve_filled_and_locked:
            result.wire_cells = _merge_wire_cells(
                proposed_wires,
                existing_wires,
                locked,
                preserve_filled_and_locked,
            )
        else:
            result.wire_cells = proposed_wires
        result.issues.extend(wire_issues)
    else:
        result.wire_cells = existing_wires

    if "packs" in sheet_set:
        grid, pack_issues = _propose_stable_assets(
            wearers,
            scenes,
            pack_ids,
            cover_all_scenes_when_enough=False,
            hold_silent_in_act=True,
        )
        proposed_packs = _cells_from_grid(grid, kind="pack")  # type: ignore[assignment]
        if preserve_filled_and_locked:
            result.pack_cells = _merge_pack_cells(
                proposed_packs,
                existing_packs,
                locked,
                preserve_filled_and_locked,
            )
        else:
            result.pack_cells = proposed_packs
        result.issues.extend(pack_issues)
    else:
        result.pack_cells = existing_packs

    result.issues.extend(
        _validate_chart(wearers, scenes, result.wire_cells, result.pack_cells)
    )
    return result


def _load_locked_row_keys(db: Session, production_id: int) -> list[str]:
    rows = (
        db.query(LavRowLock)
        .filter(LavRowLock.production_id == production_id)
        .order_by(LavRowLock.row_key)
        .all()
    )
    return [row.row_key for row in rows]


def replace_row_locks(db: Session, production_id: int, row_keys: list[str]) -> None:
    validate_row_keys(row_keys)
    db.query(LavRowLock).filter(LavRowLock.production_id == production_id).delete()
    for row_key in row_keys:
        db.add(LavRowLock(production_id=production_id, row_key=row_key))


def _load_wire_cells(db: Session, production_id: int) -> list[LavWireCell]:
    rows = db.query(LavWireAssignment).filter(LavWireAssignment.production_id == production_id).all()
    cells: list[LavWireCell] = []
    for row in rows:
        if row.user_id is not None:
            key = row_key_for_user(row.user_id)
        elif row.character_id is not None:
            key = row_key_for_character(row.character_id)
        else:
            continue
        cells.append(LavWireCell(row_key=key, scene_id=row.scene_id, wire_id=row.wire_id))
    return cells


def _load_pack_cells(db: Session, production_id: int) -> list[LavPackCell]:
    rows = db.query(LavPackAssignment).filter(LavPackAssignment.production_id == production_id).all()
    cells: list[LavPackCell] = []
    for row in rows:
        if row.user_id is not None:
            key = row_key_for_user(row.user_id)
        elif row.character_id is not None:
            key = row_key_for_character(row.character_id)
        else:
            continue
        cells.append(LavPackCell(row_key=key, scene_id=row.scene_id, pack_id=row.pack_id))
    return cells


def reject_wire_pack_conflicts(
    db: Session,
    production_id: int,
    wire_cells: list[LavWireCell],
    pack_cells: list[LavPackCell],
) -> str | None:
    """Return an error message if the same wire/pack is on two wearers in one scene."""
    scenes = _ordered_scenes(db, production_id)
    wearers = _build_wearers(db, production_id)
    issues = _validate_chart(wearers, scenes, wire_cells, pack_cells)
    conflicts = [issue for issue in issues if issue.code in ("wire_conflict", "pack_conflict")]
    if not conflicts:
        return None
    # Prefer a concrete message; callers surface this as HTTP 400 detail.
    return conflicts[0].message


def replace_wire_assignments(
    db: Session,
    production_id: int,
    cells: list[LavWireCell],
) -> None:
    db.query(LavWireAssignment).filter(LavWireAssignment.production_id == production_id).delete()
    for cell in cells:
        if cell.wire_id is None:
            continue
        user_id, character_id = parse_row_key(cell.row_key)
        db.add(
            LavWireAssignment(
                production_id=production_id,
                scene_id=cell.scene_id,
                user_id=user_id,
                character_id=character_id,
                wire_id=cell.wire_id,
            )
        )


def replace_pack_assignments(
    db: Session,
    production_id: int,
    cells: list[LavPackCell],
) -> None:
    db.query(LavPackAssignment).filter(LavPackAssignment.production_id == production_id).delete()
    for cell in cells:
        if cell.pack_id is None:
            continue
        user_id, character_id = parse_row_key(cell.row_key)
        db.add(
            LavPackAssignment(
                production_id=production_id,
                scene_id=cell.scene_id,
                user_id=user_id,
                character_id=character_id,
                pack_id=cell.pack_id,
            )
        )


def build_lav_chart_response(db: Session, production_id: int) -> LavChartResponse:
    scenes = _ordered_scenes(db, production_id)
    wearers = _build_wearers(db, production_id)
    wires = (
        db.query(Wire)
        .filter(Wire.production_id == production_id)
        .order_by(Wire.identifier)
        .all()
    )
    packs = (
        db.query(Pack)
        .filter(Pack.production_id == production_id)
        .order_by(Pack.identifier)
        .all()
    )
    wire_cells = _load_wire_cells(db, production_id)
    pack_cells = _load_pack_cells(db, production_id)
    locked_row_keys = _load_locked_row_keys(db, production_id)
    issues = _validate_chart(wearers, scenes, wire_cells, pack_cells)

    return LavChartResponse(
        scenes=[
            LavChartSceneColumn(
                id=s.id,
                act_id=s.act_id,
                act_number=s.act_number,
                act_title=s.act_title,
                scene_number=s.scene_number,
                scene_title=s.scene_title,
            )
            for s in scenes
        ],
        rows=[
            LavChartRow(
                row_key=w.row_key,
                user_id=w.user_id,
                character_id=w.character_id,
                label=w.label,
                character_ids=w.character_ids,
                character_names=w.character_names,
                need_scene_ids=sorted(w.need_scene_ids),
            )
            for w in wearers
        ],
        wires=[LavChartCatalogItem(id=w.id, identifier=w.identifier, notes=w.notes) for w in wires],
        packs=[LavChartCatalogItem(id=p.id, identifier=p.identifier, notes=p.notes) for p in packs],
        wire_cells=wire_cells,
        pack_cells=pack_cells,
        locked_row_keys=locked_row_keys,
        issues=issues,
        rules=list(LAV_CHART_RULES),
    )


def apply_propose(
    db: Session,
    production_id: int,
    sheets: list[str],
    *,
    preserve_filled_and_locked: bool = False,
) -> LavChartResponse:
    scenes = _ordered_scenes(db, production_id)
    wearers = _build_wearers(db, production_id)
    wires = (
        db.query(Wire)
        .filter(Wire.production_id == production_id)
        .order_by(Wire.identifier)
        .all()
    )
    packs = (
        db.query(Pack)
        .filter(Pack.production_id == production_id)
        .order_by(Pack.identifier)
        .all()
    )
    existing_wires = _load_wire_cells(db, production_id)
    existing_packs = _load_pack_cells(db, production_id)
    locked_row_keys = set(_load_locked_row_keys(db, production_id))
    proposed = propose_lav_chart(
        wearers,
        scenes,
        wires,
        packs,
        sheets=sheets,
        existing_wire_cells=existing_wires,
        existing_pack_cells=existing_packs,
        locked_row_keys=locked_row_keys,
        preserve_filled_and_locked=preserve_filled_and_locked,
    )
    sheet_set = {s.lower() for s in sheets}
    if "wires" in sheet_set:
        replace_wire_assignments(db, production_id, proposed.wire_cells)
    if "packs" in sheet_set:
        replace_pack_assignments(db, production_id, proposed.pack_cells)
    db.commit()
    return build_lav_chart_response(db, production_id)
