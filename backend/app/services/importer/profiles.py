"""Validated configuration for layout-aware script imports."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


ImportActionType = Literal[
    "ignore",
    "set_act",
    "set_scene",
    "stage_direction",
    "speaker",
    "dialogue",
    "song_header",
    "song_attribution",
    "lyric",
    "continue_previous",
    "inline_dialogue",
]


class PdfOptions(BaseModel):
    """PDF page and line-extraction options."""

    start_page: int = Field(default=1, ge=1)
    end_page: int | None = Field(default=None, ge=1)
    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validate_page_range(self) -> "PdfOptions":
        if self.end_page is not None and self.end_page < self.start_page:
            raise ValueError("end_page must be greater than or equal to start_page")
        return self


class SpeakerOptions(BaseModel):
    """Profile-specific speaker rules which do not affect legacy imports."""

    require_all_caps: bool = True
    allow_parentheses: bool = False
    model_config = {"extra": "forbid"}


class RulePredicates(BaseModel):
    """Predicates combined with AND within one mapping rule."""

    text_equals: str | None = None
    text_starts_with: str | None = None
    text_contains: str | None = None
    case_sensitive: bool = False
    regex_match: str | None = Field(default=None, max_length=500)
    is_all_caps: bool | None = None
    is_wrapped_in_parens: bool | None = None
    word_count_lte: int | None = Field(default=None, ge=0)
    char_count_lte: int | None = Field(default=None, ge=0)

    x0_lte: float | None = None
    x0_gte: float | None = None
    x0_between: tuple[float, float] | None = None
    indent_gte: float | None = None
    font_size_gte: float | None = None
    font_size_lte: float | None = None
    is_bold: bool | None = None
    is_italic: bool | None = None

    previous_was: list[str] | None = None
    inside_song_block: bool | None = None
    inside_parenthetical_block: bool | None = None
    page_gte: int | None = Field(default=None, ge=1)
    page_lte: int | None = Field(default=None, ge=1)
    model_config = {"extra": "forbid"}

    @field_validator("regex_match")
    @classmethod
    def validate_safe_regex(cls, value: str | None) -> str | None:
        if value is None:
            return value
        try:
            re.compile(value)
        except re.error as exc:
            raise ValueError(f"invalid regular expression: {exc}") from exc
        # Python's stdlib regex engine has no portable timeout. Keep profiles
        # cross-platform by rejecting the highest-risk constructs instead.
        if re.search(r"\)(?:[+*]|\{\d*,?\d*\})", value):
            raise ValueError("quantified groups are not allowed in import-profile regexes")
        if re.search(r"\(\?(?:[=!]|<[=!])", value) or re.search(r"\\[1-9]", value):
            raise ValueError("lookarounds and backreferences are not allowed")
        return value

    @model_validator(mode="after")
    def validate_ranges_and_content(self) -> "RulePredicates":
        configured = self.model_dump(exclude={"case_sensitive"}, exclude_none=True)
        if not configured:
            raise ValueError("each rule needs at least one predicate")
        if self.x0_between is not None and self.x0_between[0] > self.x0_between[1]:
            raise ValueError("x0_between lower bound must not exceed upper bound")
        return self


class RuleAction(BaseModel):
    """A safe classification action; no profile-supplied code is executed."""

    type: ImportActionType
    number_capture: str | int | None = None
    title_capture: str | int | None = None
    text_capture: str | int | None = None
    literal_number: int | None = Field(default=None, ge=1)
    literal_title: str | None = None
    strip_outer_parens: bool = False
    end_song_block: bool = False
    model_config = {"extra": "forbid"}


class ImportRule(BaseModel):
    """One ordered first-match-wins mapping rule."""

    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=120)
    priority: int = 0
    enabled: bool = True
    scope: Literal["line", "span"] = "line"
    match: RulePredicates
    action: RuleAction
    model_config = {"extra": "forbid"}


class ImportProfileDefinition(BaseModel):
    """Portable profile body accepted by preview, commit, and persistence APIs."""

    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    version: int = Field(default=1, ge=1)
    source_formats: list[Literal["pdf", "md", "docx"]] = Field(
        default_factory=lambda: ["pdf"],
        min_length=1,
    )
    pdf: PdfOptions = Field(default_factory=PdfOptions)
    speakers: SpeakerOptions = Field(default_factory=SpeakerOptions)
    rules: list[ImportRule] = Field(default_factory=list)
    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def validate_unique_rule_ids(self) -> "ImportProfileDefinition":
        rule_ids = [rule.id for rule in self.rules]
        if len(rule_ids) != len(set(rule_ids)):
            raise ValueError("rule ids must be unique within a profile")
        return self

