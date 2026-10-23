"""Assistente de bancada: RAG simples (recuperação lexical) + LLM opcional (Gemini).

Sem GEMINI_API_KEY o sistema continua útil: devolve as dicas mais relevantes da
base (modo "retrieval"). Com a chave, o contexto recuperado é enviado ao Gemini
(modo "llm"), que responde apenas com base nele.
"""
import os
import re
import unicodedata
from pathlib import Path
from typing import Dict, List

import httpx
from sqlalchemy.orm import Session

import models

ENV_FILE = Path(__file__).parent / ".env"
DEFAULT_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"]


def get_config(name: str, default: str = "") -> str:
    """Lê variável do ambiente ou, fora de testes, do arquivo backend/.env em tempo real."""
    val = os.getenv(name)
    if val:
        return val.strip()
    if "PYTEST_CURRENT_TEST" not in os.environ and ENV_FILE.exists():
        for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip() == name:
                return v.strip().strip('"').strip("'") or default
    return default


def _sync_db_settings(db: Session) -> None:
    """Se GEMINI_API_KEY não estiver no ambiente local/Render, busca na tabela App_Settings do banco."""
    if "PYTEST_CURRENT_TEST" in os.environ or get_config("GEMINI_API_KEY"):
        return
    try:
        row = db.get(models.AppSetting, "gemini_api_key")
        if row and row.value:
            os.environ["GEMINI_API_KEY"] = row.value.strip()
        mrow = db.get(models.AppSetting, "gemini_model")
        if mrow and mrow.value:
            os.environ["GEMINI_MODEL"] = mrow.value.strip()
    except Exception:
        pass


STOPWORDS = {
    "a", "o", "e", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
    "um", "uma", "uns", "umas", "para", "por", "com", "sem", "que", "se", "ao",
    "como", "qual", "quais", "meu", "minha", "esta", "esse", "essa", "isso", "eu",
    "ou", "foi", "ser", "tem", "ta", "to", "pra", "pro", "mais", "muito",
}

SYSTEM_PROMPT = (
    "Você é o assistente técnico de uma bancada de manutenção de celulares. "
    "Responda em português, de forma objetiva e prática, usando SOMENTE as informações "
    "do CONTEXTO fornecido. Se o contexto não cobrir a pergunta, diga claramente que a "
    "base ainda não tem essa informação e recomende cautela, sem inventar procedimentos. "
    "Cite as fontes usando [1], [2]..."
)


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if unicodedata.category(c) != "Mn").lower()


def tokenize(text: str) -> set:
    out = set()
    for tok in re.findall(r"[a-z0-9]+", _norm(text or "")):
        if tok in STOPWORDS:
            continue
        if len(tok) > 3 and tok.endswith("s"):  # plural simples
            tok = tok[:-1]
        out.add(tok)
    return out


def build_documents(db: Session) -> List[Dict]:
    docs: List[Dict] = []
    for a in db.query(models.WikiArticle).all():
        docs.append({
            "type": "wiki", "id": a.id,
            "title": f"{a.target_device} — {a.category or 'Dica'}",
            "head": a.target_device,
            "text": a.ai_context_text,
            "extra": a.tags or "",
        })
    for d in db.query(models.Device).all():
        abertura = d.opening_method or "não informada"
        flex = "possui cabo flex sensível na abertura" if d.has_flex_cable else "sem alerta de flex"
        docs.append({
            "type": "device", "id": d.id,
            "title": f"{d.marca} {d.modelo}",
            "head": f"{d.marca} {d.modelo}",
            "text": f"Abertura {abertura}; {flex}.",
            "extra": "abertura abrir desmontar",
        })
    rows = (
        db.query(models.Compatibility, models.Device, models.Part)
        .join(models.Device, models.Compatibility.device_id == models.Device.id)
        .join(models.Part, models.Compatibility.part_id == models.Part.id)
        .all()
    )
    for c, d, p in rows:
        docs.append({
            "type": "compatibility", "id": c.id,
            "title": f"Compatibilidade: {p.nome} × {d.marca} {d.modelo}",
            "head": f"{d.marca} {d.modelo} {p.nome}",
            "text": c.notas or f"{p.nome} é compatível com {d.marca} {d.modelo}.",
            "extra": p.categoria or "",
        })
    return docs


def retrieve(db: Session, question: str, k: int = 5) -> List[Dict]:
    q = tokenize(question)
    if not q:
        return []
    scored = []
    for doc in build_documents(db):
        head = tokenize(doc["head"])
        body = tokenize(doc["text"]) | tokenize(doc["extra"])
        score = 2 * len(q & head) + len(q & body)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda s: s[0], reverse=True)
    return [d for _, d in scored[:k]]


def build_prompt(question: str, docs: List[Dict]) -> str:
    ctx = "\n".join(f"[{i}] ({d['title']}) {d['text']}" for i, d in enumerate(docs, 1))
    return f"CONTEXTO:\n{ctx}\n\nPERGUNTA DO TÉCNICO: {question}"


def call_llm(prompt: str) -> str:
    """Chama a API REST do Gemini com fallback automático de modelo."""
    key = get_config("GEMINI_API_KEY")
    preferred = get_config("GEMINI_MODEL", DEFAULT_MODEL)
    candidates = [preferred, *[m for m in FALLBACK_MODELS if m != preferred]]

    last_exc: Exception | None = None
    for model in candidates:
        try:
            resp = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": key},
                json={
                    "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                    "contents": [{"parts": [{"text": prompt}]}],
                },
                timeout=25,
            )
            if resp.status_code in (404, 429, 503):
                last_exc = RuntimeError(f"{model}: HTTP {resp.status_code}")
                continue
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as exc:
            last_exc = exc
            continue
    raise last_exc or RuntimeError("Falha ao consultar Gemini")


def _retrieval_answer(docs: List[Dict], note: str) -> str:
    lines = [note, ""]
    for i, d in enumerate(docs, 1):
        lines.append(f"[{i}] {d['title']}: {d['text']}")
    return "\n".join(lines)


def answer(db: Session, question: str) -> Dict:
    _sync_db_settings(db)
    docs = retrieve(db, question)
    sources = [{"type": d["type"], "id": d["id"], "title": d["title"]} for d in docs]

    if not docs:
        return {
            "answer": "A base ainda não tem informação sobre isso. Proceda com cautela e, "
                      "se resolver o caso, cadastre a dica na Wiki.",
            "mode": "retrieval",
            "sources": [],
        }

    if get_config("GEMINI_API_KEY"):
        try:
            return {"answer": call_llm(build_prompt(question, docs)), "mode": "llm", "sources": sources}
        except Exception:  # rede, cota, chave inválida, resposta inesperada...
            note = "A IA está indisponível no momento. Dicas mais relevantes da base:"
    else:
        note = "IA não configurada (defina GEMINI_API_KEY). Dicas mais relevantes da base:"

    return {"answer": _retrieval_answer(docs, note), "mode": "retrieval", "sources": sources}
