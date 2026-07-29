"""Phase 14 WP2 tests: prop / set piece on-off derivation.

Two layers, per the development guide's testing philosophy:

1. Pure unit tests against app.services.asset_state's derivation functions,
   using lightweight stand-ins for Moment/Event rows (fast, no DB needed).
2. One end-to-end API test proving the same behavior through
   POST .../props (and .../set-pieces) plus GET moment detail, across
   scenes and acts in an imported production.
"""

from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Production
from app.services.asset_state import (
    compute_costume_state_by_moment,
    compute_prop_state_by_moment,
    compute_set_piece_state_by_moment,
)
from app.services.importer import import_script

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-full-cleaned.md"
)


def _moment(moment_id: int) -> SimpleNamespace:
    return SimpleNamespace(id=moment_id)


def _event(
    *,
    asset_id_field: str,
    asset_id: int,
    kind: str,
    character_id: int | None = None,
    user_id: int | None = None,
    notes: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        **{asset_id_field: asset_id},
        kind=kind,
        character_id=character_id,
        user_id=user_id,
        notes=notes,
    )


def _prop_event(prop_id: int, kind: str, **kwargs) -> SimpleNamespace:
    return _event(asset_id_field="prop_id", asset_id=prop_id, kind=kind, **kwargs)


def _set_piece_event(set_piece_id: int, kind: str, **kwargs) -> SimpleNamespace:
    return _event(asset_id_field="set_piece_id", asset_id=set_piece_id, kind=kind, **kwargs)


