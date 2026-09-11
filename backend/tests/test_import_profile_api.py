import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.seed import seed_database
from app.models import ImportProfile, Organization
from scoped_test_helpers import seed_database_with_test_users


@pytest.fixture
def seeded_client(
    client: TestClient,
    db_session: Session,
    test_settings,
) -> TestClient:
    seed_database_with_test_users(db_session, test_settings)
    db_session.commit()
    return client


def _headers(client: TestClient, username: str = "admin") -> dict[str, str]:
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": username},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _custom_profile(name: str = "My custom PDF") -> dict:
    return {
        "name": name,
        "description": "Created in the visual editor",
        "source_formats": ["pdf"],
        "pdf": {"start_page": 2},
        "speakers": {
            "require_all_caps": False,
            "allow_parentheses": True,
        },
        "rules": [
            {
                "id": "ignore-header",
                "name": "Ignore a header",
                "priority": 100,
                "match": {"text_contains": "Copyright"},
                "action": {"type": "ignore"},
            }
        ],
    }


def test_admin_can_create_update_and_delete_profile(seeded_client: TestClient):
    headers = _headers(seeded_client)

    created = seeded_client.post(
        "/api/import-profiles",
        headers=headers,
        json=_custom_profile(),
    )
    assert created.status_code == 201
    profile_id = created.json()["id"]
    assert created.json()["is_builtin"] is False

    updated_body = _custom_profile("My revised PDF")
    updated_body["rules"][0]["match"] = {"text_contains": "LifeHouse"}
    updated = seeded_client.put(
        f"/api/import-profiles/{profile_id}",
        headers=headers,
        json=updated_body,
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "My revised PDF"

    deleted = seeded_client.delete(
        f"/api/import-profiles/{profile_id}",
        headers=headers,
    )
    assert deleted.status_code == 204


def test_builtin_is_listed_read_only_and_can_be_duplicated(seeded_client: TestClient):
    headers = _headers(seeded_client)

    listed = seeded_client.get("/api/import-profiles", headers=headers)
    assert listed.status_code == 200
    builtin = next(profile for profile in listed.json() if profile["is_builtin"])

    blocked = seeded_client.put(
        f"/api/import-profiles/{builtin['id']}",
        headers=headers,
        json=_custom_profile(),
    )
    assert blocked.status_code == 400

    duplicated = seeded_client.post(
        f"/api/import-profiles/{builtin['id']}/duplicate",
        headers=headers,
        json={"name": "Scrooge working copy"},
    )
    assert duplicated.status_code == 200
    assert duplicated.json()["name"] == "Scrooge working copy"
    assert duplicated.json()["is_builtin"] is False


def test_non_admin_cannot_access_import_profiles(seeded_client: TestClient):
    response = seeded_client.get(
        "/api/import-profiles",
        headers=_headers(seeded_client, "director"),
    )

    assert response.status_code == 403


def test_reseed_refreshes_builtin_but_not_admin_profile(
    db_session: Session,
    test_settings,
):
    seed_database_with_test_users(db_session, test_settings)
    builtin = db_session.query(ImportProfile).filter(ImportProfile.is_builtin.is_(True)).one()
    builtin.rules = []
    custom = ImportProfile(
        organization_id=db_session.query(Organization).one().id,
        name="Do not overwrite",
        description=None,
        source_formats=["pdf"],
        version=1,
        rules=[],
        pdf_options={"start_page": 1, "end_page": None},
        speaker_options={"require_all_caps": False, "allow_parentheses": True},
        is_builtin=False,
    )
    db_session.add(custom)
    db_session.commit()

    seed_database(db_session, test_settings)

    db_session.refresh(builtin)
    db_session.refresh(custom)
    assert len(builtin.rules) > 8
    assert custom.rules == []

