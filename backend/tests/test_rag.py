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
    populate(db)
    r = client.post("/ask", json={"question": "calor na tela do iPhone 11"}, headers=tech_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "retrieval" and body["sources"]
    assert "GEMINI_API_KEY" in body["answer"] and "calor" in body["answer"]


def test_ask_no_match_does_not_call_llm(client, db, tech_headers, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    monkeypatch.setattr(rag, "call_llm", lambda p: (_ for _ in ()).throw(AssertionError("não deveria chamar")))
    populate(db)
    r = client.post("/ask", json={"question": "xyzzy quux plugh"}, headers=tech_headers)
    assert r.json()["sources"] == [] and "não tem informação" in r.json()["answer"]


def test_ask_with_llm_sends_context_and_returns_sources(client, db, tech_headers, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake")
    captured = {}

    def fake_llm(prompt):
        captured["prompt"] = prompt
        return "Evite calor [1]."

    monkeypatch.setattr(rag, "call_llm", fake_llm)
    populate(db)
    r = client.post("/ask", json={"question": "calor na tela do iPhone 11"}, headers=tech_headers)
    body = r.json()
    assert body["mode"] == "llm" and body["answer"] == "Evite calor [1]."
    assert "mancha o LCD" in captured["prompt"] and "PERGUNTA" in captured["prompt"]


def test_ask_falls_back_when_llm_fails(client, db, tech_headers, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake")

    def boom(prompt):
        raise RuntimeError("timeout")

    monkeypatch.setattr(rag, "call_llm", boom)
    populate(db)
    r = client.post("/ask", json={"question": "calor na tela do iPhone 11"}, headers=tech_headers)
    assert r.status_code == 200
    assert r.json()["mode"] == "retrieval" and "indisponível" in r.json()["answer"]
