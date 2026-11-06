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


def test_ensure_owner_admin_preserves_existing_custom_password(db):
    from security import hash_password, verify_password

    seed.ensure_owner_admin(db)
    db.commit()
    owner = db.query(models.User).filter_by(email=seed.OWNER_EMAIL).one()
    assert owner.role == "admin"

    # Se o admin alterar sua senha no banco, um novo boot não deve sobrescrevê-la
    custom_hash = hash_password("nova-senha-segura-999")
    owner.senha = custom_hash
    db.commit()

    seed.ensure_owner_admin(db)
    db.commit()
    db.refresh(owner)
    assert verify_password("nova-senha-segura-999", owner.senha)


def test_compat_master_list_is_complete_and_idempotent(db):
    import seed_compat_master as master

    first = seed.seed_compat_master_list(db)
    db.commit()
    assert first["parts"] == len(master.MASTER_GROUPS) == 93
    assert first["devices"] > 50 and first["compatibilities"] > 150

    # Busca por nome de peça devolve os modelos da lista mestra
    part = db.query(models.Part).filter_by(nome="Bateria EB-BA505ABU").one()
    links = db.query(models.Compatibility).filter_by(part_id=part.id).all()
    labels = sorted(db.get(models.Device, c.device_id).modelo for c in links)
    assert labels == ["Galaxy A20", "Galaxy A30", "Galaxy A30s", "Galaxy A50"]

    # Nota geral e nota por modelo
    a31 = db.query(models.Part).filter_by(nome="Bateria EB-BA315ABY").one()
    assert "5G" in db.query(models.Compatibility).filter_by(part_id=a31.id).first().notas
    g20 = db.query(models.Device).filter_by(modelo="Moto G20").one()
    screen = db.query(models.Part).filter_by(nome="Tela, Tampa Traseira e Chassi Moto G10 / G20 / G30").one()
    assert "90Hz" in db.query(models.Compatibility).filter_by(part_id=screen.id, device_id=g20.id).one().notas

    # Rodar de novo não duplica nada
    second = seed.seed_compat_master_list(db)
    assert second == {"devices": 0, "parts": 0, "compatibilities": 0, "articles": 0}



def _models_of(db, part_name):
    part = db.query(models.Part).filter_by(nome=part_name).one()
    links = db.query(models.Compatibility).filter_by(part_id=part.id).all()
    return sorted(db.get(models.Device, c.device_id).modelo for c in links)


def test_compat_master_inventory_nov_2026(db):
    seed.seed_compat_master_list(db)
    db.commit()

    assert _models_of(db, "Bateria QB50") == ["Moto G84"]
    assert _models_of(db, "Bateria BN5A") == ["Poco M3 Pro", "Redmi Note 10 5G"]
    assert _models_of(db, "Placa Sub de Carga Redmi 14C / Poco C75") == ["Poco C75", "Redmi 14C"]
    assert "Moto G31" in _models_of(db, "Bateria JK50")
    assert _models_of(db, "Tela Frontal Moto G13 / G23 / G34 / G45 / G53 — sem aro") == [
        "Moto G13", "Moto G23", "Moto G34", "Moto G45", "Moto G53"]
    a14_4g = db.query(models.Part).filter_by(nome="Placa Sub de Carga Galaxy A14 4G").one()
    assert "5G" in db.query(models.Compatibility).filter_by(part_id=a14_4g.id).one().notas


def test_compat_master_renames_old_part_instead_of_duplicating(db):
    old = models.Part(nome="Tela Frontal Moto G13 / G23 — sem aro", categoria="Display")
    db.add(old)
    db.commit()
    old_id = old.id

    seed.seed_compat_master_list(db)
    db.commit()

    assert db.query(models.Part).filter_by(nome="Tela Frontal Moto G13 / G23 — sem aro").count() == 0
    renamed = db.query(models.Part).filter_by(nome="Tela Frontal Moto G13 / G23 / G34 / G45 / G53 — sem aro").one()
    assert renamed.id == old_id



def test_seed_all_devices_is_complete_and_idempotent(db):
    first = seed.seed_all_devices(db)
    db.commit()
    assert first >= 370
    assert db.query(models.Device).count() >= 370

    # Segunda execução não duplica
    second = seed.seed_all_devices(db)
    assert second == 0
