"""Suggestion engine: entrance imminence, dismiss, accept."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    Act,
    Character,
    Dialogue,
    Group,
    Moment,
    MomentType,
    Production,
    Scene,
    StageDirection,
)
from scoped_test_helpers import add_test_production_memberships, seed_database_with_test_users


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database_with_test_users(db_session, test_settings)
    db_session.commit()
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _type_id(db: Session, name: str) -> int:
    return db.query(MomentType).filter(MomentType.name == name).one().id


def _build_imminence_scene(db: Session, production: Production) -> tuple[int, int, int, int]:
    """Scene: SD, Calliope dialogue, SD, Muses group dialogue.

    Returns (scene_id, calliope_id, muses_id, first_sd_moment_id).
    """
    act = Act(production_id=production.id, number=1, title="Act 1", sort_order=1)
    db.add(act)
    db.flush()
    scene = Scene(act_id=act.id, number=1, title="Scene 1", sort_order=1)
    db.add(scene)
    db.flush()

    calliope = Character(production_id=production.id, name="CALLIOPE")
    db.add(calliope)
    db.flush()

    muses = Group(production_id=production.id, name="Muses")
    muses.characters.append(calliope)
    db.add(muses)
    db.flush()

    sd_type = _type_id(db, "stage_direction")
    dialogue_type = _type_id(db, "dialogue")

    m1 = Moment(
        scene_id=scene.id,
        moment_type_id=sd_type,
        sequence_number=1,
        original_text="Lights up.",
    )
    m2 = Moment(
        scene_id=scene.id,
        moment_type_id=dialogue_type,
        sequence_number=2,
        original_text="CALLIOPE: Hello.",
    )
    m3 = Moment(
        scene_id=scene.id,
        moment_type_id=sd_type,
        sequence_number=3,
        original_text="The Muses enter.",
    )
    m4 = Moment(
        scene_id=scene.id,
        moment_type_id=dialogue_type,
        sequence_number=4,
        original_text="MUSES: We sing.",
    )
    db.add_all([m1, m2, m3, m4])
    db.flush()

    db.add(StageDirection(moment_id=m1.id, direction_text="Lights up."))
    db.add(Dialogue(moment_id=m2.id, character_id=calliope.id, dialogue_text="Hello."))
    db.add(StageDirection(moment_id=m3.id, direction_text="The Muses enter."))
    db.add(Dialogue(moment_id=m4.id, group_id=muses.id, dialogue_text="We sing."))
    db.commit()

    return scene.id, calliope.id, muses.id, m1.id


def _production_with_scene(
    client: TestClient, db: Session
) -> tuple[int, int, int, int, int, dict[str, str]]:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "Suggestion Fixture", "season": "2026"},
        headers=headers,
    )
    assert create.status_code == 201
    production_id = create.json()["id"]
    production = db.get(Production, production_id)
    assert production is not None
    add_test_production_memberships(db, production)
    db.commit()

    scene_id, calliope_id, muses_id, first_sd_id = _build_imminence_scene(db, production)
    director = _login(client, "director", "director")
    return production_id, scene_id, calliope_id, muses_id, first_sd_id, director


def test_entrance_imminence_lists_character_and_group(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id, scene_id, calliope_id, muses_id, first_sd_id, headers = (
        _production_with_scene(seeded_client, db_session)
    )

    response = seeded_client.get(
        f"/api/productions/{production_id}/suggestions",
        params={"scene_id": scene_id},
        headers=headers,
    )
    assert response.status_code == 200
    suggestions = response.json()
    assert len(suggestions) == 2

    by_subject = {(item["subject"]["kind"], item["subject"]["id"]): item for item in suggestions}
    calliope = by_subject[("character", calliope_id)]
    muses = by_subject[("group", muses_id)]

    assert calliope["rule_id"] == "entrance_imminence"
    assert calliope["anchor_moment_id"] == first_sd_id
    assert "Add entrance for CALLIOPE" in calliope["title"]
    assert calliope["actions"][0]["kind"] == "create_entrance"
    assert calliope["actions"][0]["character_id"] == calliope_id

    assert muses["anchor_moment_id"] != first_sd_id  # prior SD before group speech
    assert muses["actions"][0]["group_id"] == muses_id
    assert muses["fingerprint"] != calliope["fingerprint"]


def test_group_entrance_covers_member_character(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id, scene_id, calliope_id, muses_id, first_sd_id, headers = (
        _production_with_scene(seeded_client, db_session)
    )

    # Enter Muses on first SD — Calliope should no longer need her own entrance
    # once group is on (but Calliope speaks BEFORE that SD's... wait: Calliope
    # speaks at L.2, Muses SD is L.3. So covering Calliope requires entrance
    # on/before L.2. Put Calliope in via group entrance on L.1.
    enter = seeded_client.post(
        f"/api/productions/{production_id}/moments/{first_sd_id}/entrances",
        json={"group_id": muses_id},
        headers=headers,
    )
    assert enter.status_code == 201

    response = seeded_client.get(
        f"/api/productions/{production_id}/suggestions",
        params={"scene_id": scene_id},
        headers=headers,
    )
    assert response.status_code == 200
    suggestions = response.json()
    # Calliope covered by on-stage Muses group; Muses themselves are on stage
    # before their speech only if still on — they entered at L.1 so covered.
    assert suggestions == []


def test_dismiss_hides_instance_only(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id, scene_id, calliope_id, muses_id, _first_sd_id, headers = (
        _production_with_scene(seeded_client, db_session)
    )
    listed = seeded_client.get(
        f"/api/productions/{production_id}/suggestions",
        params={"scene_id": scene_id},
        headers=headers,
    ).json()
    calliope_fp = next(
        item["fingerprint"]
        for item in listed
        if item["subject"]["kind"] == "character"
    )

    dismiss = seeded_client.post(
        f"/api/productions/{production_id}/suggestions/dismiss",
        json={"fingerprint": calliope_fp},
        headers=headers,
    )
    assert dismiss.status_code == 204

    after = seeded_client.get(
        f"/api/productions/{production_id}/suggestions",
        params={"scene_id": scene_id},
        headers=headers,
    ).json()
    assert len(after) == 1
    assert after[0]["subject"]["kind"] == "group"
    assert after[0]["subject"]["id"] == muses_id

    with_dismissed = seeded_client.get(
        f"/api/productions/{production_id}/suggestions",
        params={"scene_id": scene_id, "include_dismissed": True},
        headers=headers,
    ).json()
    assert len(with_dismissed) == 2
    assert any(item["dismissed"] and item["fingerprint"] == calliope_fp for item in with_dismissed)


def test_accept_creates_official_entrance(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id, scene_id, calliope_id, _muses_id, first_sd_id, headers = (
        _production_with_scene(seeded_client, db_session)
    )
    listed = seeded_client.get(
        f"/api/productions/{production_id}/suggestions",
        params={"scene_id": scene_id},
        headers=headers,
    ).json()
    calliope = next(
        item for item in listed if item["subject"]["kind"] == "character"
    )

    accepted = seeded_client.post(
        f"/api/productions/{production_id}/suggestions/accept",
        json={"fingerprint": calliope["fingerprint"]},
        headers=headers,
    )
    assert accepted.status_code == 200
    assert accepted.json()["applied"] is True

    detail = seeded_client.get(
        f"/api/productions/{production_id}/moments/{first_sd_id}",
        headers=headers,
    ).json()
    entrances = detail["entrances"]
    assert any(
        row["character_id"] == calliope_id and row["status"] == "official"
        for row in entrances
    )

    after = seeded_client.get(
        f"/api/productions/{production_id}/suggestions",
        params={"scene_id": scene_id},
        headers=headers,
    ).json()
    assert all(item["subject"]["kind"] != "character" for item in after)


def test_actor_cannot_list_suggestions(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id, scene_id, *_rest, _director = _production_with_scene(
        seeded_client, db_session
    )
    actor = _login(seeded_client, "actor", "actor")
    response = seeded_client.get(
        f"/api/productions/{production_id}/suggestions",
        params={"scene_id": scene_id},
        headers=actor,
    )
    assert response.status_code == 403


def test_suggestion_accept_dismiss_analytics(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id, scene_id, _calliope_id, _muses_id, _first_sd_id, headers = (
        _production_with_scene(seeded_client, db_session)
    )
    listed = seeded_client.get(
        f"/api/productions/{production_id}/suggestions",
        params={"scene_id": scene_id},
        headers=headers,
    ).json()
    calliope = next(item for item in listed if item["subject"]["kind"] == "character")
    muses = next(item for item in listed if item["subject"]["kind"] == "group")

    assert (
        seeded_client.post(
            f"/api/productions/{production_id}/suggestions/accept",
            json={"fingerprint": calliope["fingerprint"]},
            headers=headers,
        ).status_code
        == 200
    )
    assert (
        seeded_client.post(
            f"/api/productions/{production_id}/suggestions/dismiss",
            json={"fingerprint": muses["fingerprint"]},
            headers=headers,
        ).status_code
        == 204
    )

    summary = seeded_client.get(
        f"/api/productions/{production_id}/analytics/suggestions/summary",
        headers=headers,
    )
    assert summary.status_code == 200
    body = summary.json()
    assert body["overall"]["accepted"] == 1
    assert body["overall"]["dismissed"] == 1
    assert body["overall"]["total"] == 2
    assert body["overall"]["accept_rate"] == 0.5
    assert len(body["by_rule"]) == 1
    assert body["by_rule"][0]["rule_id"] == "entrance_imminence"

    events = seeded_client.get(
        f"/api/productions/{production_id}/analytics/events",
        params={"event_name_prefix": "suggestion.", "limit": 20},
        headers=headers,
    )
    assert events.status_code == 200
    names = {row["event_name"] for row in events.json()}
    assert names == {"suggestion.accepted", "suggestion.dismissed"}
    accepted = next(
        row for row in events.json() if row["event_name"] == "suggestion.accepted"
    )
    assert accepted["properties"]["rule_id"] == "entrance_imminence"
    assert accepted["properties"]["fingerprint"] == calliope["fingerprint"]
    assert "attachment_id" in accepted["properties"]
