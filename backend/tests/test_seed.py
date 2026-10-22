import pytest

import models
import seed


def test_seeded_admin_can_log_in_with_default_email(client, db, monkeypatch):
    # Regressão: o e-mail padrão já foi um domínio reservado (.local) que o login rejeitava.
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.setenv("ADMIN_PASSWORD", "senha-do-admin-123")
    seed.seed_admin(db)
    db.commit()
    admin = db.query(models.User).filter_by(role="admin").one()
    r = client.post("/auth/login", json={"email": admin.email, "senha": "senha-do-admin-123"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"


def test_seed_admin_rejects_invalid_email(db, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "admin@bancada.local")
    monkeypatch.setenv("ADMIN_PASSWORD", "senha-do-admin-123")
    with pytest.raises(SystemExit):
        seed.seed_admin(db)


def test_seed_admin_rejects_short_password(db, monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "dono@example.com")
    monkeypatch.setenv("ADMIN_PASSWORD", "curta")
    with pytest.raises(SystemExit):
        seed.seed_admin(db)


def test_seed_is_idempotent(db, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD", "senha-do-admin-123")
    for _ in range(2):
        seed.seed_articles(db)
        seed.seed_catalog(db)
        seed.seed_admin(db)
        db.commit()
    assert db.query(models.WikiArticle).count() == 6
    assert db.query(models.Device).count() == 7
    assert db.query(models.Part).count() == 3
    assert db.query(models.Compatibility).count() == 2
    assert db.query(models.User).filter_by(role="admin").count() == 1
