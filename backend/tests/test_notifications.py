"""Notifications + announcements API tests."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Character, Notification, Production, User, UserCharacterAssignment
from scoped_test_helpers import add_test_production_memberships, seed_database_with_test_users


@pytest.fixture
def seeded_client(client: TestClient, db_session: Session, test_settings) -> TestClient:
    seed_database_with_test_users(db_session, test_settings)
    db_session.commit()
    return client


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _create_production(client: TestClient, headers: dict[str, str], title: str = "Show A") -> int:
    response = client.post(
        "/api/productions",
        json={"title": title, "season": "2026"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _cast_actor(db_session: Session, production_id: int) -> None:
    actor = db_session.query(User).filter(User.username == "actor").one()
    character = Character(production_id=production_id, name="Lead")
    db_session.add(character)
    db_session.flush()
    db_session.add(
        UserCharacterAssignment(user_id=actor.id, character_id=character.id)
    )
    db_session.commit()


def test_create_production_notifies_admins(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")
    production_id = _create_production(seeded_client, admin_headers, "Brand New")
    add_test_production_memberships(db_session, production_id)

    admin = db_session.query(User).filter(User.username == "admin").one()
    notes = (
        db_session.query(Notification)
        .filter(
            Notification.user_id == admin.id,
            Notification.kind == "system",
            Notification.resource_type == "production",
            Notification.resource_id == production_id,
        )
        .all()
    )
    assert len(notes) == 1
    assert "Brand New" in notes[0].title

    inbox = seeded_client.get("/api/notifications/inbox", headers=admin_headers)
    assert inbox.status_code == 200
    payload = inbox.json()
    assert payload["unread_count"] >= 1
    assert any(item["kind"] == "system" for item in payload["items"])


def test_production_announcement_actor_isolation(
    seeded_client: TestClient,
    db_session: Session,
) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")
    director_headers = _login(seeded_client, "director", "director")
    actor_headers = _login(seeded_client, "actor", "actor")

    production_a = _create_production(seeded_client, admin_headers, "Prod A")
    add_test_production_memberships(db_session, production_a)
    production_b = _create_production(seeded_client, admin_headers, "Prod B")
    add_test_production_memberships(db_session, production_b, include_actor=False)
    _cast_actor(db_session, production_a)

    create = seeded_client.post(
        f"/api/productions/{production_a}/announcements",
        headers=director_headers,
        json={
            "title": "Rehearsal Thursday",
            "body": "Be off-book.",
            "severity": "warning",
            "show_as_banner": True,
            "show_as_modal": False,
            "audience_roles": ["Actor"],
            "ctas": [
                {
                    "label": "Open Rehearse",
                    "kind": "internal",
                    "target": f"/productions/{production_a}/rehearse",
                    "style": "primary",
                }
            ],
        },
    )
    assert create.status_code == 201, create.text

    actor_inbox = seeded_client.get("/api/notifications/inbox", headers=actor_headers)
    assert actor_inbox.status_code == 200
    actor_items = actor_inbox.json()["items"]
    assert any(item["title"] == "Rehearsal Thursday" for item in actor_items)

    # Actor not cast in B — creating an Actor-targeted announcement on B should not reach them.
    create_b = seeded_client.post(
        f"/api/productions/{production_b}/announcements",
        headers=director_headers,
        json={
            "title": "Other show note",
            "body": "Ignore",
            "audience_roles": ["Actor"],
        },
    )
    assert create_b.status_code == 201, create_b.text

    actor_inbox2 = seeded_client.get("/api/notifications/inbox", headers=actor_headers).json()
    assert not any(item["title"] == "Other show note" for item in actor_inbox2["items"])


def test_director_cannot_create_modal_or_org_wide(
    seeded_client: TestClient, db_session: Session
) -> None:
    director_headers = _login(seeded_client, "director", "director")
    admin_headers = _login(seeded_client, "admin", "admin")
    production_id = _create_production(seeded_client, admin_headers)
    add_test_production_memberships(db_session, production_id, include_actor=False)

    denied_org = seeded_client.post(
        "/api/announcements",
        headers=director_headers,
        json={
            "title": "Org news",
            "body": "Nope",
            "audience_roles": ["Actor", "Director", "Admin"],
        },
    )
    assert denied_org.status_code == 403

    denied_modal = seeded_client.post(
        f"/api/productions/{production_id}/announcements",
        headers=director_headers,
        json={
            "title": "Modal",
            "body": "Nope",
            "show_as_modal": True,
            "audience_roles": ["Actor"],
        },
    )
    assert denied_modal.status_code == 403


def test_org_modal_and_mark_read(
    seeded_client: TestClient,
) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")

    create = seeded_client.post(
        "/api/announcements",
        headers=admin_headers,
        json={
            "title": "What's new",
            "body": "Release notes go here.",
            "severity": "info",
            "show_as_modal": True,
            "audience_roles": ["Admin"],
            "ctas": [
                {
                    "label": "Feedback",
                    "kind": "external",
                    "target": "https://example.com/form",
                    "style": "secondary",
                }
            ],
        },
    )
    assert create.status_code == 201, create.text

    inbox = seeded_client.get("/api/notifications/inbox", headers=admin_headers)
    assert inbox.status_code == 200
    payload = inbox.json()
    assert payload["pending_modal"] is not None
    assert payload["pending_modal"]["title"] == "What's new"
    notification_id = payload["pending_modal"]["id"]

    read = seeded_client.post(
        f"/api/notifications/{notification_id}/read",
        headers=admin_headers,
    )
    assert read.status_code == 204

    inbox2 = seeded_client.get("/api/notifications/inbox", headers=admin_headers).json()
    assert inbox2["pending_modal"] is None
    matched = next(item for item in inbox2["items"] if item["id"] == notification_id)
    assert matched["read_at"] is not None


def test_banner_surface_and_dismiss(seeded_client: TestClient, db_session: Session) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")
    actor_headers = _login(seeded_client, "actor", "actor")
    production_id = _create_production(seeded_client, admin_headers)
    add_test_production_memberships(db_session, production_id, include_director=False)
    _cast_actor(db_session, production_id)

    create = seeded_client.post(
        f"/api/productions/{production_id}/announcements",
        headers=admin_headers,
        json={
            "title": "Off-book reminder",
            "body": "Next rehearsal.",
            "severity": "warning",
            "show_as_banner": True,
            "audience_roles": ["Actor"],
            "route_filter": "rehearse",
        },
    )
    assert create.status_code == 201, create.text

    # Wrong route → no banner
    wrong = seeded_client.get(
        f"/api/notifications/inbox?production_id={production_id}&route_key=timeline",
        headers=actor_headers,
    ).json()
    assert wrong["active_banner"] is None

    right = seeded_client.get(
        f"/api/notifications/inbox?production_id={production_id}&route_key=rehearse",
        headers=actor_headers,
    ).json()
    assert right["active_banner"] is not None
    assert right["active_banner"]["title"] == "Off-book reminder"
    notification_id = right["active_banner"]["id"]

    seeded_client.post(
        f"/api/notifications/{notification_id}/read",
        headers=actor_headers,
    )
    after = seeded_client.get(
        f"/api/notifications/inbox?production_id={production_id}&route_key=rehearse",
        headers=actor_headers,
    ).json()
    assert after["active_banner"] is None


def test_announcement_deactivate_then_hard_delete(
    seeded_client: TestClient, db_session: Session
) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")
    production_id = _create_production(seeded_client, admin_headers)
    add_test_production_memberships(db_session, production_id)

    create = seeded_client.post(
        f"/api/productions/{production_id}/announcements",
        headers=admin_headers,
        json={
            "title": "Temp notice",
            "body": "Will be removed.",
            "audience_roles": ["Actor", "Director", "Admin"],
        },
    )
    assert create.status_code == 201, create.text
    announcement_id = create.json()["id"]

    deactivate = seeded_client.delete(
        f"/api/announcements/{announcement_id}",
        headers=admin_headers,
    )
    assert deactivate.status_code == 200
    assert deactivate.json()["active"] is False

    listed = seeded_client.get(
        f"/api/productions/{production_id}/announcements",
        headers=admin_headers,
    ).json()
    assert any(item["id"] == announcement_id for item in listed)

    hard_delete = seeded_client.delete(
        f"/api/announcements/{announcement_id}",
        headers=admin_headers,
    )
    assert hard_delete.status_code == 204

    listed_after = seeded_client.get(
        f"/api/productions/{production_id}/announcements",
        headers=admin_headers,
    ).json()
    assert all(item["id"] != announcement_id for item in listed_after)


def test_timeline_human_deep_link_cta_allowed(
    seeded_client: TestClient, db_session: Session
) -> None:
    admin_headers = _login(seeded_client, "admin", "admin")
    production_id = _create_production(seeded_client, admin_headers)
    add_test_production_memberships(db_session, production_id)

    create = seeded_client.post(
        f"/api/productions/{production_id}/announcements",
        headers=admin_headers,
        json={
            "title": "Jump to scene",
            "body": "Start at Act 1 Scene 2.",
            "audience_roles": ["Actor", "Director", "Admin"],
            "ctas": [
                {
                    "label": "Open Timeline",
                    "kind": "internal",
                    "target": f"/productions/{production_id}/timeline?act=1&scene=2&moment=10",
                    "style": "primary",
                }
            ],
        },
    )
    assert create.status_code == 201, create.text
    ctas = create.json()["ctas"]
    assert len(ctas) == 1
    assert ctas[0]["target"].endswith("timeline?act=1&scene=2&moment=10")