def _costume_event(
    character_id: int,
    kind: str,
    *,
    costume_id: int | None = None,
    notes: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        character_id=character_id,
        kind=kind,
        costume_id=costume_id,
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Unit tests: pure derivation logic, no database.
# ---------------------------------------------------------------------------


def test_prop_on_persists_across_moments_until_next_event() -> None:
    """Iceberg ON at M1 stays in play with the same person/notes at M2 and M3."""
    moments = [_moment(1), _moment(2), _moment(3)]
    events_by_moment_id = {
        1: [_prop_event(100, "on", character_id=7, notes="Downstage Left")],
    }

    states_by_moment = compute_prop_state_by_moment(moments, events_by_moment_id)

    for moment_id in (1, 2, 3):
        state = states_by_moment[moment_id][100]
        assert state.in_play is True
        assert state.character_id == 7
        assert state.user_id is None
        assert state.notes == "Downstage Left"


def test_start_state_is_off_with_no_events() -> None:
    """Before any event, a prop simply doesn't show up as in-play."""
    moments = [_moment(1), _moment(2)]

    states_by_moment = compute_prop_state_by_moment(moments, events_by_moment_id={})

    assert states_by_moment[1] == {}
    assert states_by_moment[2] == {}


def test_re_on_while_already_on_updates_person_and_notes() -> None:
    """A second ON (move / handoff) overwrites person and notes in place."""
    moments = [_moment(1), _moment(2), _moment(3)]
    events_by_moment_id = {
        1: [_prop_event(100, "on", character_id=7, notes="Downstage Left")],
        3: [_prop_event(100, "on", character_id=9, notes="Upstage Right")],
    }

    states_by_moment = compute_prop_state_by_moment(moments, events_by_moment_id)

    assert states_by_moment[2][100].character_id == 7
    assert states_by_moment[2][100].notes == "Downstage Left"

    after_move = states_by_moment[3][100]
    assert after_move.in_play is True
    assert after_move.character_id == 9
    assert after_move.user_id is None
    assert after_move.notes == "Upstage Right"


def test_off_clears_in_play_and_person() -> None:
    """OFF takes the prop out of play and clears who was holding it."""
    moments = [_moment(1), _moment(2), _moment(3)]
    events_by_moment_id = {
        1: [_prop_event(100, "on", character_id=7, notes="Downstage Left")],
        2: [_prop_event(100, "off", notes="Tuck under the ship")],
    }

    states_by_moment = compute_prop_state_by_moment(moments, events_by_moment_id)

    off_state = states_by_moment[2][100]
    assert off_state.in_play is False
    assert off_state.character_id is None
    assert off_state.user_id is None
    assert off_state.notes == "Tuck under the ship"

    # State persists (still off) into the next moment, same as being on would.
    still_off = states_by_moment[3][100]
    assert still_off.in_play is False


def test_set_piece_state_persists_across_moments_same_as_props() -> None:
    """Set pieces use the exact same derivation as props."""
    moments = [_moment(1), _moment(2), _moment(3)]
    events_by_moment_id = {
        1: [_set_piece_event(200, "on", user_id=3, notes="Center stage")],
        3: [_set_piece_event(200, "off")],
    }

    states_by_moment = compute_set_piece_state_by_moment(moments, events_by_moment_id)

    assert states_by_moment[2][200].in_play is True
    assert states_by_moment[2][200].user_id == 3

    assert states_by_moment[3][200].in_play is False
    assert states_by_moment[3][200].user_id is None


def test_unrelated_assets_do_not_interfere() -> None:
    """Turning one prop on/off should not touch another prop's state."""
    moments = [_moment(1), _moment(2)]
    events_by_moment_id = {
        1: [
            _prop_event(100, "on", notes="Prop A on"),
            _prop_event(101, "on", notes="Prop B on"),
        ],
        2: [_prop_event(100, "off")],
    }

    states_by_moment = compute_prop_state_by_moment(moments, events_by_moment_id)

    assert states_by_moment[2][100].in_play is False
    assert states_by_moment[2][101].in_play is True
    assert states_by_moment[2][101].notes == "Prop B on"


def test_costume_on_persists_across_moments_until_next_event() -> None:
    """A character wearing a costume at M1 is still wearing it at M2 and M3."""
    moments = [_moment(1), _moment(2), _moment(3)]
    events_by_moment_id = {
        1: [_costume_event(7, "on", costume_id=50, notes="Opening look")],
    }

    states_by_moment = compute_costume_state_by_moment(moments, events_by_moment_id)

    for moment_id in (1, 2, 3):
        state = states_by_moment[moment_id][7]
        assert state.costume_id == 50
        assert state.notes == "Opening look"
        assert state.last_kind == "on"


def test_costume_off_clears_wearing() -> None:
    """OFF clears what a character is wearing, and the clear persists forward."""
    moments = [_moment(1), _moment(2), _moment(3)]
    events_by_moment_id = {
        1: [_costume_event(7, "on", costume_id=50, notes="Opening look")],
        2: [_costume_event(7, "off", notes="Quick change booth")],
    }

    states_by_moment = compute_costume_state_by_moment(moments, events_by_moment_id)

    off_state = states_by_moment[2][7]
    assert off_state.costume_id is None
    assert off_state.last_kind == "off"

    still_off = states_by_moment[3][7]
    assert still_off.costume_id is None


def test_costume_re_on_changes_costume() -> None:
    """A second ON (outfit change) overwrites the costume and notes in place."""
    moments = [_moment(1), _moment(2), _moment(3)]
    events_by_moment_id = {
        1: [_costume_event(7, "on", costume_id=50, notes="Opening look")],
        3: [_costume_event(7, "on", costume_id=51, notes="Finale look")],
    }

    states_by_moment = compute_costume_state_by_moment(moments, events_by_moment_id)

    assert states_by_moment[2][7].costume_id == 50

    changed = states_by_moment[3][7]
    assert changed.costume_id == 51
    assert changed.notes == "Finale look"


def test_costume_unrelated_characters_do_not_interfere() -> None:
    """One character's costume change should not touch another character's."""
    moments = [_moment(1), _moment(2)]
    events_by_moment_id = {
        1: [
            _costume_event(7, "on", costume_id=50, notes="Character A on"),
            _costume_event(8, "on", costume_id=51, notes="Character B on"),
        ],
        2: [_costume_event(7, "off")],
    }

    states_by_moment = compute_costume_state_by_moment(moments, events_by_moment_id)

    assert states_by_moment[2][7].costume_id is None
    assert states_by_moment[2][8].costume_id == 51
    assert states_by_moment[2][8].notes == "Character B on"


# ---------------------------------------------------------------------------
# API integration test: real production spanning two acts.
# ---------------------------------------------------------------------------


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database(db_session, test_settings)
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _imported_production(client: TestClient, db_session: Session) -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "Endurance Full", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    content = FIXTURE_PATH.read_text(encoding="utf-8")
    import_script(db_session, production, content)
    return production_id


def _character_id_by_name(
    client: TestClient, production_id: int, name: str, headers: dict[str, str]
) -> int:
    characters = client.get(
        f"/api/productions/{production_id}/characters", headers=headers
    ).json()
    return next(character["id"] for character in characters if character["name"] == name)


def _first_moment_id(
    client: TestClient, production_id: int, scene_id: int, headers: dict[str, str]
) -> int:
    moments = client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=headers,
    ).json()
    return moments[0]["id"]


