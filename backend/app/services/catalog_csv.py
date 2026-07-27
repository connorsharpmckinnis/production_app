"""Shared helpers for production catalog CSV import (Phase 8)."""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session, joinedload

from app.models import (
    Act,
    Character,
    Costume,
    CueCategory,
    Prop,
    Scene,
    SetPiece,
    Song,
)
from app.schemas.catalog_csv import CatalogImportResult, CatalogImportRowError

MAX_CSV_BYTES = 1 * 1024 * 1024  # 1 MiB

PROPS_COLUMNS = ("name", "description", "notes")
PROPS_REQUIRED = ("name",)

SET_PIECES_COLUMNS = ("name", "mobile", "description")
SET_PIECES_REQUIRED = ("name",)

COSTUMES_COLUMNS = ("name", "character", "scene", "act", "description")
COSTUMES_REQUIRED = ("name", "character", "scene")

SONGS_COLUMNS = ("title", "composer", "lyricist", "description")
SONGS_REQUIRED = ("title",)

CUE_CATEGORIES_COLUMNS = ("name", "description")
CUE_CATEGORIES_REQUIRED = ("name",)

_ACT_SCENE_RE = re.compile(r"^Act\s+(\d+)\s*/\s*(.+)$", re.IGNORECASE)
# Shorthand like 2:1 or 2.1 → act number + scene number
_ACT_SCENE_SHORTHAND_RE = re.compile(r"^(\d+)\s*[:.]\s*(\d+)$")
_TRUE_VALUES = frozenset({"true", "1"})
_FALSE_VALUES = frozenset({"false", "0"})


class CatalogCsvError(ValueError):
    """Whole-file validation failure (reject the upload)."""


def normalize_key(value: str) -> str:
    """Unicode-safe duplicate / match key: trim + casefold."""
    return value.strip().casefold()


def optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text if text else None


def required_text(value: str | None, field_name: str) -> str:
    text = optional_text(value)
    if text is None:
        raise ValueError(f"Missing required value: {field_name}")
    return text


def parse_mobile(value: str | None) -> bool:
    """Accept case-insensitive true/false/1/0; blank defaults to false."""
    text = optional_text(value)
    if text is None:
        return False
    key = text.casefold()
    if key in _TRUE_VALUES:
        return True
    if key in _FALSE_VALUES:
        return False
    raise ValueError("mobile must be true, false, 1, or 0")


def template_csv(columns: tuple[str, ...] | list[str]) -> str:
    return ",".join(columns) + "\n"


def decode_csv_bytes(content: bytes) -> str:
    if len(content) > MAX_CSV_BYTES:
        raise CatalogCsvError("CSV file exceeds maximum size of 1 MiB")
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CatalogCsvError(
            "CSV file must be UTF-8 encoded (optional BOM allowed)",
        ) from exc


