"""CLI entry point for database seeding."""

from app.config import get_settings
from app.db.seed import seed_database
from app.db.session import SessionLocal


def main() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        seed_database(db, settings)
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
