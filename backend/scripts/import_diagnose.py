"""Classify a script in a disposable in-memory database.

This never writes to the application database. Use it to inspect extracted
lines, classifications, or the first actionable import error.

Usage:
  uv run python scripts/import_diagnose.py ../fixtures/scripts/endurance-scene1.md
  uv run python scripts/import_diagnose.py "../fixtures/scripts/Endurance Scene 1.docx"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.db.base import Base
from app.db.seed import seed_database
from app.models import Act, Moment, MomentType, Organization, Production, Scene
from app.services.importer import ImportLineError, import_script
from app.services.importer.extract import extract_script
from app.services.importer.preprocessing import preprocess_lines


def _build_session():
    settings = Settings(
        _env_file=None,
        DATABASE_URL="sqlite://",
        SECRET_KEY="diagnose",
        ADMIN_USERNAME="admin",
        ADMIN_PASSWORD="admin",
        ORG_NAME="Diagnose Org",
        ENVIRONMENT="dev",
    )
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    seed_database(session, settings)
    return session


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Diagnose script classification without touching app data.",
    )
    parser.add_argument("script_path", type=Path, help="Path to a .md or .docx script")
    args = parser.parse_args(argv)

    path: Path = args.script_path
    if not path.is_file():
        print(f"File not found: {path}", file=sys.stderr)
        return 2

    content = path.read_bytes()
    extraction = extract_script(path.name, content)
    lines = preprocess_lines([item.text for item in extraction.lines])

    print(f"=== Import diagnose: {path.name} ({extraction.source_format}) ===\n")
    print("Extracted lines:")
    for index, (line, meta) in enumerate(
        zip(lines, extraction.lines, strict=True),
        start=1,
    ):
        style = f" style={meta.paragraph_style}" if meta.paragraph_style else ""
        preview = line if len(line) <= 100 else f"{line[:100]}..."
        print(f"  {index:4d}{style}: {preview}")

    db = _build_session()
    organization = db.query(Organization).first()
    production = Production(
        organization_id=organization.id,
        title="Diagnose Production",
    )
    db.add(production)
    db.commit()

    try:
        result = import_script(db, production, content, filename=path.name)
    except ImportLineError as exc:
        print(f"\nImport failed with {len(exc.issues)} issue(s):")
        for index, issue in enumerate(exc.issues, start=1):
            print(f"\n  [{index}] kind={issue.kind}")
            print(f"      format: {issue.source_format}")
            print(f"      line: {issue.line_number}")
            if issue.paragraph_number is not None:
                print(f"      paragraph: {issue.paragraph_number}")
            if issue.paragraph_style:
                print(f"      style: {issue.paragraph_style}")
            if issue.song_title:
                print(f"      song: {issue.song_title}")
            print(f"      content: {issue.line_content}")
            if issue.context_snippet:
                print("      context:")
                for snippet_line in issue.context_snippet.splitlines():
                    print(f"        {snippet_line}")
            print(f"      message: {issue.message}")
        db.close()
        return 1

    moment_types = {mt.id: mt.name for mt in db.query(MomentType).all()}
    scenes = (
        db.query(Scene)
        .join(Act)
        .filter(Act.production_id == production.id)
        .order_by(Act.sort_order, Scene.sort_order)
        .all()
    )
    print("\nImport summary:")
    print(f"  acts={result.acts_created}")
    print(f"  scenes={result.scenes_created}")
    print(f"  moments={result.moments_created}")
    print(f"  characters={result.characters_created}")
    print(f"  songs={result.songs_created}")
    print("\nMoment classifications:")
    for scene in scenes:
        print(f"  Scene {scene.number}: {scene.title}")
        moments = (
            db.query(Moment)
            .filter(Moment.scene_id == scene.id)
            .order_by(Moment.sequence_number)
            .all()
        )
        for moment in moments:
            kind = moment_types[moment.moment_type_id]
            text = moment.original_text
            if len(text) > 70:
                text = f"{text[:70]}..."
            print(f"    {moment.sequence_number:3d} [{kind:16s}] {text}")

    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
