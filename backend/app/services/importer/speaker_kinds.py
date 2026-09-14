"""Resolve import speaker labels to Characters or Groups."""

from __future__ import annotations

from typing import Literal

from sqlalchemy.orm import Session

from app.models import Character, Group, Production
from app.services.importer.builtins import RECOMMENDED_GROUP_NAMES

SpeakerKind = Literal["character", "group"]


def default_speaker_kind(name: str) -> SpeakerKind:
    """Default kind when the client omits a speaker_kinds map entry."""
    if name.casefold() in RECOMMENDED_GROUP_NAMES:
        return "group"
    return "character"


def resolve_speaker_kinds(
    labels: list[str],
    speaker_kinds: dict[str, SpeakerKind] | None,
) -> dict[str, SpeakerKind]:
    """Return a kind for every label; unknown keys in the map are ignored."""
    resolved: dict[str, SpeakerKind] = {}
    for label in labels:
        if speaker_kinds and label in speaker_kinds:
            resolved[label] = speaker_kinds[label]
        else:
            resolved[label] = default_speaker_kind(label)
    return resolved


def get_or_create_character(
    db: Session,
    production: Production,
    characters: dict[str, Character],
    name: str,
) -> Character:
    if name not in characters:
        character = Character(production_id=production.id, name=name)
        db.add(character)
        db.flush()
        characters[name] = character
    return characters[name]


def get_or_create_group(
    db: Session,
    production: Production,
    groups: dict[str, Group],
    name: str,
) -> Group:
    if name not in groups:
        existing = (
            db.query(Group)
            .filter(Group.production_id == production.id, Group.name == name)
            .one_or_none()
        )
        if existing is not None:
            groups[name] = existing
        else:
            group = Group(production_id=production.id, name=name)
            db.add(group)
            db.flush()
            groups[name] = group
    return groups[name]
