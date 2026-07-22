from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import require_authenticated
from app.config import Settings, get_settings
from app.models import User
from app.schemas.feedback import FeedbackCreate, FeedbackResponse
from app.services.github_issues import GitHubIssueError, build_issue_body, create_github_issue

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    body: FeedbackCreate,
    user: User = Depends(require_authenticated),
    settings: Settings = Depends(get_settings),
) -> FeedbackResponse:
    if not settings.GITHUB_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "In-app feedback is not configured. "
                "Set GITHUB_TOKEN (and optionally GITHUB_REPO) on the server."
            ),
        )

    display_name = f"{user.first_name} {user.last_name}".strip() or user.username
    email_part = f", {user.email}" if user.email else ""
    submitter_line = f"User: @{user.username} ({display_name}{email_part})"

    issue_body = build_issue_body(
        kind=body.kind,
        description=body.description,
        submitter_line=submitter_line,
        page_path=body.page_path,
        user_agent=body.user_agent,
    )

    try:
        number, html_url = create_github_issue(
            token=settings.GITHUB_TOKEN,
            repo=settings.GITHUB_REPO,
            title=body.title,
            body=issue_body,
            kind=body.kind,
        )
    except GitHubIssueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    return FeedbackResponse(issue_number=number, issue_url=html_url)
