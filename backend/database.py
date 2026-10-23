import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

ENV_FILE = Path(__file__).parent / ".env"


def _read_database_url() -> str:
    # Em testes automatizados, usa sempre o banco em memória configurado no conftest
    if "PYTEST_CURRENT_TEST" in os.environ:
        return "sqlite:///./bancada.db"
    url = os.getenv("DATABASE_URL", "").strip()
    if not url and ENV_FILE.exists():
        for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == "DATABASE_URL":
                url = v.strip().strip('"').strip("'")
                break
    if not url:
        return "sqlite:///./bancada.db"
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    # Remove channel_binding=require (pode travar no PgBouncer/Windows)
    url = url.replace("&channel_binding=require", "").replace("?channel_binding=require&", "?")
    return url


SQLALCHEMY_DATABASE_URL = _read_database_url()
connect_args = (
    {"check_same_thread": False}
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    else {"prepare_threshold": None, "connect_timeout": 10}
)

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
