def make_pair(client, headers):
    d = client.post("/devices", json={"marca": "Apple", "modelo": "iPhone 11"}, headers=headers).json()
    p = client.post("/parts", json={"nome": "Bateria Decode", "categoria": "Bateria"}, headers=headers).json()
    return d, p


def test_compat_requires_admin(client, admin_headers, tech_headers):
    d, p = make_pair(client, admin_headers)
    body = {"device_id": d["id"], "part_id": p["id"], "notas": "ok"}
    assert client.post("/compatibilities", json=body).status_code == 401
    assert client.post("/compatibilities", json=body, headers=tech_headers).status_code == 403


def test_compat_create_returns_labels_and_filters(client, admin_headers):
    d, p = make_pair(client, admin_headers)
    d2 = client.post("/devices", json={"marca": "Samsung", "modelo": "S23"}, headers=admin_headers).json()
    r = client.post("/compatibilities", json={"device_id": d["id"], "part_id": p["id"], "notas": "n"}, headers=admin_headers)
    assert r.status_code == 201
    assert r.json()["device_label"] == "Apple iPhone 11"
    assert r.json()["part_nome"] == "Bateria Decode"
    client.post("/compatibilities", json={"device_id": d2["id"], "part_id": p["id"]}, headers=admin_headers)

    assert len(client.get("/compatibilities").json()) == 2
    assert len(client.get(f"/compatibilities?device_id={d['id']}").json()) == 1
    assert len(client.get(f"/compatibilities?part_id={p['id']}").json()) == 2


def test_compat_rejects_unknown_refs_and_duplicates(client, admin_headers):
    d, p = make_pair(client, admin_headers)
    assert client.post("/compatibilities", json={"device_id": 999, "part_id": p["id"]}, headers=admin_headers).status_code == 404
    assert client.post("/compatibilities", json={"device_id": d["id"], "part_id": 999}, headers=admin_headers).status_code == 404
    body = {"device_id": d["id"], "part_id": p["id"]}
    assert client.post("/compatibilities", json=body, headers=admin_headers).status_code == 201
    assert client.post("/compatibilities", json=body, headers=admin_headers).status_code == 409


def test_compat_update_and_delete(client, admin_headers):
    d, p = make_pair(client, admin_headers)
    c = client.post("/compatibilities", json={"device_id": d["id"], "part_id": p["id"]}, headers=admin_headers).json()
    r = client.put(f"/compatibilities/{c['id']}", json={"device_id": d["id"], "part_id": p["id"], "notas": "nova"}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["notas"] == "nova"
    assert client.delete(f"/compatibilities/{c['id']}", headers=admin_headers).status_code == 200
    assert client.get("/compatibilities").json() == []


def test_deleting_device_or_part_removes_its_compatibilities(client, admin_headers):
    d, p = make_pair(client, admin_headers)
    client.post("/compatibilities", json={"device_id": d["id"], "part_id": p["id"]}, headers=admin_headers)
    client.delete(f"/devices/{d['id']}", headers=admin_headers)
    assert client.get("/compatibilities").json() == []

    d, p = make_pair(client, admin_headers)
    client.post("/compatibilities", json={"device_id": d["id"], "part_id": p["id"]}, headers=admin_headers)
    client.delete(f"/parts/{p['id']}", headers=admin_headers)
    assert client.get("/compatibilities").json() == []


def test_ingest_compatibilities_and_bulk_save(client, admin_headers, tech_headers):
    payload = {
        "source_type": "text",
        "content": (
            "Galaxy A14 5G = compatível com Galaxy M14 5G (versão M146B)\n"
            "Poco X3 NFC / Poco X3 Pro"
        ),
        "category_hint": "Display",
        "auto_save": False,
    }
    assert client.post("/ingest_compatibilities", json=payload).status_code == 401
    assert client.post("/ingest_compatibilities", json=payload, headers=tech_headers).status_code == 403

    r = client.post("/ingest_compatibilities", json=payload, headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["items"]) >= 2
    assert data["saved_count"] == 0

    bulk_r = client.post(
        "/compatibilities/bulk_save",
        json={"items": data["items"]},
        headers=admin_headers,
    )
    assert bulk_r.status_code == 200
    saved = bulk_r.json()
    assert saved["saved_count"] >= 2

    all_compats = client.get("/compatibilities").json()
    assert len(all_compats) >= 2


