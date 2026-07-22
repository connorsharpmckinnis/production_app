"""Create GitHub Issues via the REST API (stdlib urllib — no extra dependency)."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Literal

FeedbackKind = Literal["bug", "idea"]

_LABEL_BY_KIND: dict[FeedbackKind, list[str]] = {
    "bug": ["bug"],
    "idea": ["enhancement"],
}


class GitHubIssueError(Exception):
    """Raised when GitHub rejects or fails an issue create request."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def build_issue_body(
    *,
    kind: FeedbackKind,
    description: str,
    submitter_line: str,
    page_path: str | None,
    user_agent: str | None,
) -> str:
    """Build a short issue body for in-app feedback (not the GitHub web templates)."""
    heading = "**Describe the bug**" if kind == "bug" else "**Idea**"
    sections = [heading, description.strip()]

    meta_lines = [
        "",
        "---",
        "",
        "**Submitted from the app**",
        f"- {submitter_line}",
    ]
    if page_path:
        meta_lines.append(f"- Page: `{page_path}`")
    if user_agent:
        meta_lines.append(f"- Browser: `{user_agent}`")

    return "\n".join([*sections, *meta_lines])


def create_github_issue(
    *,
    token: str,
    repo: str,
    title: str,
    body: str,
    kind: FeedbackKind,
) -> tuple[int, str]:
    """
    Create an issue on the given repo.

    Returns (issue_number, html_url).
    """
    repo = repo.strip().strip("/")
    if "/" not in repo:
        raise GitHubIssueError("GITHUB_REPO must look like owner/name")

    url = f"https://api.github.com/repos/{repo}/issues"
    payload = json.dumps(
        {
            "title": title.strip(),
            "body": body,
            "labels": _LABEL_BY_KIND[kind],
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "production-app-feedback",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = _read_error_detail(exc)
        raise GitHubIssueError(
            f"GitHub API error ({exc.code}): {detail}",
            status_code=exc.code,
        ) from exc
    except urllib.error.URLError as exc:
        raise GitHubIssueError(f"Could not reach GitHub: {exc.reason}") from exc

    number = data.get("number")
    html_url = data.get("html_url")
    if not isinstance(number, int) or not isinstance(html_url, str):
        raise GitHubIssueError("GitHub response missing issue number or url")
    return number, html_url


def _read_error_detail(exc: urllib.error.HTTPError) -> str:
    try:
        raw = exc.read().decode("utf-8")
        payload = json.loads(raw)
        message = payload.get("message")
        if isinstance(message, str) and message:
            return message
        return raw[:300] if raw else exc.reason
    except Exception:
        return str(exc.reason)
