class ImportLineError(Exception):
    """Raised when the importer cannot classify a script line."""

    def __init__(self, line_number: int, line_content: str, message: str) -> None:
        self.line_number = line_number
        self.line_content = line_content
        self.message = message
        super().__init__(f"Line {line_number}: {message}")

    def to_dict(self) -> dict[str, str | int]:
        content = self.line_content
        if len(content) > 200:
            content = content[:200] + "..."
        return {
            "line_number": self.line_number,
            "line_content": content,
            "message": self.message,
        }
