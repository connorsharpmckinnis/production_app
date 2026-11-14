"""Shared types for the rules-based suggestion engine."""

from dataclasses import dataclass, field
from typing import Literal

SubjectKind = Literal["character", "group"]
Severity = Literal["info", "warning"]


@dataclass(frozen=True)
class RuleSpec:
    id: str
    title: str
    supports_groups: bool = True
    look_ahead: int = 15


@dataclass(frozen=True)
class SuggestionSubject:
    kind: SubjectKind
    id: int
    name: str


@dataclass(frozen=True)
class SuggestionAction:
    kind: str
    moment_id: int
    character_id: int | None = None
    group_id: int | None = None
    user_id: int | None = None
    notes: str | None = None


@dataclass
class SuggestionDraft:
    rule_id: str
    severity: Severity
    title: str
    rationale: str
    anchor_moment_id: int
    speaking_moment_id: int | None
    scene_id: int
    subject: SuggestionSubject
    actions: list[SuggestionAction] = field(default_factory=list)
    fingerprint: str = ""


def make_fingerprint(
    *,
    rule_id: str,
    scene_id: int,
    subject_kind: SubjectKind,
    subject_id: int,
    anchor_moment_id: int,
) -> str:
    """Stable id for dedupe and dismiss (instance-scoped)."""
    return f"{rule_id}:scene:{scene_id}:{subject_kind}:{subject_id}:anchor:{anchor_moment_id}"
