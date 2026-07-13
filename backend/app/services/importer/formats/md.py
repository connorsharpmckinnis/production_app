"""Markdown script adapter — bytes to text lines."""

from __future__ import annotations

from app.services.importer.preprocessing import decode_script_bytes


def extract_md_lines(content: bytes) -> list[str]:
    """Decode Markdown bytes to lines (preprocess handles repair/unescape)."""
    text = decode_script_bytes(content)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text.split("\n")
