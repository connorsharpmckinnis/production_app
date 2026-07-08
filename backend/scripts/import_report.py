"""Run import against endurance-scene1.md and print summary statistics."""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import Settings
from app.db.base import Base
from app.db.seed import seed_database
from app.models import Act, Character, Dialogue, Moment, MomentType, Production, Scene, Song, StageDirection
from app.services.importer import import_script


def main() -> None:
    settings = Settings(
        DATABASE_URL="sqlite://",
        SECRET_KEY="report",
        ADMIN_USERNAME="admin",
        ADMIN_PASSWORD="admin",
        ORG_NAME="Report Org",
        ENVIRONMENT="dev",
    )
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    seed_database(db, settings)
    from app.models import Organization

    org = db.query(Organization).first()
    production = Production(organization_id=org.id, title="Endurance", season="2026")
    db.add(production)
    db.commit()

    fixture = (
        Path(__file__).resolve().parents[2]
        / "fixtures"
        / "scripts"
        / "endurance-scene1.md"
    )
    result = import_script(db, production, fixture.read_bytes())

    print("=== Import Results: endurance-scene1.md ===\n")
    print(f"Acts:       {result.acts_created}")
    print(f"Scenes:     {result.scenes_created}")
    print(f"Moments:    {result.moments_created}")
    print(f"Characters: {result.characters_created}")
    print(f"Songs:      {result.songs_created}")
    print()

    db.refresh(production)
    print(f"Production title: {production.title}")
    print(f"Production author: {production.author}")
    print()

    act = db.query(Act).one()
    scene = db.query(Scene).one()
    print(f"Act {act.number}: {act.title}")
    print(f"Scene {scene.number}: {scene.title}")
    print()

    print("Songs:")
    for song in db.query(Song).order_by(Song.id):
        desc = f" (description: {len(song.description or '')} chars)" if song.description else ""
        print(f"  - {song.title}{desc}")
    print()

    print("Characters:")
    for char in db.query(Character).order_by(Character.name):
        print(f"  - {char.name}")
    print()

    moment_types = {mt.id: mt.name for mt in db.query(MomentType).all()}
    type_counts: dict[str, int] = {}
    moments = (
        db.query(Moment)
        .filter(Moment.scene_id == scene.id)
        .order_by(Moment.sequence_number)
        .all()
    )
    for m in moments:
        name = moment_types[m.moment_type_id]
        type_counts[name] = type_counts.get(name, 0) + 1

    print("Moment types:")
    for name, count in sorted(type_counts.items()):
        print(f"  - {name}: {count}")
    print()

    print("First 10 moments:")
    for m in moments[:10]:
        mt = moment_types[m.moment_type_id]
        text = m.original_text[:70] + ("..." if len(m.original_text) > 70 else "")
        print(f"  {m.sequence_number:3d} [{mt:18s}] {text}")

    print()
    print("Sample mojibake repair (dialogue with apostrophe):")
    for m in moments:
        if "That'll" in m.original_text or "That'll" in (m.parsed_text or ""):
            print(f"  seq {m.sequence_number}: {m.original_text[:80]}")
            break

    dialogue_count = db.query(Dialogue).count()
    sd_count = db.query(StageDirection).count()
    print()
    print(f"Dialogue rows: {dialogue_count}")
    print(f"Stage direction rows: {sd_count}")

    db.close()


if __name__ == "__main__":
    main()