def test_prop_event_persists_across_scenes_and_acts_via_api(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", headers)
    worsley_id = _character_id_by_name(seeded_client, production_id, "WORSLEY", headers)

    acts = seeded_client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    assert len(acts) >= 2, "fixture should have two acts for cross-act coverage"

    act1_scene1_id = acts[0]["scenes"][0]["id"]
    act1_scene2_id = acts[0]["scenes"][1]["id"]
    act2_scene1_id = acts[1]["scenes"][0]["id"]

    turn_on_moment_id = _first_moment_id(seeded_client, production_id, act1_scene1_id, headers)
    later_same_act_moment_id = _first_moment_id(
        seeded_client, production_id, act1_scene2_id, headers
    )
    next_act_moment_id = _first_moment_id(seeded_client, production_id, act2_scene1_id, headers)

    prop = seeded_client.post(
        f"/api/productions/{production_id}/props",
        json={"name": "Iceberg"},
        headers=headers,
    ).json()

    turned_on = seeded_client.post(
        f"/api/productions/{production_id}/moments/{turn_on_moment_id}/props",
        json={
            "prop_id": prop["id"],
            "kind": "on",
            "character_id": crean_id,
            "notes": "Downstage Left",
        },
        headers=headers,
    )
    assert turned_on.status_code == 201
    assert turned_on.json()["kind"] == "on"
    assert turned_on.json()["character_name"] == "CREAN"

    # Later in the same act, and in the next act entirely, the prop should
    # still read as in play with the same person/notes — no scene/act reset.
    for moment_id in (later_same_act_moment_id, next_act_moment_id):
        detail = seeded_client.get(
            f"/api/productions/{production_id}/moments/{moment_id}",
            headers=headers,
        ).json()
        in_play = next(
            item for item in detail["props_in_play"] if item["prop_id"] == prop["id"]
        )
        assert in_play["character_name"] == "CREAN"
        assert in_play["notes"] == "Downstage Left"

    # Re-ON in Act Two moves it to a new person and new notes.
    moved = seeded_client.post(
        f"/api/productions/{production_id}/moments/{next_act_moment_id}/props",
        json={
            "prop_id": prop["id"],
            "kind": "on",
            "character_id": worsley_id,
            "notes": "Upstage Right",
        },
        headers=headers,
    )
    assert moved.status_code == 201

    moved_detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{next_act_moment_id}",
        headers=headers,
    ).json()
    moved_state = next(
        item for item in moved_detail["props_in_play"] if item["prop_id"] == prop["id"]
    )
    assert moved_state["character_name"] == "WORSLEY"
    assert moved_state["notes"] == "Upstage Right"

    # A later moment in Act Two, past the move, still shows the moved state.
    act2_scenes = acts[1]["scenes"]
    if len(act2_scenes) > 1:
        later_act2_moment_id = _first_moment_id(
            seeded_client, production_id, act2_scenes[1]["id"], headers
        )
        still_moved_detail = seeded_client.get(
            f"/api/productions/{production_id}/moments/{later_act2_moment_id}",
            headers=headers,
        ).json()
        still_moved_state = next(
            item
            for item in still_moved_detail["props_in_play"]
            if item["prop_id"] == prop["id"]
        )
        assert still_moved_state["character_name"] == "WORSLEY"

        # OFF clears it from the in-play list from that point forward.
        turned_off = seeded_client.post(
            f"/api/productions/{production_id}/moments/{later_act2_moment_id}/props",
            json={"prop_id": prop["id"], "kind": "off", "notes": "Struck"},
            headers=headers,
        )
        assert turned_off.status_code == 201

        off_detail = seeded_client.get(
            f"/api/productions/{production_id}/moments/{later_act2_moment_id}",
            headers=headers,
        ).json()
        assert all(
            item["prop_id"] != prop["id"] for item in off_detail["props_in_play"]
        )


def test_moment_prop_event_duplicate_rejected_and_patch_replaces_state(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", headers)
    acts = seeded_client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    moment_id = _first_moment_id(
        seeded_client, production_id, acts[0]["scenes"][0]["id"], headers
    )

    prop = seeded_client.post(
        f"/api/productions/{production_id}/props",
        json={"name": "Compass"},
        headers=headers,
    ).json()

    first = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment_id}/props",
        json={"prop_id": prop["id"], "kind": "on", "notes": "In pocket"},
        headers=headers,
    )
    assert first.status_code == 201
    event_id = first.json()["id"]

    duplicate = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment_id}/props",
        json={"prop_id": prop["id"], "kind": "off"},
        headers=headers,
    )
    assert duplicate.status_code == 409

    patched = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment_id}/props/{event_id}",
        json={"kind": "on", "character_id": crean_id, "notes": "Handed to Crean"},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["character_name"] == "CREAN"
    assert patched.json()["notes"] == "Handed to Crean"

    rejected = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment_id}/props",
        json={
            "prop_id": prop["id"],
            "kind": "on",
            "character_id": crean_id,
            "user_id": 1,
        },
        headers=headers,
    )
    assert rejected.status_code == 422


