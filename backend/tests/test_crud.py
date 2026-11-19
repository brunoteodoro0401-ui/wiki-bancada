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


def test_service_orders_require_login(client):
    for method, url in [
        ("get", "/service_orders"),
        ("get", "/service_orders/storage_info"),
        ("post", "/service_orders"),
        ("put", "/service_orders/1"),
        ("delete", "/service_orders/1"),
        ("post", "/service_orders/restore"),
    ]:
        kwargs = {"json": {}} if method in ("post", "put") else {}
        assert getattr(client, method)(url, **kwargs).status_code == 401, (method, url)


def test_service_orders_number_not_reused_after_delete(client, tech_headers):
    client.headers.update(tech_headers)
    ids = []
    for _ in range(2):
        r = client.post("/service_orders", json={"device_model": "iPhone 11"})
        assert r.status_code == 201
        ids.append(r.json())
    assert [o["os_number"] for o in ids] == ["OS-0001", "OS-0002"]
    assert client.delete(f"/service_orders/{ids[0]['id']}").status_code == 200
    r = client.post("/service_orders", json={"device_model": "iPhone 12"})
    assert r.json()["os_number"] == "OS-0003"


def test_service_orders_lifecycle_and_restore(client, tech_headers):
    client.headers.update(tech_headers)
    # 1) Abre uma O.S. com IMEI
    r_create = client.post(
        "/service_orders",
        json={
            "os_number": "OS-0100",
            "status": "aberta",
            "stage": "Entrada (Pré-Reparo)",
            "client_name": "João Silva",
            "client_phone": "11999999999",
            "device_model": "Apple iPhone 13 Pro",
            "imei": "354891109988776",
            "statuses": {"biometria_faceid": "defeito", "tela_touch": "ok"},
            "notes": "Aparelho caiu",
        },
    )
    assert r_create.status_code == 201
    order = r_create.json()
    oid = order["id"]
    assert order["os_number"] == "OS-0100"
    assert order["imei"] == "354891109988776"
    assert order["status"] == "aberta"
    assert order["closed_at"] is None

    # 2) Edita e encerra a mesma O.S.
    r_close = client.put(
        f"/service_orders/{oid}",
        json={
            "os_number": "OS-0100",
            "status": "encerrada",
            "stage": "Saída (Pós-Reparo)",
            "client_name": "João Silva",
            "device_model": "Apple iPhone 13 Pro",
            "imei": "354891109988776",
            "closure_notes": "Reparo concluído com sucesso",
            "statuses": {"biometria_faceid": "ok", "tela_touch": "ok"},
        },
    )
    assert r_close.status_code == 200
    closed_order = r_close.json()
    assert closed_order["status"] == "encerrada"
    assert closed_order["closed_at"] is not None

    # 3) Restaura lote de O.S. de backup
    r_restore = client.post(
        "/service_orders/restore",
        json={
            "orders": [
                {
                    "os_number": "OS-0200",
                    "status": "aberta",
                    "device_model": "Samsung Galaxy A54",
                    "imei": "359999000011112",
                    "statuses": {},
                }
            ]
        },
    )
    assert r_restore.status_code == 200
    assert r_restore.json()["restored_count"] == 1

    all_orders = client.get("/service_orders").json()
    assert len(all_orders) == 2

    info = client.get("/service_orders/storage_info").json()
    assert info["total_orders"] == 2
    assert "local_folder_path" in info



def test_service_orders_avoids_duplicate_os_number_collision(client, tech_headers):
    client.headers.update(tech_headers)
    r1 = client.post("/service_orders", json={"os_number": "OS-0050", "device_model": "Galaxy A54"})
    r2 = client.post("/service_orders", json={"os_number": "OS-0050", "device_model": "Moto G84"})
    assert r1.status_code == 201 and r2.status_code == 201
    assert r1.json()["os_number"] == "OS-0050"
    assert r2.json()["os_number"] == "OS-0051"
