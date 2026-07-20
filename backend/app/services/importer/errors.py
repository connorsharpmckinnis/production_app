"""Import failure types: one or more issues, then full rollback."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ImportIssue:
    """One actionable problem found while scanning a script."""

    line_number: int
    line_content: str
    message: str
    source_format: str | None = None
    paragraph_number: int | None = None
    paragraph_style: str | None = None
    context_snippet: str | None = None
    kind: str = "line"  # "line" | "song"
    song_title: str | None = None

    def to_dict(self) -> dict[str, str | int]:
        content = self.line_content
        if len(content) > 200:
            content = content[:200] + "..."
        payload: dict[str, str | int] = {
            "line_number": self.line_number,
            "line_content": content,
            "message": self.message,
            "kind": self.kind,
        }
        if self.source_format is not None:
            payload["source_format"] = self.source_format
        if self.paragraph_number is not None:
            payload["paragraph_number"] = self.paragraph_number
        if self.paragraph_style is not None:
            payload["paragraph_style"] = self.paragraph_style
        if self.context_snippet is not None:
            payload["context_snippet"] = self.context_snippet
        if self.song_title is not None:
            payload["song_title"] = self.song_title
        return payload


class ImportLineError(Exception):
    """Raised when import cannot complete; includes one or more issues."""

    def __init__(self, issues: ImportIssue | list[ImportIssue]) -> None:
        if isinstance(issues, ImportIssue):
            issues = [issues]
        if not issues:
            raise ValueError("ImportLineError requires at least one issue")
        self.issues = issues
        first = issues[0]
        # Convenience accessors for the first issue (tests / diagnose).
        self.line_number = first.line_number
        self.line_content = first.line_content
        self.source_format = first.source_format
        self.paragraph_number = first.paragraph_number
        self.paragraph_style = first.paragraph_style
        self.context_snippet = first.context_snippet
        if len(issues) == 1:
            self.message = first.message
            summary = f"Line {first.line_number}: {first.message}"
        else:
            self.message = f"Import failed with {len(issues)} issues"
            summary = self.message
        super().__init__(summary)

    def to_dict(self) -> dict[str, object]:
        return {
            "message": self.message,
            "errors": [issue.to_dict() for issue in self.issues],
        }
