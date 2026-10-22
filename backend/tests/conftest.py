import os

os.environ["JWT_SECRET"] = "segredo-de-teste-com-32-bytes-ou-mais-0123456789"  # antes de importar security
os.environ.pop("GEMINI_API_KEY", None)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models
from database import Base, get_db
from main import app
from security import hash_password

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture
def db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def _override():
        yield db

    app.dependency_overrides[get_db] = _override
    yield TestClient(app)
    app.dependency_overrides.clear()


def _make_user(db, email, role, senha="senha1234"):
    user = models.User(nome=email.split("@")[0], email=email, senha=hash_password(senha), role=role)
    db.add(user)
    db.commit()
    return user


def _login(client, email, senha="senha1234"):
    r = client.post("/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def admin_headers(client, db):
    _make_user(db, "admin@example.com", "admin")
    return _login(client, "admin@example.com")


@pytest.fixture
def tech_headers(client, db):
    _make_user(db, "tech@example.com", "tecnico")
    return _login(client, "tech@example.com")
