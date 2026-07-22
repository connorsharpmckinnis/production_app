from typing import Literal

from pydantic import BaseModel, Field

FeedbackKind = Literal["bug", "idea"]


class FeedbackCreate(BaseModel):
    kind: FeedbackKind
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=8000)
    page_path: str | None = Field(default=None, max_length=500)
    user_agent: str | None = Field(default=None, max_length=500)


class FeedbackResponse(BaseModel):
    issue_number: int
    issue_url: str
