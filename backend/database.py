import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
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


_MIGRATION_COLUMNS = {
    "Devices": (
        ("model_code", "VARCHAR"),
        ("device_type", "VARCHAR"),
        ("opening_temp", "VARCHAR"),
        ("technical_notes", "TEXT"),
    ),
    "Parts": (
        ("part_code", "VARCHAR"),
        ("quality_tier", "VARCHAR"),
    ),
    "Compatibilities": (
        ("compatibility_type", "VARCHAR"),
    ),
    "Wiki_Articles": (
        ("severity", "VARCHAR"),
    ),
}

_MIGRATION_INDEXES = (
    'CREATE INDEX IF NOT EXISTS ix_compat_device_id ON "Compatibilities" (device_id)',
    'CREATE INDEX IF NOT EXISTS ix_compat_part_id ON "Compatibilities" (part_id)',
    'CREATE INDEX IF NOT EXISTS ix_devices_marca ON "Devices" (marca)',
    'CREATE INDEX IF NOT EXISTS ix_devices_model_code ON "Devices" (model_code)',
    'CREATE INDEX IF NOT EXISTS ix_devices_device_type ON "Devices" (device_type)',
    'CREATE INDEX IF NOT EXISTS ix_parts_categoria ON "Parts" (categoria)',
    'CREATE INDEX IF NOT EXISTS ix_parts_part_code ON "Parts" (part_code)',
)


def ensure_schema_columns(target_engine=None) -> None:
    """Adiciona colunas e índices ausentes com segurança em PostgreSQL e SQLite."""
    eng = target_engine or engine
    inspector = inspect(eng)
    existing_tables = set(inspector.get_table_names())
    with eng.begin() as conn:
        for table_name, cols in _MIGRATION_COLUMNS.items():
            if table_name not in existing_tables:
                continue
            current_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col_name, sql_type in cols:
                if col_name not in current_cols:
                    conn.execute(text(f'ALTER TABLE "{table_name}" ADD COLUMN {col_name} {sql_type}'))
        for ddl in _MIGRATION_INDEXES:
            conn.execute(text(ddl))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
