import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.db.base import Base
from app.db.session import get_db
from app.main import app


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        DATABASE_URL="sqlite://",
        SECRET_KEY="test-secret-key",
        ADMIN_USERNAME="admin",
        ADMIN_PASSWORD="admin",
        ORG_NAME="Test Organization",
        ENVIRONMENT="dev",
    )


@pytest.fixture
def db_engine(test_settings: Settings):
    engine = create_engine(
        test_settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine) -> Session:
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_engine, test_settings: Settings) -> TestClient:
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    get_settings.cache_clear()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    get_settings.cache_clear()

    if "TEST_DATABASE_URL" in os.environ:
        del os.environ["TEST_DATABASE_URL"]
