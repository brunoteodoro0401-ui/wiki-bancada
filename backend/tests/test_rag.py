import models
import rag


def populate(db):
    db.add_all([
        models.WikiArticle(target_device="iPhone 11", category="Alerta Químico",
                           ai_context_text="Não use calor excessivo na tela, mancha o LCD.", tags="iphone 11, display"),
        models.WikiArticle(target_device="Samsung (Geral)", category="Procedimento",
                           ai_context_text="Hard Reset: segure Power + Vol Menos.", tags="samsung, hard reset"),
    ])
    db.add(models.Device(marca="Apple", modelo="iPhone 11", opening_method="Frontal", has_flex_cable=True))
    db.commit()


def test_tokenize_strips_accents_plurals_and_stopwords():
    assert rag.tokenize("A Tela das Baterias, Diagnóstico!") == {"tela", "bateria", "diagnostico"}


def test_retrieve_ranks_relevant_first(db):
    populate(db)
    docs = rag.retrieve(db, "posso usar calor na tela do iPhone 11?")
    assert docs and docs[0]["type"] == "wiki" and "iPhone 11" in docs[0]["title"]
    assert all("Samsung" not in d["title"] for d in docs)


def test_retrieve_includes_device_opening_info(db):
    populate(db)
    docs = rag.retrieve(db, "como abrir o iphone 11")
    assert any(d["type"] == "device" for d in docs)


def test_retrieve_empty_when_nothing_matches(db):
    populate(db)
    assert rag.retrieve(db, "xyzzy quux") == []
    assert rag.retrieve(db, "a o de") == []


def test_ask_requires_login(client):
    assert client.post("/ask", json={"question": "calor no iphone 11"}).status_code == 401


def test_ask_validates_input(client, tech_headers):
    assert client.post("/ask", json={"question": "oi"}, headers=tech_headers).status_code == 422
    assert client.post("/ask", json={"question": "x" * 1001}, headers=tech_headers).status_code == 422


def test_ask_without_api_key_uses_retrieval(client, db, tech_headers, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("HF_API_KEY", raising=False)
    populate(db)
    r = client.post("/ask", json={"question": "calor na tela do iPhone 11"}, headers=tech_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "retrieval" and body["sources"]
    assert "GEMINI_API_KEY" in body["answer"] and "calor" in body["answer"]


def test_ask_no_match_does_not_call_llm(client, db, tech_headers, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    monkeypatch.setattr(rag, "call_llm", lambda p, **kw: (_ for _ in ()).throw(AssertionError("não deveria chamar")))
    populate(db)
    r = client.post("/ask", json={"question": "xyzzy quux plugh"}, headers=tech_headers)
    assert r.json()["sources"] == [] and "não tem informação" in r.json()["answer"]


def test_ask_with_llm_sends_context_and_returns_sources(client, db, tech_headers, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    captured = {}

    def fake_llm(prompt, **kw):
        captured["prompt"] = prompt
        return "Evite calor [1]."

    monkeypatch.setattr(rag, "call_llm", fake_llm)
    populate(db)
    r = client.post("/ask", json={"question": "calor na tela do iPhone 11"}, headers=tech_headers)
    body = r.json()
    assert body["mode"] == "llm" and body["answer"] == "Evite calor [1]."
    assert "mancha o LCD" in captured["prompt"] and "PERGUNTA" in captured["prompt"]
    assert body["follow_up_suggestions"]


def test_ask_conversational_history_carries_device_context(client, db, tech_headers, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    captured = {}

    def fake_llm(prompt, **kw):
        captured["prompt"] = prompt
        return "Sim, no iPhone 11 você deve abrir pela frontal com cuidado no cabo flex [1]."

    monkeypatch.setattr(rag, "call_llm", fake_llm)
    populate(db)
    # O usuário primeiro falou do iPhone 11, e na segunda pergunta diz apenas "e como faço para abrir ele?"
    r = client.post(
        "/ask",
        json={
            "question": "e como faço para abrir ele?",
            "history": [
                {"role": "user", "text": "Posso usar calor na tela do iPhone 11?"},
                {"role": "bot", "text": "Evite calor excessivo no LCD do iPhone 11."},
            ],
        },
        headers=tech_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "llm"
    assert any("iPhone 11" in s["title"] for s in body["sources"])
    assert "HISTÓRICO RECENTE DESTA CONVERSA NA BANCADA" in captured["prompt"]


def test_ai_settings_get_and_put(client, admin_headers, tech_headers):
    # Técnico pode ler configurações de modelos disponíveis
    r_get = client.get("/ai_settings", headers=tech_headers)
    assert r_get.status_code == 200
    assert "gemini" in r_get.json()["available_models"]
    assert "huggingface" in r_get.json()["available_models"]

    # Técnico não pode alterar chaves/configuração global no servidor
    assert client.put("/ai_settings", json={"provider": "huggingface"}, headers=tech_headers).status_code == 403

    # Admin pode alterar provedor e modelo do Hugging Face
    r_put = client.put(
        "/ai_settings",
        json={
            "provider": "huggingface",
            "hf_model": "Qwen/Qwen2.5-72B-Instruct",
        },
        headers=admin_headers,
    )
    assert r_put.status_code == 200
    assert r_put.json()["provider"] == "huggingface"
    assert r_put.json()["hf_model"] == "Qwen/Qwen2.5-72B-Instruct"


def test_ask_falls_back_when_llm_fails(client, db, tech_headers, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake")

    def boom(prompt, **kw):
        raise RuntimeError("timeout")

    monkeypatch.setattr(rag, "call_llm", boom)
    populate(db)
    r = client.post("/ask", json={"question": "calor na tela do iPhone 11"}, headers=tech_headers)
    assert r.status_code == 200
    assert r.json()["mode"] == "retrieval" and "indisponível" in r.json()["answer"]


def test_sources_crud_and_ingest_text(client, db, admin_headers, tech_headers, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("HF_API_KEY", raising=False)
    # Técnico não pode criar fonte confiável
    assert client.post("/sources", json={"nome": "ClanGSM", "url_or_domain": "clangsm.com.br"}, headers=tech_headers).status_code == 403
    # Admin cria fonte confiável
    r = client.post("/sources", json={"nome": "ClanGSM", "url_or_domain": "clangsm.com.br", "categoria": "Fórum"}, headers=admin_headers)
    assert r.status_code == 201
    sid = r.json()["id"]
    assert len(client.get("/sources").json()) == 1

    # Admin importa texto do Facebook/Fórum com auto_save=True
    ing = client.post(
        "/ingest",
        json={
            "source_type": "text",
            "content": "No Poco X3 Pro quando não liga, o defeito crônico é reballing de CPU e PMIC.",
            "target_device_hint": "Poco X3 Pro",
            "auto_save": True,
        },
        headers=admin_headers,
    )
    assert ing.status_code == 200
    data = ing.json()
    assert data["saved_count"] == 1
    assert data["articles"][0]["target_device"] == "Poco X3 Pro"

    # Remove a fonte
    assert client.delete(f"/sources/{sid}", headers=admin_headers).status_code == 200
