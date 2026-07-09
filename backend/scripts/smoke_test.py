#!/usr/bin/env python3
"""Phase 1 API smoke test — validates manual checklist items via HTTP.

Usage (from backend/):
    uv run python scripts/smoke_test.py

Optional env:
    SMOKE_TEST_BASE_URL  default http://localhost:8000
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

import httpx

BASE_URL = os.environ.get("SMOKE_TEST_BASE_URL", "http://localhost:8000")
API_PREFIX = "/api"
FIXTURE_PATH = (
    Path(__file__).resolve().parents[2] / "fixtures" / "scripts" / "endurance-scene1.md"
)
# Common UTF-8-misread-as-Latin-1 sequences (e.g. â€™ for apostrophe).
MOJIBAKE_MARKERS = (
    "\u00e2\u20ac\u2122",  # â€™
    "\u00e2\u20ac\u02dc",  # â€˜
    "\u00e2\u20ac\u201c",  # â€œ
    "\u00e2\u20ac\u201d",  # â€
    "\u00e2\u20ac",        # partial mojibake prefix
)


@dataclass
class Check:
    name: str
    passed: bool
    detail: str = ""


@dataclass
class SmokeTestReport:
    checks: list[Check] = field(default_factory=list)

    def record(self, name: str, passed: bool, detail: str = "") -> None:
        self.checks.append(Check(name=name, passed=passed, detail=detail))
        status = "PASS" if passed else "FAIL"
        line = f"  [{status}] {name}"
        if detail:
            line += f" — {detail}"
        print(line)

    @property
    def all_passed(self) -> bool:
        return all(check.passed for check in self.checks)


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def login(client: httpx.Client, username: str, password: str) -> str:
    response = client.post(
        f"{API_PREFIX}/auth/login",
        json={"username": username, "password": password},
    )
    response.raise_for_status()
    return response.json()["access_token"]


def find_production(
    client: httpx.Client, token: str, title: str, season: str | None
) -> dict | None:
    response = client.get(f"{API_PREFIX}/productions", headers=_auth_headers(token))
    response.raise_for_status()
    for production in response.json():
        if production["title"] == title and production.get("season") == season:
            return production
    return None


def production_has_timeline(client: httpx.Client, token: str, production_id: int) -> bool:
    response = client.get(
        f"{API_PREFIX}/productions/{production_id}/acts",
        headers=_auth_headers(token),
    )
    if response.status_code != 200:
        return False
    return len(response.json()) > 0


def delete_production_if_exists(
    client: httpx.Client, token: str, title: str, season: str | None
) -> bool:
    """Delete a production when possible. Returns True if deleted or absent."""
    production = find_production(client, token, title, season)
    if production is None:
        return True
    delete_response = client.delete(
        f"{API_PREFIX}/productions/{production['id']}",
        headers=_auth_headers(token),
    )
    return delete_response.status_code == 204


def run_smoke_test(base_url: str = BASE_URL) -> SmokeTestReport:
    report = SmokeTestReport()
    print(f"Phase 1 API smoke test against {base_url}\n")

    with httpx.Client(base_url=base_url, timeout=60.0) as client:
        # Health
        try:
            health = client.get("/health")
            report.record(
                "Backend health check",
                health.status_code == 200 and health.json().get("status") == "ok",
                f"status={health.status_code}",
            )
        except httpx.HTTPError as exc:
            report.record("Backend health check", False, str(exc))
            return report

        # 1. Login as admin
        try:
            admin_token = login(client, "admin", "admin")
            me = client.get(f"{API_PREFIX}/auth/me", headers=_auth_headers(admin_token))
            roles = me.json().get("roles", []) if me.status_code == 200 else []
            report.record(
                "1. Login as admin",
                me.status_code == 200 and "Admin" in roles,
                f"username={me.json().get('username')}, roles={roles}",
            )
        except httpx.HTTPError as exc:
            report.record("1. Login as admin", False, str(exc))
            return report

        # 2. Create production "Endurance" season "2026"
        production_id: int | None = None
        reused_existing = False
        try:
            existing = find_production(client, admin_token, "Endurance", "2026")
            if existing and production_has_timeline(client, admin_token, existing["id"]):
                production_id = existing["id"]
                reused_existing = True
                report.record(
                    "2. Create production Endurance / 2026",
                    True,
                    f"reused existing id={production_id}",
                )
            else:
                if existing:
                    delete_production_if_exists(client, admin_token, "Endurance", "2026")
                create = client.post(
                    f"{API_PREFIX}/productions",
                    headers=_auth_headers(admin_token),
                    json={"title": "Endurance", "season": "2026"},
                )
                if create.status_code == 201:
                    production_id = create.json()["id"]
                report.record(
                    "2. Create production Endurance / 2026",
                    create.status_code == 201,
                    f"id={production_id}, status={create.status_code}",
                )
        except httpx.HTTPError as exc:
            report.record("2. Create production Endurance / 2026", False, str(exc))

        # 3. Import endurance-scene1.md
        if production_id is not None:
            if reused_existing:
                report.record(
                    "3. Import endurance-scene1.md",
                    True,
                    "skipped — production already imported",
                )
            else:
                try:
                    fixture_bytes = FIXTURE_PATH.read_bytes()
                    import_response = client.post(
                        f"{API_PREFIX}/productions/{production_id}/import",
                        headers=_auth_headers(admin_token),
                        files={
                            "file": ("endurance-scene1.md", fixture_bytes, "text/markdown")
                        },
                    )
                    if import_response.status_code == 200:
                        stats = import_response.json()
                        detail = (
                            f"moments={stats.get('moments_created')}, "
                            f"acts={stats.get('acts_created')}, "
                            f"scenes={stats.get('scenes_created')}"
                        )
                        passed = stats.get("moments_created", 0) > 0
                    else:
                        detail = (
                            f"status={import_response.status_code}, "
                            f"body={import_response.text[:200]}"
                        )
                        passed = False
                    report.record("3. Import endurance-scene1.md", passed, detail)
                except httpx.HTTPError as exc:
                    report.record("3. Import endurance-scene1.md", False, str(exc))
        else:
            report.record("3. Import endurance-scene1.md", False, "skipped — no production id")

        # 4. Fetch acts/scenes/moments — Act 1 Scene 1 ordered
        scene_id: int | None = None
        moments: list[dict] = []
        if production_id is not None:
            try:
                acts = client.get(
                    f"{API_PREFIX}/productions/{production_id}/acts",
                    headers=_auth_headers(admin_token),
                )
                acts.raise_for_status()
                act_one = next((a for a in acts.json() if a["number"] == 1), None)
                scene_one = (
                    next((s for s in act_one["scenes"] if s["number"] == 1), None)
                    if act_one
                    else None
                )
                scene_id = scene_one["id"] if scene_one else None

                if scene_id is not None:
                    moments_response = client.get(
                        f"{API_PREFIX}/productions/{production_id}/scenes/{scene_id}/moments",
                        headers=_auth_headers(admin_token),
                    )
                    moments_response.raise_for_status()
                    moments = moments_response.json()

                sequence_numbers = [m["sequence_number"] for m in moments]
                expected_order = list(range(1, len(moments) + 1))
                ordered = sequence_numbers == expected_order
                first_is_stage = bool(moments) and moments[0]["moment_type"] == "stage_direction"
                has_dialogue = any(m["moment_type"] == "dialogue" for m in moments)
                passed = ordered and first_is_stage and has_dialogue and len(moments) > 1
                detail = (
                    f"{len(moments)} moments; "
                    f"first={moments[0]['moment_type'] if moments else 'none'}; "
                    f"ordered={ordered}"
                )
                report.record("4. Act 1 Scene 1 moments in order", passed, detail)
            except httpx.HTTPError as exc:
                report.record("4. Act 1 Scene 1 moments in order", False, str(exc))
        else:
            report.record("4. Act 1 Scene 1 moments in order", False, "skipped — no production id")

        # 5. Moment detail apostrophe (no mojibake) — WORSLEY "That'll" line
        if production_id is not None and moments:
            try:
                apostrophe_moment = next(
                    (m for m in moments if "That'll" in m.get("original_text", "")),
                    None,
                )
                if apostrophe_moment is None:
                    report.record(
                        "5. Apostrophe correct (no mojibake)",
                        False,
                        "no moment containing That'll found",
                    )
                else:
                    detail_response = client.get(
                        f"{API_PREFIX}/productions/{production_id}/moments/{apostrophe_moment['id']}",
                        headers=_auth_headers(admin_token),
                    )
                    detail_response.raise_for_status()
                    detail_data = detail_response.json()
                    text_blob = " ".join(
                        filter(
                            None,
                            [
                                detail_data.get("original_text"),
                                detail_data.get("parsed_text"),
                                detail_data.get("stage_direction"),
                                *(
                                    line.get("dialogue_text", "")
                                    for line in detail_data.get("dialogue", [])
                                ),
                            ],
                        )
                    )
                    has_apostrophe = "That'll" in text_blob
                    has_mojibake = any(marker in text_blob for marker in MOJIBAKE_MARKERS)
                    passed = has_apostrophe and not has_mojibake
                    snippet = text_blob[:80] + ("..." if len(text_blob) > 80 else "")
                    report.record(
                        "5. Apostrophe correct (no mojibake)",
                        passed,
                        f"snippet={snippet!r}",
                    )
            except httpx.HTTPError as exc:
                report.record("5. Apostrophe correct (no mojibake)", False, str(exc))
        else:
            report.record("5. Apostrophe correct (no mojibake)", False, "skipped — no moments")

        # 6. Invalid one-line import returns line_number
        try:
            invalid_title = "Smoke Invalid Import"
            existing_invalid = find_production(client, admin_token, invalid_title, None)
            if existing_invalid and not production_has_timeline(
                client, admin_token, existing_invalid["id"]
            ):
                invalid_id = existing_invalid["id"]
            else:
                delete_production_if_exists(client, admin_token, invalid_title, None)
                invalid_prod = client.post(
                    f"{API_PREFIX}/productions",
                    headers=_auth_headers(admin_token),
                    json={"title": invalid_title},
                )
                invalid_prod.raise_for_status()
                invalid_id = invalid_prod.json()["id"]
            bad_content = b"This is not valid script content.\n"
            bad_import = client.post(
                f"{API_PREFIX}/productions/{invalid_id}/import",
                headers=_auth_headers(admin_token),
                files={"file": ("bad.md", bad_content, "text/markdown")},
            )
            detail = bad_import.json().get("detail", {})
            if isinstance(detail, str):
                passed = False
                detail_text = detail
            else:
                passed = (
                    bad_import.status_code == 400
                    and detail.get("line_number") == 1
                    and bool(detail.get("message"))
                )
                detail_text = (
                    f"line_number={detail.get('line_number')}, "
                    f"message={detail.get('message')!r}"
                )
            report.record("6. Invalid import error with line_number", passed, detail_text)
        except httpx.HTTPError as exc:
            report.record("6. Invalid import error with line_number", False, str(exc))

        # 7. Director cannot POST /productions (403)
        try:
            director_token = login(client, "director", "director")
            blocked = client.post(
                f"{API_PREFIX}/productions",
                headers=_auth_headers(director_token),
                json={"title": "Director Blocked"},
            )
            report.record(
                "7. Director cannot POST /productions",
                blocked.status_code == 403,
                f"status={blocked.status_code}",
            )
        except httpx.HTTPError as exc:
            report.record("7. Director cannot POST /productions", False, str(exc))

        # 8. Actor can GET timeline
        if production_id is not None:
            try:
                actor_token = login(client, "actor", "actor")
                actor_acts = client.get(
                    f"{API_PREFIX}/productions/{production_id}/acts",
                    headers=_auth_headers(actor_token),
                )
                timeline_ok = actor_acts.status_code == 200 and len(actor_acts.json()) >= 1
                if timeline_ok and scene_id is not None:
                    actor_moments = client.get(
                        f"{API_PREFIX}/productions/{production_id}/scenes/{scene_id}/moments",
                        headers=_auth_headers(actor_token),
                    )
                    timeline_ok = actor_moments.status_code == 200 and len(actor_moments.json()) > 0
                report.record(
                    "8. Actor can GET timeline",
                    timeline_ok,
                    f"acts_status={actor_acts.status_code}",
                )
            except httpx.HTTPError as exc:
                report.record("8. Actor can GET timeline", False, str(exc))
        else:
            report.record("8. Actor can GET timeline", False, "skipped — no production id")

    return report


def main() -> int:
    if not FIXTURE_PATH.is_file():
        print(f"Fixture not found: {FIXTURE_PATH}", file=sys.stderr)
        return 1

    report = run_smoke_test()
    passed_count = sum(1 for check in report.checks if check.passed)
    total = len(report.checks)
    print()
    print(f"Result: {passed_count}/{total} checks passed")
    if report.all_passed:
        print("ALL CHECKS PASSED")
        return 0
    print("SOME CHECKS FAILED")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
