"""On-stage presence chart: interval assembly and report endpoint."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import Production
from app.services.importer import import_script
from app.services.on_stage_chart import ChartMoment, assemble_on_stage_chart

FIXTURE_PATH = Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database(db_session, test_settings)
    return client


def _moment(
    moment_id: int,
    *,
    scene_id: int = 1,
    act_id: int = 1,
    act_number: int = 1,
    scene_number: int = 1,
    sequence_number: int = 1,
    entrances: tuple[tuple[int, str | None], ...] = (),
    exits: tuple[tuple[int, str | None], ...] = (),
    scene_title: str | None = "Camp",
) -> ChartMoment:
    return ChartMoment(
        moment_id=moment_id,
        scene_id=scene_id,
        act_id=act_id,
        act_number=act_number,
        act_title="Act 1",
        scene_number=scene_number,
        scene_title=scene_title,
        sequence_number=sequence_number,
        entrances=entrances,
        exits=exits,
    )


def test_empty_spine_returns_empty_report() -> None:
    report = assemble_on_stage_chart([], {})
    assert report.moment_count == 0
    assert report.acts == []
    assert report.scenes == []
    assert report.characters == []


def test_enter_then_exit_builds_half_open_interval() -> None:
    # Indices 0..4; enter at 0, exit at 3 → bar covers 0,1,2
    moments = [
        _moment(10, sequence_number=1, entrances=((7, "from SR"),)),
        _moment(11, sequence_number=2),
        _moment(12, sequence_number=3),
        _moment(13, sequence_number=4, exits=((7, None),)),
        _moment(14, sequence_number=5),
    ]
    report = assemble_on_stage_chart(moments, {7: "CREAN"})
    assert report.moment_count == 5
    assert len(report.characters) == 1
    row = report.characters[0]
    assert row.character_name == "CREAN"
    assert len(row.intervals) == 1
    interval = row.intervals[0]
    assert interval.start_index == 0
    assert interval.end_index == 3
    assert interval.entrance.moment_id == 10
    assert interval.entrance_notes == "from SR"
    assert interval.exit is not None
    assert interval.exit.moment_id == 13
    assert interval.ends_at_scene_boundary is False


def test_same_moment_enter_and_exit_is_one_moment_wide() -> None:
    moments = [
        _moment(1, sequence_number=1),
        _moment(2, sequence_number=2, entrances=((7, None),), exits=((7, "pop-on"),)),
        _moment(3, sequence_number=3),
    ]
    report = assemble_on_stage_chart(moments, {7: "CREAN"})
    interval = report.characters[0].intervals[0]
    assert interval.start_index == 1
    assert interval.end_index == 2
    assert interval.exit is not None
    assert interval.exit.moment_id == 2
    assert interval.exit_notes == "pop-on"


def test_missing_exit_closes_at_scene_boundary() -> None:
    moments = [
        _moment(1, scene_id=1, scene_number=1, sequence_number=1, entrances=((7, None),)),
        _moment(2, scene_id=1, scene_number=1, sequence_number=2),
        _moment(3, scene_id=2, scene_number=2, sequence_number=1, scene_title="Later"),
        _moment(4, scene_id=2, scene_number=2, sequence_number=2, scene_title="Later"),
    ]
    report = assemble_on_stage_chart(moments, {7: "CREAN"})
    interval = report.characters[0].intervals[0]
    assert interval.start_index == 0
    assert interval.end_index == 2
    assert interval.exit is None
    assert interval.ends_at_scene_boundary is True
    assert [scene.scene_number for scene in report.scenes] == [1, 2]
    assert report.scenes[0].moment_count == 2
    assert report.scenes[1].start_index == 2


def test_presence_does_not_carry_into_the_next_scene() -> None:
    moments = [
        _moment(1, scene_id=1, scene_number=1, sequence_number=1, entrances=((7, None),)),
        _moment(2, scene_id=1, scene_number=1, sequence_number=2),
        _moment(3, scene_id=2, scene_number=2, sequence_number=1, scene_title="Later"),
        _moment(4, scene_id=2, scene_number=2, sequence_number=2, scene_title="Later"),
    ]
    report = assemble_on_stage_chart(moments, {7: "CREAN"})
    assert len(report.characters[0].intervals) == 1
    assert report.characters[0].intervals[0].end_index == 2


def test_reenter_after_exit_makes_a_second_interval() -> None:
    moments = [
        _moment(1, sequence_number=1, entrances=((7, None),)),
        _moment(2, sequence_number=2, exits=((7, None),)),
        _moment(3, sequence_number=3, entrances=((7, None),)),
        _moment(4, sequence_number=4),
    ]
    report = assemble_on_stage_chart(moments, {7: "CREAN"})
    intervals = report.characters[0].intervals
    assert [(item.start_index, item.end_index) for item in intervals] == [(0, 1), (2, 4)]
    assert intervals[1].ends_at_scene_boundary is True


def test_unmatched_exit_is_ignored() -> None:
    moments = [_moment(1, sequence_number=1, exits=((7, None),))]
    report = assemble_on_stage_chart(moments, {7: "CREAN"})
    assert report.characters == []


def test_second_entrance_while_already_on_is_ignored() -> None:
    moments = [
        _moment(1, sequence_number=1, entrances=((7, "first"),)),
        _moment(2, sequence_number=2, entrances=((7, "again"),)),
        _moment(3, sequence_number=3, exits=((7, None),)),
    ]
    report = assemble_on_stage_chart(moments, {7: "CREAN"})
    interval = report.characters[0].intervals[0]
    assert interval.start_index == 0
    assert interval.end_index == 2
    assert interval.entrance_notes == "first"


def test_rows_sort_by_character_name() -> None:
    moments = [
        _moment(1, sequence_number=1, entrances=((2, None), (1, None))),
    ]
    report = assemble_on_stage_chart(moments, {1: "WORSLEY", 2: "CREAN"})
    assert [row.character_name for row in report.characters] == ["CREAN", "WORSLEY"]


def test_act_bands_span_their_scenes() -> None:
    moments = [
        _moment(1, act_id=1, act_number=1, scene_id=1, scene_number=1, sequence_number=1),
        _moment(2, act_id=1, act_number=1, scene_id=2, scene_number=2, sequence_number=1),
        _moment(
            3,
            act_id=2,
            act_number=2,
            scene_id=3,
            scene_number=1,
            sequence_number=1,
            scene_title="Act 2 open",
        ),
    ]
    report = assemble_on_stage_chart(moments, {})
    assert len(report.acts) == 2
    assert report.acts[0].moment_count == 2
    assert report.acts[1].start_index == 2
    assert report.acts[1].moment_count == 1


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _imported_production(client: TestClient, db_session: Session) -> int:
    headers = _login(client, "admin", "admin")
    create = client.post(
        "/api/productions",
        json={"title": "On-stage chart", "season": "2026"},
        headers=headers,
    )
    production_id = create.json()["id"]
    production = db_session.get(Production, production_id)
    assert production is not None
    import_script(db_session, production, FIXTURE_PATH.read_text(encoding="utf-8"))
    return production_id


def test_on_stage_chart_endpoint_matches_posted_entrance_and_exit(
    seeded_client: TestClient, db_session: Session
) -> None:
    production_id = _imported_production(seeded_client, db_session)
    director = _login(seeded_client, "director", "director")

    empty = seeded_client.get(
        f"/api/productions/{production_id}/reports/on-stage-chart",
        headers=director,
    )
    assert empty.status_code == 200
    assert empty.json()["moment_count"] > 0
    assert empty.json()["characters"] == []

    acts = seeded_client.get(f"/api/productions/{production_id}/acts", headers=director).json()
    scene_id = acts[0]["scenes"][0]["id"]
    moments = seeded_client.get(
        f"/api/productions/{production_id}/scenes/{scene_id}/moments",
        headers=director,
    ).json()
    characters = seeded_client.get(
        f"/api/productions/{production_id}/characters",
        headers=director,
    ).json()
    crean_id = next(row["id"] for row in characters if row["name"] == "CREAN")
    entrance_id = moments[0]["id"]
    exit_id = moments[min(4, len(moments) - 1)]["id"]

    assert (
        seeded_client.post(
            f"/api/productions/{production_id}/moments/{entrance_id}/entrances",
            json={"character_id": crean_id, "notes": "from SR"},
            headers=director,
        ).status_code
        == 201
    )
    assert (
        seeded_client.post(
            f"/api/productions/{production_id}/moments/{exit_id}/exits",
            json={"character_id": crean_id},
            headers=director,
        ).status_code
        == 201
    )

    chart = seeded_client.get(
        f"/api/productions/{production_id}/reports/on-stage-chart",
        headers=director,
    )
    assert chart.status_code == 200
    payload = chart.json()
    assert payload["characters"][0]["character_name"] == "CREAN"
    interval = payload["characters"][0]["intervals"][0]
    assert interval["entrance"]["moment_id"] == entrance_id
    assert interval["entrance_notes"] == "from SR"
    assert interval["exit"]["moment_id"] == exit_id
    assert interval["start_index"] == 0
    assert interval["end_index"] > interval["start_index"]

    actor = _login(seeded_client, "actor", "actor")
    forbidden = seeded_client.get(
        f"/api/productions/{production_id}/reports/on-stage-chart",
        headers=actor,
    )
    assert forbidden.status_code == 403
