"""Phase 8 WP0/WP1/WP2: mic notes, readiness, and Overview messages."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.encouragement_defaults import (
    DEFAULT_ENCOURAGEMENT_MESSAGES,
    ENCOURAGEMENT_BANDS,
    readiness_band,
)
from app.db.seed import seed_database
from app.models import (
    Act,
    AppRole,
    Character,
    Moment,
    MomentType,
    Production,
    Scene,
    User,
    UserAppRole,
)
from app.services.importer import import_script
from app.services.importer.builtins import BUILTIN_CHARACTER_NAMES
from app.services.readiness import SOFT_COVERAGE_WEIGHT, SOFT_SEEDED_WEIGHT, compute_readiness

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database(db_session, test_settings)
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _imported_production(client: TestClient, db_session: Session, title: str = "Endurance Phase 8") -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": title, "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    content = FIXTURE_PATH.read_text(encoding="utf-8")
    import_script(db_session, production, content)
    return production_id


def _empty_production(client: TestClient) -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "Empty Show", "season": "2026"},
        headers=headers,
    )
    return create.json()["id"]


def _character_id_by_name(
    client: TestClient, production_id: int, name: str, headers: dict[str, str]
) -> int:
    characters = client.get(
        f"/api/productions/{production_id}/characters", headers=headers
    ).json()
    return next(character["id"] for character in characters if character["name"] == name)


def _first_scene_id(client: TestClient, production_id: int, headers: dict[str, str]) -> int:
    acts = client.get(f"/api/productions/{production_id}/acts", headers=headers).json()
    return acts[0]["scenes"][0]["id"]


def _dimension(overview: dict, key: str) -> dict:
    return next(item for item in overview["dimensions"] if item["key"] == key)


def test_overview_empty_production_readiness_zero(seeded_client: TestClient) -> None:
    production_id = _empty_production(seeded_client)
    director_headers = _login(seeded_client, "director", "director")

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    )
    assert overview.status_code == 200
    data = overview.json()
    assert data["act_count"] == 0
    assert data["readiness_percent"] == 0
    assert data["dimensions"] == []
    assert data["readiness_band"] == "0"
    assert data["rotation_seconds"] == 20
    assert len(data["spotlight"]) == 7
    assert data["spotlight"][0]["kind"] == "encouragement"
    assert data["spotlight"][0]["source"] == "global"
    assert "Blank stage" in data["spotlight"][0]["body"]
    bodies = [item["body"] for item in data["spotlight"]]
    assert len(bodies) == len(set(bodies))


def test_overview_imported_readiness_shape(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director_headers = _login(seeded_client, "director", "director")

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    )
    assert overview.status_code == 200
    data = overview.json()
    assert data["act_count"] >= 1
    assert isinstance(data["readiness_percent"], int)
    assert 0 <= data["readiness_percent"] <= 100

    keys = [dimension["key"] for dimension in data["dimensions"]]
    assert keys == [
        "casting",
        "costumes",
        "cues",
        "props",
        "lav_chart",
        "set_pieces",
        "entrances_exits",
        "blocking",
    ]
    for dimension in data["dimensions"]:
        assert "label" in dimension
        assert "summary" in dimension
        assert "href_hint" in dimension
        assert "gaps" in dimension
        assert dimension["score"] is None or 0 <= dimension["score"] <= 100


def test_overview_hides_readiness_from_actor_only_but_not_staff_or_mixed_roles(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Role Scoped Overview")
    director_headers = _login(seeded_client, "director", "director")
    actor = db_session.query(User).filter(User.username == "actor").one()
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)
    cast = seeded_client.put(
        f"/api/productions/{production_id}/characters/{crean_id}/cast",
        json={"user_id": actor.id},
        headers=director_headers,
    )
    assert cast.status_code == 200

    actor_headers = _login(seeded_client, "actor", "actor")

    actor_overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=actor_headers,
    )
    assert actor_overview.status_code == 200
    actor_data = actor_overview.json()
    assert actor_data["spotlight"]
    assert actor_data["readiness_band"]
    assert actor_data["readiness_percent"] is None
    assert actor_data["dimensions"] == []

    staff_data = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    assert isinstance(staff_data["readiness_percent"], int)
    assert staff_data["dimensions"]

    director_role = db_session.query(AppRole).filter(AppRole.name == "Director").one()
    db_session.add(UserAppRole(user_id=actor.id, app_role_id=director_role.id))
    db_session.commit()

    mixed_role_data = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=actor_headers,
    ).json()
    assert isinstance(mixed_role_data["readiness_percent"], int)
    assert mixed_role_data["dimensions"]


def test_casting_excludes_builtins_and_partial_cast(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Casting Readiness")
    director_headers = _login(seeded_client, "director", "director")
    actor = db_session.query(User).filter(User.username == "actor").one()
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)

    cast = seeded_client.put(
        f"/api/productions/{production_id}/characters/{crean_id}/cast",
        json={"user_id": actor.id},
        headers=director_headers,
    )
    assert cast.status_code == 200

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    casting = _dimension(overview, "casting")
    assert casting["score"] is not None
    assert casting["score"] < 100
    assert "CREAN" not in casting["gaps"]
    for builtin in BUILTIN_CHARACTER_NAMES:
        assert builtin not in casting["gaps"]

    characters = seeded_client.get(
        f"/api/productions/{production_id}/characters",
        headers=director_headers,
    ).json()
    castable_names = {
        character["name"]
        for character in characters
        if character["name"] not in BUILTIN_CHARACTER_NAMES
    }
    gap_names = set(casting["gaps"])
    assert gap_names.issubset(castable_names)
    assert "CREAN" not in gap_names


def test_costume_gaps_and_builtins_excluded(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Costume Readiness")
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)

    before = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    costumes_before = _dimension(before, "costumes")
    assert costumes_before["score"] == 0
    assert any("CREAN" in gap and "no costume" in gap for gap in costumes_before["gaps"])
    for builtin in BUILTIN_CHARACTER_NAMES:
        assert not any(gap.startswith(f"{builtin} ") for gap in costumes_before["gaps"])

    costume = seeded_client.post(
        f"/api/productions/{production_id}/costumes",
        json={"character_id": crean_id, "name": "Parka"},
        headers=director_headers,
    )
    assert costume.status_code == 201

    moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()
    crean_moment = next(
        moment
        for moment in moments
        if moment["moment_type"] == "dialogue"
        and crean_id in moment["speaking_character_ids"]
    )
    worn = seeded_client.post(
        f"/api/productions/{production_id}/moments/{crean_moment['id']}/costumes",
        json={"character_id": crean_id, "kind": "on", "costume_id": costume.json()["id"]},
        headers=director_headers,
    )
    assert worn.status_code == 201

    after = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    costumes_after = _dimension(after, "costumes")
    assert costumes_after["score"] is not None
    assert costumes_after["score"] > costumes_before["score"]
    assert not any(gap.startswith("CREAN ") for gap in costumes_after["gaps"])


def test_costume_na_when_no_speaking_pairs(seeded_client: TestClient, db_session: Session) -> None:
    """Acts/scenes without dialogue yield costume N/A (excluded from average)."""
    headers = _login(seeded_client, "admin", "admin")
    create = seeded_client.post(
        "/api/productions",
        json={"title": "Silent Scenes", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None

    act = Act(production_id=production_id, number=1, title="Act 1", sort_order=1)
    db_session.add(act)
    db_session.flush()
    scene = Scene(act_id=act.id, number=1, title="Quiet", sort_order=1)
    db_session.add(scene)
    db_session.flush()
    moment_type = db_session.query(MomentType).filter(MomentType.name == "stage_direction").one()
    db_session.add(
        Moment(
            scene_id=scene.id,
            sequence_number=1,
            moment_type_id=moment_type.id,
            original_text="*Silence.*",
            parsed_text="Silence.",
        )
    )
    db_session.add(Character(production_id=production_id, name="ALL"))
    db_session.commit()

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=_login(seeded_client, "director", "director"),
    ).json()
    costumes = _dimension(overview, "costumes")
    assert costumes["score"] is None
    assert "No speaking" in costumes["summary"]


def test_entrances_exits_require_both(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Entrance Exit Readiness")
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)
    moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()

    before = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    entrances_before = _dimension(before, "entrances_exits")
    assert entrances_before["score"] == 0

    seeded_client.post(
        f"/api/productions/{production_id}/moments/{moments[0]['id']}/entrances",
        json={"character_id": crean_id},
        headers=director_headers,
    )
    mid = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    assert _dimension(mid, "entrances_exits")["score"] == 0
    assert any("no exits" in gap for gap in _dimension(mid, "entrances_exits")["gaps"])

    seeded_client.post(
        f"/api/productions/{production_id}/moments/{moments[-1]['id']}/exits",
        json={"character_id": crean_id},
        headers=director_headers,
    )
    after = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    entrances_after = _dimension(after, "entrances_exits")
    assert entrances_after["score"] == 100
    assert entrances_after["gaps"] == []


def test_blocking_any_in_scene(seeded_client: TestClient, db_session: Session) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Blocking Readiness")
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    crean_id = _character_id_by_name(seeded_client, production_id, "CREAN", director_headers)
    moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()

    before = _dimension(
        seeded_client.get(
            f"/api/productions/{production_id}/overview",
            headers=director_headers,
        ).json(),
        "blocking",
    )
    assert before["score"] == 0

    seeded_client.post(
        f"/api/productions/{production_id}/moments/{moments[0]['id']}/blocking",
        json={"character_id": crean_id, "notes": "Cross DSL"},
        headers=director_headers,
    )
    after = _dimension(
        seeded_client.get(
            f"/api/productions/{production_id}/overview",
            headers=director_headers,
        ).json(),
        "blocking",
    )
    assert after["score"] == 100


def test_soft_dimension_seeded_plus_coverage_weights(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Soft Weights")
    director_headers = _login(seeded_client, "director", "director")
    scene_id = _first_scene_id(seeded_client, production_id, director_headers)
    moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director_headers,
    ).json()

    empty = _dimension(
        seeded_client.get(
            f"/api/productions/{production_id}/overview",
            headers=director_headers,
        ).json(),
        "props",
    )
    assert empty["score"] == 0

    prop = seeded_client.post(
        f"/api/productions/{production_id}/props",
        json={"name": "Sextant"},
        headers=director_headers,
    )
    assert prop.status_code == 201
    seeded_only = _dimension(
        seeded_client.get(
            f"/api/productions/{production_id}/overview",
            headers=director_headers,
        ).json(),
        "props",
    )
    assert seeded_only["score"] == SOFT_SEEDED_WEIGHT

    attach = seeded_client.post(
        f"/api/productions/{production_id}/moments/{moments[0]['id']}/props",
        json={"prop_id": prop.json()["id"], "kind": "on"},
        headers=director_headers,
    )
    assert attach.status_code == 201
    full = _dimension(
        seeded_client.get(
            f"/api/productions/{production_id}/overview",
            headers=director_headers,
        ).json(),
        "props",
    )
    assert full["score"] == SOFT_SEEDED_WEIGHT + SOFT_COVERAGE_WEIGHT


def test_compute_readiness_overall_averages_applicable_only(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session, title="Average Check")
    result = compute_readiness(db_session, production_id)
    scored = [dimension.score for dimension in result.dimensions if dimension.score is not None]
    assert scored
    assert result.readiness_percent == round(sum(scored) / len(scored))


def test_seed_encouragement_defaults(seeded_client: TestClient) -> None:
    headers = _login(seeded_client, "director", "director")
    response = seeded_client.get("/api/settings/overview-message-defaults", headers=headers)
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 7
    assert [message["band"] for message in messages] == list(ENCOURAGEMENT_BANDS)
    for message, expected in zip(messages, DEFAULT_ENCOURAGEMENT_MESSAGES, strict=True):
        assert message["body"] == expected["body"]
        assert message["active"] is True
        assert "kind" not in message


def test_readiness_band_mapping() -> None:
    assert readiness_band(None) == "0"
    assert readiness_band(0) == "0"
    assert readiness_band(1) == "1-24"
    assert readiness_band(24) == "1-24"
    assert readiness_band(25) == "25-49"
    assert readiness_band(50) == "50-74"
    assert readiness_band(75) == "75-89"
    assert readiness_band(90) == "90-99"
    assert readiness_band(99) == "90-99"
    assert readiness_band(100) == "100"


def test_global_defaults_replace_and_roles(seeded_client: TestClient) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")
    director_headers = _login(seeded_client, "director", "director")
    actor_headers = _login(seeded_client, "actor", "actor")

    forbidden = seeded_client.put(
        "/api/settings/overview-message-defaults",
        json={
            "messages": [
                {
                    "band": "0",
                    "body": "Director should not edit globals",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=director_headers,
    )
    assert forbidden.status_code == 403

    replaced = seeded_client.put(
        "/api/settings/overview-message-defaults",
        json={
            "messages": [
                {
                    "band": "0",
                    "title": None,
                    "body": "Custom empty-stage vibe",
                    "sort_order": 0,
                    "active": True,
                },
                {
                    "band": "100",
                    "body": "Custom complete vibe",
                    "sort_order": 1,
                    "active": True,
                },
            ]
        },
        headers=admin_headers,
    )
    assert replaced.status_code == 200
    assert len(replaced.json()) == 2
    assert replaced.json()[0]["body"] == "Custom empty-stage vibe"

    actor_read = seeded_client.get(
        "/api/settings/overview-message-defaults",
        headers=actor_headers,
    )
    assert actor_read.status_code == 200
    assert len(actor_read.json()) == 2


def test_overview_falls_back_to_global_encouragement(seeded_client: TestClient) -> None:
    production_id = _empty_production(seeded_client)
    admin_headers = _login(seeded_client, "admin", "admin")
    director_headers = _login(seeded_client, "director", "director")

    seeded_client.put(
        "/api/settings/overview-message-defaults",
        json={
            "messages": [
                {
                    "band": "0",
                    "body": "Global band zero",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=admin_headers,
    )

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    assert overview["spotlight"][0]["body"] == "Global band zero"
    assert overview["spotlight"][0]["source"] == "global"


def test_production_encouragement_overrides_global_for_band(
    seeded_client: TestClient,
) -> None:
    production_id = _empty_production(seeded_client)
    director_headers = _login(seeded_client, "director", "director")

    replaced = seeded_client.put(
        f"/api/productions/{production_id}/overview-messages",
        json={
            "messages": [
                {
                    "kind": "encouragement",
                    "band": "0",
                    "body": "Show-specific empty stage",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=director_headers,
    )
    assert replaced.status_code == 200

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    assert len(overview["spotlight"]) == 1
    assert overview["spotlight"][0]["body"] == "Show-specific empty stage"
    assert overview["spotlight"][0]["source"] == "production"


def test_spotlight_ordering_announcement_scripture_encouragement(
    seeded_client: TestClient,
) -> None:
    production_id = _empty_production(seeded_client)
    director_headers = _login(seeded_client, "director", "director")

    seeded_client.put(
        f"/api/productions/{production_id}/overview-messages",
        json={
            "messages": [
                {
                    "kind": "encouragement",
                    "band": "0",
                    "body": "Encouragement last",
                    "sort_order": 0,
                    "active": True,
                },
                {
                    "kind": "scripture",
                    "title": "Philippians 4:13",
                    "body": "I can do all things...",
                    "sort_order": 1,
                    "active": True,
                },
                {
                    "kind": "announcement",
                    "body": "Book table after Sunday",
                    "sort_order": 2,
                    "active": True,
                },
                {
                    "kind": "announcement",
                    "body": "Inactive announcement",
                    "sort_order": 3,
                    "active": False,
                },
            ]
        },
        headers=director_headers,
    )

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    kinds = [item["kind"] for item in overview["spotlight"]]
    bodies = [item["body"] for item in overview["spotlight"]]
    assert kinds == ["announcement", "scripture", "encouragement"]
    assert bodies == [
        "Book table after Sunday",
        "I can do all things...",
        "Encouragement last",
    ]
    assert "Inactive announcement" not in bodies


def test_production_message_validation(seeded_client: TestClient) -> None:
    production_id = _empty_production(seeded_client)
    director_headers = _login(seeded_client, "director", "director")

    # Encouragement no longer requires a readiness band.
    no_band = seeded_client.put(
        f"/api/productions/{production_id}/overview-messages",
        json={
            "messages": [
                {
                    "kind": "encouragement",
                    "body": "Band optional now",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=director_headers,
    )
    assert no_band.status_code == 200

    bad_band = seeded_client.put(
        f"/api/productions/{production_id}/overview-messages",
        json={
            "messages": [
                {
                    "kind": "encouragement",
                    "band": "101",
                    "body": "Bad band",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=director_headers,
    )
    assert bad_band.status_code == 422

    scripture_with_band = seeded_client.put(
        f"/api/productions/{production_id}/overview-messages",
        json={
            "messages": [
                {
                    "kind": "scripture",
                    "band": "0",
                    "body": "Should not have band",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=director_headers,
    )
    assert scripture_with_band.status_code == 422

    announcement_with_band = seeded_client.put(
        f"/api/productions/{production_id}/overview-messages",
        json={
            "messages": [
                {
                    "kind": "announcement",
                    "band": "50-74",
                    "body": "Should not have band",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=director_headers,
    )
    assert announcement_with_band.status_code == 422


def test_production_message_roles(seeded_client: TestClient) -> None:
    production_id = _empty_production(seeded_client)
    actor_headers = _login(seeded_client, "actor", "actor")
    director_headers = _login(seeded_client, "director", "director")

    actor_write = seeded_client.put(
        f"/api/productions/{production_id}/overview-messages",
        json={
            "messages": [
                {
                    "kind": "announcement",
                    "body": "Actors cannot write",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=actor_headers,
    )
    assert actor_write.status_code == 403

    actor_settings = seeded_client.patch(
        f"/api/productions/{production_id}/overview-settings",
        json={"message_rotation_seconds": 15},
        headers=actor_headers,
    )
    assert actor_settings.status_code == 403

    # Uncast actors cannot read a production by ID (even empty ones).
    actor_read = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=actor_headers,
    )
    assert actor_read.status_code == 404

    listed = seeded_client.get(
        f"/api/productions/{production_id}/overview-messages",
        headers=actor_headers,
    )
    assert listed.status_code == 404

    director_write = seeded_client.put(
        f"/api/productions/{production_id}/overview-messages",
        json={
            "messages": [
                {
                    "kind": "announcement",
                    "body": "Directors can write",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=director_headers,
    )
    assert director_write.status_code == 200


def test_rotation_inheritance_and_off(seeded_client: TestClient) -> None:
    production_id = _empty_production(seeded_client)
    admin_headers = _login(seeded_client, "admin", "admin")
    director_headers = _login(seeded_client, "director", "director")

    settings = seeded_client.get("/api/settings", headers=director_headers).json()
    assert settings["default_message_rotation_seconds"] == 20

    inherited = seeded_client.get(
        f"/api/productions/{production_id}/overview-settings",
        headers=director_headers,
    ).json()
    assert inherited["message_rotation_seconds"] is None
    assert inherited["effective_rotation_seconds"] == 20

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    assert overview["rotation_seconds"] == 20

    patched_global = seeded_client.patch(
        "/api/settings",
        json={"default_message_rotation_seconds": 45},
        headers=admin_headers,
    )
    assert patched_global.status_code == 200
    assert patched_global.json()["default_message_rotation_seconds"] == 45

    after_global = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    assert after_global["rotation_seconds"] == 45

    override = seeded_client.patch(
        f"/api/productions/{production_id}/overview-settings",
        json={"message_rotation_seconds": 10},
        headers=director_headers,
    )
    assert override.status_code == 200
    assert override.json()["message_rotation_seconds"] == 10
    assert override.json()["effective_rotation_seconds"] == 10

    overview_override = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    assert overview_override["rotation_seconds"] == 10

    off = seeded_client.patch(
        f"/api/productions/{production_id}/overview-settings",
        json={"message_rotation_seconds": 0},
        headers=director_headers,
    )
    assert off.status_code == 200
    assert off.json()["effective_rotation_seconds"] == 0

    clear = seeded_client.patch(
        f"/api/productions/{production_id}/overview-settings",
        json={"message_rotation_seconds": None},
        headers=director_headers,
    )
    assert clear.status_code == 200
    assert clear.json()["message_rotation_seconds"] is None
    assert clear.json()["effective_rotation_seconds"] == 45

    bad_rotation = seeded_client.patch(
        f"/api/productions/{production_id}/overview-settings",
        json={"message_rotation_seconds": 3},
        headers=director_headers,
    )
    assert bad_rotation.status_code == 422

    bad_global = seeded_client.patch(
        "/api/settings",
        json={"default_message_rotation_seconds": 301},
        headers=admin_headers,
    )
    assert bad_global.status_code == 422


def test_inactive_global_default_excluded(seeded_client: TestClient) -> None:
    production_id = _empty_production(seeded_client)
    admin_headers = _login(seeded_client, "admin", "admin")
    director_headers = _login(seeded_client, "director", "director")

    seeded_client.put(
        "/api/settings/overview-message-defaults",
        json={
            "messages": [
                {
                    "band": "0",
                    "body": "Hidden",
                    "sort_order": 0,
                    "active": False,
                },
                {
                    "band": "0",
                    "body": "Visible",
                    "sort_order": 1,
                    "active": True,
                },
            ]
        },
        headers=admin_headers,
    )

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    bodies = [item["body"] for item in overview["spotlight"]]
    assert bodies == ["Visible"]


def test_production_encouragement_replaces_global_pool(
    seeded_client: TestClient,
) -> None:
    """Any production encouragement replaces the global rotating pool (bands ignored)."""
    production_id = _empty_production(seeded_client)
    director_headers = _login(seeded_client, "director", "director")

    seeded_client.put(
        f"/api/productions/{production_id}/overview-messages",
        json={
            "messages": [
                {
                    "kind": "encouragement",
                    "band": "100",
                    "body": "Show-specific quote",
                    "sort_order": 0,
                    "active": True,
                }
            ]
        },
        headers=director_headers,
    )

    overview = seeded_client.get(
        f"/api/productions/{production_id}/overview",
        headers=director_headers,
    ).json()
    assert overview["readiness_band"] == "0"
    assert len(overview["spotlight"]) == 1
    assert overview["spotlight"][0]["source"] == "production"
    assert overview["spotlight"][0]["body"] == "Show-specific quote"
