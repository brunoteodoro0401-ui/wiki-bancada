import pytest

DEVICE = {"marca": "Apple", "modelo": "iPhone 11", "opening_method": "Frontal", "has_flex_cable": True}
ARTICLE = {"target_device": "iPhone 11", "category": "Alerta", "ai_context_text": "Cuidado com calor.", "tags": "calor"}
PART = {"nome": "Tela iPhone 11", "categoria": "Display"}

RESOURCES = [
    ("devices", DEVICE, {"modelo": "iPhone 11 Pro"}),
    ("wiki_articles", ARTICLE, {"category": "Procedimento"}),
    ("parts", PART, {"nome": "Tela iPhone 11 OLED"}),
]


@pytest.mark.parametrize("path,body,change", RESOURCES)
def test_reads_are_public_writes_need_admin(client, tech_headers, path, body, change):
    assert client.get(f"/{path}").status_code == 200
    assert client.post(f"/{path}", json=body).status_code == 401
    assert client.post(f"/{path}", json=body, headers=tech_headers).status_code == 403


@pytest.mark.parametrize("path,body,change", RESOURCES)
def test_full_crud_as_admin(client, admin_headers, path, body, change):
    r = client.post(f"/{path}", json=body, headers=admin_headers)
    assert r.status_code == 201
    obj_id = r.json()["id"]

    assert client.get(f"/{path}/{obj_id}").json()["id"] == obj_id

    r = client.put(f"/{path}/{obj_id}", json={**body, **change}, headers=admin_headers)
    assert r.status_code == 200
    for k, v in change.items():
        assert r.json()[k] == v

    # sem token / como técnico não apaga
    assert client.delete(f"/{path}/{obj_id}").status_code == 401
    assert client.delete(f"/{path}/{obj_id}", headers=admin_headers).status_code == 200
    assert client.get(f"/{path}/{obj_id}").status_code == 404
    assert client.put(f"/{path}/{obj_id}", json=body, headers=admin_headers).status_code == 404
    assert client.delete(f"/{path}/{obj_id}", headers=admin_headers).status_code == 404


def test_device_validation(client, admin_headers):
    bad = [
        {**DEVICE, "opening_method": "Lateral"},
        {**DEVICE, "marca": ""},
        {"marca": "Apple"},
    ]
    for body in bad:
        assert client.post("/devices", json=body, headers=admin_headers).status_code == 422
    # opening_method é opcional
    assert client.post("/devices", json={"marca": "A", "modelo": "B"}, headers=admin_headers).status_code == 201


def test_wiki_validation(client, admin_headers):
    assert client.post("/wiki_articles", json={**ARTICLE, "ai_context_text": ""}, headers=admin_headers).status_code == 422
    assert client.post("/wiki_articles", json={"target_device": "X"}, headers=admin_headers).status_code == 422
