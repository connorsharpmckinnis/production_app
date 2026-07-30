"""Derive current prop / set piece state by walking on/off events in show order.

Unlike entrances and exits (which reset every scene), props and set pieces
are meant to stay "true" until someone changes them again — an iceberg
placed Downstage Left in Act 1 is still there in Act 2 unless a later
Moment turns it off or moves it. So instead of storing "is this prop on
stage right now" directly, we store on/off events and walk the whole show
in order to figure out the current state at any point.

Mirrors the shape of app/services/on_stage.py, but on_stage.py resets at
scene boundaries and this module deliberately does not.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import (
    Act,
    Moment,
    MomentCostumeEvent,
    MomentPropEvent,
    MomentSetPieceEvent,
    Scene,
)


@dataclass
class AssetStateSnapshot:
    """Where a single prop or set piece stands after some Moment in the show."""

    in_play: bool
    character_id: int | None = None
    user_id: int | None = None
    notes: str | None = None
    # Kind of the event that produced this snapshot, mostly useful for display.
    last_kind: str | None = None
    # Moment that last set this snapshot (last non-OFF for in-play items).
    source_moment_id: int | None = None
    source_scene_id: int | None = None


@dataclass(frozen=True)
class AssetMomentRef:
    """Pointer to a Moment that touched an asset (for deep links)."""

    moment_id: int
    scene_id: int


def load_production_moments_in_show_order(db: Session, production_id: int) -> list[Moment]:
    """Load every Moment in a production in Act → Scene → sequence order.

    This is the "whole show" order that prop/set piece state is derived
    against, as opposed to the scene-only order on_stage.py uses.
    """
    return (
        db.query(Moment)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(Act.sort_order, Scene.sort_order, Moment.sequence_number)
        .all()
    )


def _apply_event(
    state_by_asset_id: dict[int, AssetStateSnapshot],
    asset_id: int,
    kind: str,
    character_id: int | None,
    user_id: int | None,
    notes: str | None,
    *,
    moment_id: int,
    scene_id: int,
) -> None:
    if kind == "on":
        # A repeat "on" while already on is allowed and simply overwrites the
        # person/notes — this is how a handoff or a move is recorded without
        # needing a richer event vocabulary. Future MOVE (etc.) should also
        # update source_* the same way; only OFF clears in_play.
        state_by_asset_id[asset_id] = AssetStateSnapshot(
            in_play=True,
            character_id=character_id,
            user_id=user_id,
            notes=notes,
            last_kind="on",
            source_moment_id=moment_id,
            source_scene_id=scene_id,
        )
    else:
        # "off" clears who was holding it, but keeps the off note (e.g. "tuck
        # under the ship") available for anyone looking at this exact event.
        state_by_asset_id[asset_id] = AssetStateSnapshot(
            in_play=False,
            character_id=None,
            user_id=None,
            notes=notes,
            last_kind="off",
            source_moment_id=moment_id,
            source_scene_id=scene_id,
        )


def compute_prop_state_by_moment(
    moments: list[Moment],
    events_by_moment_id: dict[int, list[MomentPropEvent]],
) -> dict[int, dict[int, AssetStateSnapshot]]:
    """Walk moments in show order, snapshotting prop state after each one.

    Returns {moment_id: {prop_id: AssetStateSnapshot}}. A prop's snapshot at
    moment M reflects every event up to and including M's own events, and
    that same snapshot is what later moments inherit until the next event
    for that prop (no scene/act reset).
    """
    state_by_prop_id: dict[int, AssetStateSnapshot] = {}
    result: dict[int, dict[int, AssetStateSnapshot]] = {}

    for moment in moments:
        for event in events_by_moment_id.get(moment.id, []):
            _apply_event(
                state_by_prop_id,
                event.prop_id,
                event.kind,
                event.character_id,
                event.user_id,
                event.notes,
                moment_id=moment.id,
                scene_id=moment.scene_id,
            )
        # Copy so later mutation of state_by_prop_id doesn't rewrite history.
        result[moment.id] = dict(state_by_prop_id)

    return result


def compute_set_piece_state_by_moment(
    moments: list[Moment],
    events_by_moment_id: dict[int, list[MomentSetPieceEvent]],
) -> dict[int, dict[int, AssetStateSnapshot]]:
    """Same derivation as compute_prop_state_by_moment, for set pieces."""
    state_by_set_piece_id: dict[int, AssetStateSnapshot] = {}
    result: dict[int, dict[int, AssetStateSnapshot]] = {}

    for moment in moments:
        for event in events_by_moment_id.get(moment.id, []):
            _apply_event(
                state_by_set_piece_id,
                event.set_piece_id,
                event.kind,
                event.character_id,
                event.user_id,
                event.notes,
                moment_id=moment.id,
                scene_id=moment.scene_id,
            )
        result[moment.id] = dict(state_by_set_piece_id)

    return result


def find_next_asset_event_refs(
    moments: list[Moment],
    events_by_moment_id: dict[int, list],
    *,
    current_moment_id: int,
    asset_ids: set[int],
    asset_id_attr: str,
) -> dict[int, AssetMomentRef]:
    """For each asset, find the first Moment after current that has any event for it.

    Used for in-play "next change" deep links (next ON, OFF, or future MOVE).
    Assets with no later event are omitted.
    """
    if not asset_ids:
        return {}

    start_index: int | None = None
    for index, moment in enumerate(moments):
        if moment.id == current_moment_id:
            start_index = index
            break
    if start_index is None:
        return {}

    remaining = set(asset_ids)
    result: dict[int, AssetMomentRef] = {}
    for moment in moments[start_index + 1 :]:
        if not remaining:
            break
        for event in events_by_moment_id.get(moment.id, []):
            asset_id = getattr(event, asset_id_attr)
            if asset_id not in remaining:
                continue
            result[asset_id] = AssetMomentRef(
                moment_id=moment.id,
                scene_id=moment.scene_id,
            )
            remaining.discard(asset_id)
    return result


def group_prop_events_by_moment_id(
    db: Session, production_id: int
) -> dict[int, list[MomentPropEvent]]:
    events = (
        db.query(MomentPropEvent)
        .join(Moment, MomentPropEvent.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(MomentPropEvent.id)
        .all()
    )
    by_moment_id: dict[int, list[MomentPropEvent]] = {}
    for event in events:
        by_moment_id.setdefault(event.moment_id, []).append(event)
    return by_moment_id


def group_set_piece_events_by_moment_id(
    db: Session, production_id: int
) -> dict[int, list[MomentSetPieceEvent]]:
    events = (
        db.query(MomentSetPieceEvent)
        .join(Moment, MomentSetPieceEvent.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(MomentSetPieceEvent.id)
        .all()
    )
    by_moment_id: dict[int, list[MomentSetPieceEvent]] = {}
    for event in events:
        by_moment_id.setdefault(event.moment_id, []).append(event)
    return by_moment_id


def prop_states_at_moment(
    db: Session, production_id: int, moment_id: int
) -> dict[int, AssetStateSnapshot]:
    """Return current prop states (prop_id -> snapshot) as of the given Moment."""
    moments = load_production_moments_in_show_order(db, production_id)
    events_by_moment_id = group_prop_events_by_moment_id(db, production_id)
    states_by_moment_id = compute_prop_state_by_moment(moments, events_by_moment_id)
    return states_by_moment_id.get(moment_id, {})


def set_piece_states_at_moment(
    db: Session, production_id: int, moment_id: int
) -> dict[int, AssetStateSnapshot]:
    """Return current set piece states (set_piece_id -> snapshot) as of the given Moment."""
    moments = load_production_moments_in_show_order(db, production_id)
    events_by_moment_id = group_set_piece_events_by_moment_id(db, production_id)
    states_by_moment_id = compute_set_piece_state_by_moment(moments, events_by_moment_id)
    return states_by_moment_id.get(moment_id, {})


def in_play_asset_ids_by_moment(
    states_by_moment_id: dict[int, dict[int, AssetStateSnapshot]],
) -> dict[int, set[int]]:
    """Collapse full snapshots down to just the asset IDs in play after each moment.

    Handy for Timeline badges/filters that only need "is X currently on
    stage" rather than the full person/notes detail.
    """
    return {
        moment_id: {
            asset_id for asset_id, state in states.items() if state.in_play
        }
        for moment_id, states in states_by_moment_id.items()
    }


@dataclass
class CostumeWearingSnapshot:
    """What a single character is wearing after some Moment in the show.

    Keyed by character_id rather than by costume_id — unlike props/set
    pieces, costume events track a single wearer's outfit over time, not an
    asset's location. costume_name is left for the caller (API layer) to
    fill in from the catalog since this module doesn't do joins.
    """

    costume_id: int | None
    costume_name: str | None = None
    notes: str | None = None
    last_kind: str | None = None


def compute_costume_state_by_moment(
    moments: list[Moment],
    events_by_moment_id: dict[int, list[MomentCostumeEvent]],
) -> dict[int, dict[int, CostumeWearingSnapshot]]:
    """Walk moments in show order, snapshotting who's wearing what after each one.

    Returns {moment_id: {character_id: CostumeWearingSnapshot}}. A character's
    snapshot at moment M reflects every costume event up to and including M's
    own events, and persists (across scenes/acts, same as props) until the
    next event for that character — "off" clears them back to not wearing
    anything rather than resetting at a scene boundary.
    """
    state_by_character_id: dict[int, CostumeWearingSnapshot] = {}
    result: dict[int, dict[int, CostumeWearingSnapshot]] = {}

    for moment in moments:
        for event in events_by_moment_id.get(moment.id, []):
            if event.kind == "on":
                state_by_character_id[event.character_id] = CostumeWearingSnapshot(
                    costume_id=event.costume_id,
                    notes=event.notes,
                    last_kind="on",
                )
            else:
                state_by_character_id[event.character_id] = CostumeWearingSnapshot(
                    costume_id=None,
                    notes=event.notes,
                    last_kind="off",
                )
        result[moment.id] = dict(state_by_character_id)

    return result


def _group_costume_events_by_moment_id(
    db: Session, production_id: int
) -> dict[int, list[MomentCostumeEvent]]:
    events = (
        db.query(MomentCostumeEvent)
        .join(Moment, MomentCostumeEvent.moment_id == Moment.id)
        .join(Scene, Moment.scene_id == Scene.id)
        .join(Act, Scene.act_id == Act.id)
        .filter(Act.production_id == production_id)
        .order_by(MomentCostumeEvent.id)
        .all()
    )
    by_moment_id: dict[int, list[MomentCostumeEvent]] = {}
    for event in events:
        by_moment_id.setdefault(event.moment_id, []).append(event)
    return by_moment_id


def costume_states_at_moment(
    db: Session, production_id: int, moment_id: int
) -> dict[int, CostumeWearingSnapshot]:
    """Return current costume states (character_id -> snapshot) as of the given Moment."""
    moments = load_production_moments_in_show_order(db, production_id)
    events_by_moment_id = _group_costume_events_by_moment_id(db, production_id)
    states_by_moment_id = compute_costume_state_by_moment(moments, events_by_moment_id)
    return states_by_moment_id.get(moment_id, {})