def test_set_piece_event_persists_across_scenes_via_api(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", headers)
    acts = seeded_client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    scene1_id = acts[0]["scenes"][0]["id"]
    scene2_id = acts[0]["scenes"][1]["id"]
    on_moment_id = _first_moment_id(seeded_client, production_id, scene1_id, headers)
    later_moment_id = _first_moment_id(seeded_client, production_id, scene2_id, headers)

    set_piece = seeded_client.post(
        f"/api/productions/{production_id}/set-pieces",
        json={"name": "Ship's wheel", "mobile": False},
        headers=headers,
    ).json()

    on_response = seeded_client.post(
        f"/api/productions/{production_id}/moments/{on_moment_id}/set-pieces",
        json={
            "set_piece_id": set_piece["id"],
            "kind": "on",
            "character_id": crean_id,
            "notes": "Center stage",
        },
        headers=headers,
    )
    assert on_response.status_code == 201

    later_detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{later_moment_id}",
        headers=headers,
    ).json()
    in_play = next(
        item
        for item in later_detail["set_pieces_in_play"]
        if item["set_piece_id"] == set_piece["id"]
    )
    assert in_play["character_name"] == "CREAN"
    assert in_play["notes"] == "Center stage"


def test_costume_event_persists_across_scenes_via_api(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", headers)

    acts = seeded_client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    scene1_id = acts[0]["scenes"][0]["id"]
    scene2_id = acts[0]["scenes"][1]["id"]
    on_moment_id = _first_moment_id(seeded_client, production_id, scene1_id, headers)
    later_moment_id = _first_moment_id(seeded_client, production_id, scene2_id, headers)

    costume = seeded_client.post(
        f"/api/productions/{production_id}/costumes",
        json={"character_id": crean_id, "name": "Parka"},
        headers=headers,
    ).json()

    on_response = seeded_client.post(
        f"/api/productions/{production_id}/moments/{on_moment_id}/costumes",
        json={
            "character_id": crean_id,
            "kind": "on",
            "costume_id": costume["id"],
            "notes": "Opening look",
        },
        headers=headers,
    )
    assert on_response.status_code == 201
    assert on_response.json()["character_name"] == "CREAN"
    assert on_response.json()["costume_name"] == "Parka"

    later_detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{later_moment_id}",
        headers=headers,
    ).json()
    wearing = next(
        item
        for item in later_detail["costumes_wearing"]
        if item["character_id"] == crean_id
    )
    assert wearing["costume_name"] == "Parka"
    assert wearing["notes"] == "Opening look"

    off_response = seeded_client.post(
        f"/api/productions/{production_id}/moments/{later_moment_id}/costumes",
        json={"character_id": crean_id, "kind": "off"},
        headers=headers,
    )
    assert off_response.status_code == 201

    later_scenes = acts[0]["scenes"]
    if len(later_scenes) > 2:
        after_off_moment_id = _first_moment_id(
            seeded_client, production_id, later_scenes[2]["id"], headers
        )
        after_off_detail = seeded_client.get(
            f"/api/productions/{production_id}/moments/{after_off_moment_id}",
            headers=headers,
        ).json()
        assert all(
            item["character_id"] != crean_id
            for item in after_off_detail["costumes_wearing"]
        )


def test_moment_costume_event_duplicate_rejected_and_on_requires_costume(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    headers = _login(seeded_client, "director", "director")
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", headers)
    acts = seeded_client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    moment_id = _first_moment_id(
        seeded_client, production_id, acts[0]["scenes"][0]["id"], headers
    )

    costume = seeded_client.post(
        f"/api/productions/{production_id}/costumes",
        json={"character_id": crean_id, "name": "Expedition Kit"},
        headers=headers,
    ).json()

    missing_costume = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment_id}/costumes",
        json={"character_id": crean_id, "kind": "on"},
        headers=headers,
    )
    assert missing_costume.status_code == 422

    first = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment_id}/costumes",
        json={"character_id": crean_id, "kind": "on", "costume_id": costume["id"]},
        headers=headers,
    )
    assert first.status_code == 201
    event_id = first.json()["id"]

    duplicate = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moment_id}/costumes",
        json={"character_id": crean_id, "kind": "off"},
        headers=headers,
    )
    assert duplicate.status_code == 409

    patched = seeded_client.patch(
        f"/api/productions/{production_id}/moments/{moment_id}/costumes/{event_id}",
        json={"kind": "off"},
        headers=headers,
    )
    assert patched.status_code == 200
    assert patched.json()["costume_id"] is None
