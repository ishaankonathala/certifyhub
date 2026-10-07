"""Shared pytest fixtures."""

import os
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

# Configure test environment before importing application modules
os.environ["CELERY_TASK_ALWAYS_EAGER"] = "true"
os.environ["DATABASE_URL"] = "sqlite://"

from app.config import get_settings

get_settings.cache_clear()

from app.database import Base, get_db
from app.main import app
from app.tasks import certificate_tasks
from app.tasks.celery_app import celery_app

celery_app.conf.task_always_eager = True
celery_app.conf.task_eager_propagates = True


@pytest.fixture()
def db_engine(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Shared in-memory SQLite engine for API + Celery eager tasks."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Celery tasks open their own sessions — point them at the test DB
    monkeypatch.setattr("app.database.SessionLocal", TestingSessionLocal)
    monkeypatch.setattr(certificate_tasks, "SessionLocal", TestingSessionLocal)

    settings = get_settings()
    settings.certificates_dir = tmp_path / "certificates"
    settings.certificates_dir.mkdir(parents=True, exist_ok=True)

    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def db_session(db_engine) -> Generator[Session, None, None]:
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_engine) -> Generator[TestClient, None, None]:
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def override_get_db() -> Generator[Session, None, None]:
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def sample_template_payload() -> dict:
    return {
        "name": "internship-completion",
        "title": "Certificate of Completion",
        "body_text": "has successfully completed the Backend Engineering Internship Program.",
        "issuer_name": "CertifyHub Academy",
    }


@pytest.fixture()
def created_template(client: TestClient, sample_template_payload: dict) -> dict:
    response = client.post("/api/v1/templates", json=sample_template_payload)
    assert response.status_code == 201
    return response.json()
