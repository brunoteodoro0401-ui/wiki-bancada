import datetime as dt

import jwt

import security
from conftest import _make_user


def register(client, **over):
    body = {"nome": "Maria", "email": "maria@example.com", "senha": "senha1234", **over}
    return client.post("/auth/register", json=body)


def test_register_creates_technician_and_hides_password(client):
    r = register(client)
    assert r.status_code == 201
    body = r.json()
    assert body["role"] == "tecnico"
    assert "senha" not in body


def test_register_cannot_escalate_to_admin(client):
    r = register(client, role="admin")
    assert r.status_code == 201
    assert r.json()["role"] == "tecnico"


def test_password_is_stored_hashed(client, db):
    register(client)
    import models
    stored = db.query(models.User).one().senha
    assert stored != "senha1234" and stored.startswith("$2")


def test_register_duplicate_email_case_insensitive(client):
    assert register(client).status_code == 201
    assert register(client, email="MARIA@example.com").status_code == 409


def test_register_validation(client):
    assert register(client, senha="curta").status_code == 422
    assert register(client, email="nao-e-email").status_code == 422
    assert register(client, senha="é" * 40).status_code == 422  # > 72 bytes


def test_login_success_and_me(client):
    register(client)
    r = client.post("/auth/login", json={"email": "maria@example.com", "senha": "senha1234"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == "maria@example.com"


def test_login_wrong_password_and_unknown_user_same_error(client):
    register(client)
    a = client.post("/auth/login", json={"email": "maria@example.com", "senha": "errada123"})
    b = client.post("/auth/login", json={"email": "ninguem@example.com", "senha": "errada123"})
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_me_requires_valid_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers={"Authorization": "Bearer lixo"}).status_code == 401


def test_expired_token_rejected(client, db):
    user = _make_user(db, "x@example.com", "tecnico")
    token = jwt.encode(
        {"sub": str(user.id), "exp": dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1)},
        security.SECRET_KEY, algorithm=security.ALGORITHM,
    )
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_token_signed_with_other_key_rejected(client, db):
    user = _make_user(db, "x@example.com", "admin")
    token = jwt.encode({"sub": str(user.id), "role": "admin"}, "outra-chave-qualquer-1234567890abcd", algorithm="HS256")
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_users_list_admin_only(client, admin_headers, tech_headers):
    assert client.get("/users").status_code == 401
    assert client.get("/users", headers=tech_headers).status_code == 403
    r = client.get("/users", headers=admin_headers)
    assert r.status_code == 200 and len(r.json()) == 2


def test_admin_can_change_role_but_not_self_demote(client, db, admin_headers):
    tech = _make_user(db, "t2@example.com", "tecnico")
    r = client.put(f"/users/{tech.id}/role", json={"role": "admin"}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["role"] == "admin"
    me = client.get("/auth/me", headers=admin_headers).json()
    r = client.put(f"/users/{me['id']}/role", json={"role": "tecnico"}, headers=admin_headers)
    assert r.status_code == 400
    assert client.put(f"/users/{tech.id}/role", json={"role": "superuser"}, headers=admin_headers).status_code == 422


def test_demoted_admin_loses_access_immediately(client, db, admin_headers):
    # a role vem do banco, não do token
    import models
    db.query(models.User).filter_by(email="admin@example.com").one().role = "tecnico"
    db.commit()
    assert client.post("/devices", json={"marca": "X", "modelo": "Y"}, headers=admin_headers).status_code == 403