@dataclass
class ParsedCatalogCsv:
    rows: list[tuple[int, dict[str, str | None]]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def parse_catalog_csv(
    content: bytes,
    *,
    required_headers: tuple[str, ...] | list[str],
    known_headers: tuple[str, ...] | list[str],
) -> ParsedCatalogCsv:
    """Parse UTF-8 CSV bytes into normalized row dicts.

    Header names are matched case-insensitively after trim.
    Unknown columns are ignored and listed in warnings.
    Missing required headers raise CatalogCsvError.
    """
    text = decode_csv_bytes(content)
    if not text.strip():
        raise CatalogCsvError("CSV file is empty; a header row is required")

    reader = csv.reader(io.StringIO(text))
    try:
        raw_header = next(reader)
    except StopIteration as exc:
        raise CatalogCsvError("CSV file is empty; a header row is required") from exc

    if not any(cell.strip() for cell in raw_header):
        raise CatalogCsvError("CSV header row is missing or blank")

    known_by_key = {normalize_key(name): name for name in known_headers}
    required_keys = {normalize_key(name) for name in required_headers}

    column_map: dict[int, str] = {}
    seen_keys: set[str] = set()
    unknown: list[str] = []

    for index, cell in enumerate(raw_header):
        label = cell.strip()
        if not label:
            continue
        key = normalize_key(label)
        if key in known_by_key:
            if key in seen_keys:
                continue
            seen_keys.add(key)
            column_map[index] = known_by_key[key]
        else:
            unknown.append(label)

    missing = [
        name
        for name in required_headers
        if normalize_key(name) not in seen_keys
    ]
    if missing:
        raise CatalogCsvError(
            "Missing required CSV header(s): " + ", ".join(missing)
        )

    warnings: list[str] = []
    if unknown:
        warnings.append(
            "Ignored unknown column(s): " + ", ".join(unknown)
        )

    rows: list[tuple[int, dict[str, str | None]]] = []
    for row_number, cells in enumerate(reader, start=2):
        if not cells or not any(cell.strip() for cell in cells):
            rows.append((row_number, {}))
            continue
        values: dict[str, str | None] = {name: None for name in known_headers}
        for index, canonical in column_map.items():
            if index < len(cells):
                values[canonical] = cells[index]
            else:
                values[canonical] = None
        rows.append((row_number, values))

    return ParsedCatalogCsv(rows=rows, warnings=warnings)


def _result(
    *,
    created: int,
    skipped: int,
    errors: list[CatalogImportRowError],
    warnings: list[str],
) -> CatalogImportResult:
    return CatalogImportResult(
        created=created,
        skipped=skipped,
        errors=errors,
        warnings=warnings,
    )


def _row_error(row: int, message: str) -> CatalogImportRowError:
    return CatalogImportRowError(row=row, message=message)


def import_props_csv(
    db: Session,
    production_id: int,
    content: bytes,
) -> CatalogImportResult:
    parsed = parse_catalog_csv(
        content,
        required_headers=PROPS_REQUIRED,
        known_headers=PROPS_COLUMNS,
    )
    existing = {
        normalize_key(prop.name)
        for prop in db.query(Prop).filter(Prop.production_id == production_id).all()
    }
    seen = set(existing)
    to_create: list[Prop] = []
    skipped = 0
    errors: list[CatalogImportRowError] = []

    for row_number, values in parsed.rows:
        if not values:
            errors.append(_row_error(row_number, "Blank or malformed row"))
            continue
        try:
            name = required_text(values.get("name"), "name")
        except ValueError as exc:
            errors.append(_row_error(row_number, str(exc)))
            continue
        key = normalize_key(name)
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        to_create.append(
            Prop(
                production_id=production_id,
                name=name,
                description=optional_text(values.get("description")),
                notes=optional_text(values.get("notes")),
            )
        )

    if to_create:
        db.add_all(to_create)
        db.commit()

    return _result(
        created=len(to_create),
        skipped=skipped,
        errors=errors,
        warnings=parsed.warnings,
    )


def import_set_pieces_csv(
    db: Session,
    production_id: int,
    content: bytes,
) -> CatalogImportResult:
    parsed = parse_catalog_csv(
        content,
        required_headers=SET_PIECES_REQUIRED,
        known_headers=SET_PIECES_COLUMNS,
    )
    existing = {
        normalize_key(piece.name)
        for piece in db.query(SetPiece)
        .filter(SetPiece.production_id == production_id)
        .all()
    }
    seen = set(existing)
    to_create: list[SetPiece] = []
    skipped = 0
    errors: list[CatalogImportRowError] = []

    for row_number, values in parsed.rows:
        if not values:
            errors.append(_row_error(row_number, "Blank or malformed row"))
            continue
        try:
            name = required_text(values.get("name"), "name")
            mobile = parse_mobile(values.get("mobile"))
        except ValueError as exc:
            errors.append(_row_error(row_number, str(exc)))
            continue
        key = normalize_key(name)
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        to_create.append(
            SetPiece(
                production_id=production_id,
                name=name,
                mobile=mobile,
                description=optional_text(values.get("description")),
            )
        )

    if to_create:
        db.add_all(to_create)
        db.commit()

    return _result(
        created=len(to_create),
        skipped=skipped,
        errors=errors,
        warnings=parsed.warnings,
    )


def import_songs_csv(
    db: Session,
    production_id: int,
    content: bytes,
) -> CatalogImportResult:
    parsed = parse_catalog_csv(
        content,
        required_headers=SONGS_REQUIRED,
        known_headers=SONGS_COLUMNS,
    )
    existing = {
        normalize_key(song.title)
        for song in db.query(Song).filter(Song.production_id == production_id).all()
    }
    seen = set(existing)
    to_create: list[Song] = []
    skipped = 0
    errors: list[CatalogImportRowError] = []

    for row_number, values in parsed.rows:
        if not values:
            errors.append(_row_error(row_number, "Blank or malformed row"))
            continue
        try:
            title = required_text(values.get("title"), "title")
        except ValueError as exc:
            errors.append(_row_error(row_number, str(exc)))
            continue
        key = normalize_key(title)
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        to_create.append(
            Song(
                production_id=production_id,
                title=title,
                composer=optional_text(values.get("composer")),
                lyricist=optional_text(values.get("lyricist")),
                description=optional_text(values.get("description")),
            )
        )

    if to_create:
        db.add_all(to_create)
        db.commit()

    return _result(
        created=len(to_create),
        skipped=skipped,
        errors=errors,
        warnings=parsed.warnings,
    )


def import_cue_categories_csv(
    db: Session,
    production_id: int,
    content: bytes,
) -> CatalogImportResult:
    parsed = parse_catalog_csv(
        content,
        required_headers=CUE_CATEGORIES_REQUIRED,
        known_headers=CUE_CATEGORIES_COLUMNS,
    )
    existing = {
        normalize_key(category.name)
        for category in db.query(CueCategory)
        .filter(CueCategory.production_id == production_id)
        .all()
    }
    seen = set(existing)
    to_create: list[CueCategory] = []
    skipped = 0
    errors: list[CatalogImportRowError] = []

    for row_number, values in parsed.rows:
        if not values:
            errors.append(_row_error(row_number, "Blank or malformed row"))
            continue
        try:
            name = required_text(values.get("name"), "name")
        except ValueError as exc:
            errors.append(_row_error(row_number, str(exc)))
            continue
        key = normalize_key(name)
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        to_create.append(
            CueCategory(
                production_id=production_id,
                name=name,
                description=optional_text(values.get("description")),
            )
        )

    if to_create:
        db.add_all(to_create)
        db.commit()

    return _result(
        created=len(to_create),
        skipped=skipped,
        errors=errors,
        warnings=parsed.warnings,
    )


def _resolve_character(
    characters: list[Character],
    raw_name: str,
) -> Character:
    key = normalize_key(raw_name)
    matches = [character for character in characters if normalize_key(character.name) == key]
    if not matches:
        raise ValueError(f"Unknown character: {raw_name.strip()}")
    if len(matches) > 1:
        raise ValueError(f"Ambiguous character: {raw_name.strip()}")
    return matches[0]


def _scene_ui_title(scene: Scene) -> str:
    """Stored scene title as shown in the UI (empty string when untitled)."""
    return scene.title or ""


def _resolve_scene_by_numbers(
    scenes: list[Scene],
    act_number: int,
    scene_number: int,
    *,
    label: str,
) -> Scene:
    matches = [
        scene
        for scene in scenes
        if scene.act.number == act_number and scene.number == scene_number
    ]
    if not matches:
        raise ValueError(f"Unknown scene: {label}")
    if len(matches) > 1:
        raise ValueError(f"Ambiguous scene: {label}")
    return matches[0]


def resolve_scene_for_costume(
    scenes: list[Scene],
    raw_scene: str,
    *,
    raw_act: str | None = None,
) -> Scene:
    """Resolve costume CSV scene by title, ``Act N / Title``, ``2:1``, or act+scene columns."""
    act_value = optional_text(raw_act)
    scene_value = optional_text(raw_scene)

    # Separate act + scene number columns (e.g. act=2, scene=1).
    if act_value is not None:
        if scene_value is None:
            raise ValueError("Missing required value: scene")
        if not act_value.isdigit() or not scene_value.isdigit():
            raise ValueError(
                "When act is provided, act and scene must be numbers "
                f"(got act={act_value!r}, scene={scene_value!r})"
            )
        act_number = int(act_value)
        scene_number = int(scene_value)
        return _resolve_scene_by_numbers(
            scenes,
            act_number,
            scene_number,
            label=f"{act_number}:{scene_number}",
        )

    if scene_value is None:
        raise ValueError("Missing required value: scene")

    shorthand = _ACT_SCENE_SHORTHAND_RE.match(scene_value)
    if shorthand is not None:
        act_number = int(shorthand.group(1))
        scene_number = int(shorthand.group(2))
        return _resolve_scene_by_numbers(
            scenes,
            act_number,
            scene_number,
            label=scene_value,
        )

    qualified = _ACT_SCENE_RE.match(scene_value)
    if qualified is not None:
        act_number = int(qualified.group(1))
        title_key = normalize_key(qualified.group(2))
        matches = [
            scene
            for scene in scenes
            if scene.act.number == act_number
            and normalize_key(_scene_ui_title(scene)) == title_key
        ]
        if not matches:
            raise ValueError(f"Unknown scene: {scene_value}")
        if len(matches) > 1:
            raise ValueError(f"Ambiguous scene: {scene_value}")
        return matches[0]

    title_key = normalize_key(scene_value)
    matches = [
        scene
        for scene in scenes
        if normalize_key(_scene_ui_title(scene)) == title_key
    ]
    if not matches:
        raise ValueError(f"Unknown scene: {scene_value}")
    if len(matches) > 1:
        raise ValueError(
            f"Ambiguous scene title matches multiple scenes: {scene_value}"
        )
    return matches[0]


def import_costumes_csv(
    db: Session,
    production_id: int,
    content: bytes,
) -> CatalogImportResult:
    parsed = parse_catalog_csv(
        content,
        required_headers=COSTUMES_REQUIRED,
        known_headers=COSTUMES_COLUMNS,
    )
    characters = (
        db.query(Character).filter(Character.production_id == production_id).all()
    )
    scenes = (
        db.query(Scene)
        .join(Act)
        .options(joinedload(Scene.act))
        .filter(Act.production_id == production_id)
        .all()
    )
    existing_costumes = (
        db.query(Costume).filter(Costume.production_id == production_id).all()
    )
    seen: set[tuple[str, int, int]] = {
        (normalize_key(costume.name), costume.character_id, costume.scene_id)
        for costume in existing_costumes
    }
    to_create: list[Costume] = []
    skipped = 0
    errors: list[CatalogImportRowError] = []

    for row_number, values in parsed.rows:
        if not values:
            errors.append(_row_error(row_number, "Blank or malformed row"))
            continue
        try:
            name = required_text(values.get("name"), "name")
            character_name = required_text(values.get("character"), "character")
            character = _resolve_character(characters, character_name)
            scene = resolve_scene_for_costume(
                scenes,
                values.get("scene") or "",
                raw_act=values.get("act"),
            )
        except ValueError as exc:
            errors.append(_row_error(row_number, str(exc)))
            continue

        key = (normalize_key(name), character.id, scene.id)
        if key in seen:
            skipped += 1
            continue
        seen.add(key)
        to_create.append(
            Costume(
                production_id=production_id,
                character_id=character.id,
                scene_id=scene.id,
                name=name,
                description=optional_text(values.get("description")),
            )
        )

    if to_create:
        db.add_all(to_create)
        db.commit()

    return _result(
        created=len(to_create),
        skipped=skipped,
        errors=errors,
        warnings=parsed.warnings,
    )
