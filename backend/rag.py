"""Assistente de bancada: RAG simples (recuperação lexical) + Busca Híbrida Web + Importador Inteligente.

Sem GEMINI_API_KEY o sistema continua útil: devolve as dicas mais relevantes da
base (modo "retrieval"). Com a chave, o contexto recuperado é enviado ao Gemini
(modo "llm"), ou combinado com busca na web e fontes confiáveis (modo "llm_web").
"""
import html
import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

import httpx
from sqlalchemy.orm import Session

import models

ENV_FILE = Path(__file__).parent / ".env"
DEFAULT_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-2.5-flash"]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


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

HYBRID_WEB_SYSTEM_PROMPT = (
    "Você é um mestre especialista em manutenção de celulares e microsoldagem de bancada. "
    "Responda em português de forma clara, técnica, passo a passo e segura para o técnico. "
    "Priorize as informações da BASE INTERNA DA BANCADA quando presentes e complemente com os "
    "RESULTADOS DA INTERNET / FONTES CONFIÁVEIS fornecidos e seu conhecimento técnico verificado. "
    "Sempre destaque alertas de risco (cabos flex, temperatura, álcool isopropílico em LCD, Face ID, "
    "aterramento, curto em PMIC) e cite as fontes com [1], [2] ou [Web 1], [Web 2]."
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


def call_llm(prompt: str, system_prompt: str = SYSTEM_PROMPT) -> str:
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
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
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


def _clean_html_text(raw_html: str) -> str:
    cleaned = re.sub(r"<(script|style|noscript|svg|header|footer|nav)[^>]*>.*?</\1>", " ", raw_html, flags=re.S | re.I)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = html.unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def search_web(
    query: str,
    trusted_domains: Optional[List[str]] = None,
    strict_domains: bool = False,
    max_results: int = 6,
) -> List[Dict[str, str]]:
    """Busca na internet via DuckDuckGo Lite, priorizando fontes confiáveis de reparo."""
    search_q = query.strip()
    if "reparo" not in search_q.lower() and "celular" not in search_q.lower() and "manutenção" not in search_q.lower():
        search_q = f"{search_q} reparo manutenção celular"

    if trusted_domains and strict_domains:
        clean_domains = [
            re.sub(r"^https?://(www\.)?", "", d.strip()).split("/")[0]
            for d in trusted_domains if d.strip()
        ][:5]
        if clean_domains:
            site_filter = " OR ".join(f"site:{d}" for d in clean_domains)
            search_q = f"{query.strip()} ({site_filter})"

    results: List[Dict[str, str]] = []
    try:
        resp = httpx.post(
            "https://lite.duckduckgo.com/lite/",
            data={"q": search_q},
            headers={"User-Agent": USER_AGENT},
            timeout=12,
            follow_redirects=True,
        )
        if resp.status_code == 200:
            links = re.findall(
                r'<a[^>]+href="([^"]+)"[^>]*class=[\'"]result-link[\'"][^>]*>(.*?)</a>',
                resp.text,
                flags=re.S | re.I,
            )
            if not links:
                links = re.findall(
                    r'<a[^>]+class=[\'"]result-link[\'"][^>]*href="([^"]+)"[^>]*>(.*?)</a>',
                    resp.text,
                    flags=re.S | re.I,
                )
            snippets = re.findall(
                r'<td[^>]*class=[\'"]result-snippet[\'"][^>]*>(.*?)</td>',
                resp.text,
                flags=re.S | re.I,
            )
            for idx, (url, raw_title) in enumerate(links[:max_results]):
                title = _clean_html_text(raw_title)
                snippet = _clean_html_text(snippets[idx]) if idx < len(snippets) else ""
                if url.startswith("//"):
                    url = "https:" + url
                if title and url.startswith("http"):
                    results.append({"title": title, "url": url, "snippet": snippet})
    except Exception:
        pass
    return results


def _extract_youtube_id(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url.strip())
        host = (parsed.hostname or "").lower()
        if "youtu.be" in host:
            return parsed.path.strip("/").split("/")[0] or None
        if "youtube.com" in host:
            if parsed.path.startswith("/watch"):
                return parse_qs(parsed.query).get("v", [None])[0]
            parts = [p for p in parsed.path.split("/") if p]
            if len(parts) >= 2 and parts[0] in ("shorts", "embed", "live"):
                return parts[1]
    except Exception:
        pass
    return None


def fetch_youtube_content(url: str) -> Tuple[str, List[Dict[str, str]]]:
    """Extrai título, autor, descrição e legendas (se públicas) de um vídeo do YouTube."""
    vid = _extract_youtube_id(url)
    canonical_url = f"https://www.youtube.com/watch?v={vid}" if vid else url.strip()
    parts: List[str] = []
    refs: List[Dict[str, str]] = []
    title = "Vídeo do YouTube"

    try:
        oembed = httpx.get(
            "https://www.youtube.com/oembed",
            params={"url": canonical_url, "format": "json"},
            headers={"User-Agent": USER_AGENT},
            timeout=10,
        )
        if oembed.status_code == 200:
            data = oembed.json()
            title = data.get("title") or title
            author = data.get("author_name") or ""
            parts.append(f"Título do Vídeo: {title}")
            if author:
                parts.append(f"Canal: {author}")
    except Exception:
        pass

    try:
        page = httpx.get(
            canonical_url,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"},
            timeout=12,
            follow_redirects=True,
        )
        if page.status_code == 200:
            desc_match = re.search(r'"shortDescription":"((?:\\.|[^"\\])*)"', page.text)
            if desc_match:
                try:
                    desc = json.loads(f'"{desc_match.group(1)}"')
                except Exception:
                    desc = desc_match.group(1)
                if desc:
                    parts.append(f"Descrição do Vídeo:\n{desc[:3500]}")

            cap_match = re.search(r'"captionTracks":(\[.*?\])', page.text)
            if cap_match:
                try:
                    tracks = json.loads(cap_match.group(1))
                    if tracks and isinstance(tracks, list):
                        base_url = tracks[0].get("baseUrl")
                        if base_url:
                            cap_resp = httpx.get(base_url, headers={"User-Agent": USER_AGENT}, timeout=10)
                            if cap_resp.status_code == 200:
                                transcript = _clean_html_text(cap_resp.text)
                                if transcript:
                                    parts.append(f"Transcrição / Legenda:\n{transcript[:6000]}")
                except Exception:
                    pass
    except Exception:
        pass

    refs.append({"title": title, "url": canonical_url})

    if len("\n".join(parts)) < 200 and title != "Vídeo do YouTube":
        web_hits = search_web(title, max_results=4)
        for h in web_hits:
            parts.append(f"Referência relacionada ({h['title']}): {h['snippet']}")
            refs.append({"title": h["title"], "url": h["url"]})

    extracted = "\n\n".join(parts).strip() or f"Vídeo do YouTube: {canonical_url}"
    return extracted, refs


def fetch_url_content(url: str) -> Tuple[str, List[Dict[str, str]]]:
    """Lê o conteúdo textual de uma página web/fórum ou vídeo do YouTube."""
    if _extract_youtube_id(url):
        return fetch_youtube_content(url)

    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    try:
        resp = httpx.get(
            clean_url,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"},
            timeout=15,
            follow_redirects=True,
        )
        resp.raise_for_status()
        title_match = re.search(r"<title[^>]*>(.*?)</title>", resp.text, flags=re.S | re.I)
        title = _clean_html_text(title_match.group(1)) if title_match else clean_url
        body_text = _clean_html_text(resp.text)[:8000]
        return f"Fonte: {title} ({clean_url})\n\nConteúdo:\n{body_text}", [{"title": title[:120], "url": clean_url}]
    except Exception as exc:
        return f"URL informada: {clean_url} (Aviso na leitura direta: {exc})", [{"title": clean_url, "url": clean_url}]


def extract_wiki_articles_from_content(
    raw_text: str,
    target_device_hint: Optional[str] = None,
    source_label: str = "",
) -> List[Dict[str, str]]:
    """Extrai dicas técnicas estruturadas para a Wiki usando Gemini (com fallback heurístico)."""
    hint = (target_device_hint or "").strip()
    if get_config("GEMINI_API_KEY"):
        prompt = (
            "Analise o material abaixo sobre manutenção/reparo de celulares e extraia de 1 a 4 "
            "dicas técnicas práticas e verificáveis para a Wiki de Bancada.\n"
            f"Dica de aparelho (se aplicável): {hint or 'Identifique o modelo/marca no texto ou use Geral'}\n"
            f"Origem: {source_label or 'Importação Técnica'}\n\n"
            "Responda ESTRITAMENTE com um array JSON válido (sem blocos markdown extras se possível), onde cada item tem:\n"
            '- "target_device": nome do aparelho ou linha (ex: "iPhone 13 Pro", "Xiaomi Poco X3 Pro", "Samsung Linha A")\n'
            '- "category": uma entre "Procedimento", "Diagnóstico", "Microsoldagem", "Alerta Químico", "Compatibilidade", "Resolução de Problemas"\n'
            '- "ai_context_text": explicação técnica clara e direta (sintoma, causa, solução e cuidados na bancada)\n'
            '- "tags": palavras-chave separadas por vírgula em minúsculas\n\n'
            f"MATERIAL:\n{raw_text[:7000]}"
        )
        try:
            raw_reply = call_llm(
                prompt,
                system_prompt="Você é um engenheiro especialista em manutenção de smartphones que estrutura conhecimento técnico em JSON.",
            )
            match = re.search(r"\[.*\]", raw_reply, flags=re.S)
            if match:
                parsed = json.loads(match.group(0))
                out = []
                for item in parsed:
                    if isinstance(item, dict) and item.get("ai_context_text"):
                        out.append({
                            "target_device": str(item.get("target_device") or hint or "Geral").strip()[:100],
                            "category": str(item.get("category") or "Procedimento").strip()[:80],
                            "ai_context_text": str(item.get("ai_context_text")).strip(),
                            "tags": str(item.get("tags") or "reparo, bancada").strip()[:200],
                        })
                if out:
                    return out
        except Exception:
            pass

    # Fallback determinístico quando sem chave Gemini ou falha de rede
    device = hint or "Geral"
    for candidate in ("iPhone 15", "iPhone 14", "iPhone 13", "iPhone 12", "iPhone 11", "iPhone",
                      "Poco X3 Pro", "Poco M3", "Redmi Note", "Xiaomi",
                      "Galaxy S23", "Galaxy A54", "Galaxy A14", "Samsung", "Moto G", "Motorola"):
        if candidate.lower() in raw_text.lower() and not hint:
            device = candidate
            break

    clean_summary = re.sub(r"\s+", " ", raw_text).strip()[:900]
    tags = ", ".join(list(tokenize(f"{device} {clean_summary}"))[:8]) or "reparo, bancada"
    return [{
        "target_device": device,
        "category": "Procedimento",
        "ai_context_text": clean_summary,
        "tags": tags,
    }]


def ingest_content(
    db: Session,
    source_type: str,
    content: str,
    target_device_hint: Optional[str] = None,
    use_trusted_sources_only: bool = False,
    auto_save: bool = False,
) -> Dict:
    """Processa URL, YouTube, Busca na Web ou Texto do Facebook/WhatsApp e gera dicas para a Wiki."""
    _sync_db_settings(db)
    trusted_rows = db.query(models.TrustedSource).filter_by(ativo=True).all()
    trusted_domains = [r.url_or_domain for r in trusted_rows]

    refs: List[Dict[str, str]] = []
    if source_type == "youtube":
        extracted_text, refs = fetch_youtube_content(content)
    elif source_type == "url":
        extracted_text, refs = fetch_url_content(content)
    elif source_type == "search":
        hits = search_web(
            content,
            trusted_domains=trusted_domains,
            strict_domains=use_trusted_sources_only,
            max_results=6,
        )
        if not hits and use_trusted_sources_only:
            hits = search_web(content, trusted_domains=None, strict_domains=False, max_results=6)
        refs = [{"title": h["title"], "url": h["url"]} for h in hits]
        if hits:
            extracted_text = "\n\n".join(
                f"Fonte: {h['title']} ({h['url']})\nResumo: {h['snippet']}" for h in hits
            )
        else:
            extracted_text = f"Assunto pesquisado: {content}"
    else:
        extracted_text = content.strip()

    articles = extract_wiki_articles_from_content(
        extracted_text,
        target_device_hint=target_device_hint,
        source_label=source_type,
    )

    saved_count = 0
    if auto_save:
        for art in articles:
            exists = db.query(models.WikiArticle).filter_by(
                target_device=art["target_device"],
                ai_context_text=art["ai_context_text"],
            ).first()
            if not exists:
                db.add(models.WikiArticle(**art))
                saved_count += 1
        db.commit()

    return {
        "extracted_text_preview": extracted_text[:1200],
        "source_references": refs[:6],
        "articles": articles,
        "saved_count": saved_count,
    }


def _retrieval_answer(docs: List[Dict], note: str) -> str:
    lines = [note, ""]
    for i, d in enumerate(docs, 1):
        lines.append(f"[{i}] {d['title']}: {d['text']}")
    return "\n".join(lines)


def answer(db: Session, question: str, use_web: bool = False) -> Dict:
    _sync_db_settings(db)
    docs = retrieve(db, question)
    sources = [{"type": d["type"], "id": d["id"], "title": d["title"]} for d in docs]

    if use_web:
        trusted_rows = db.query(models.TrustedSource).filter_by(ativo=True).all()
        trusted_domains = [r.url_or_domain for r in trusted_rows]
        trusted_names = ", ".join(f"{r.nome} ({r.url_or_domain})" for r in trusted_rows[:8])

        web_hits = search_web(question, trusted_domains=trusted_domains, strict_domains=False, max_results=5)
        web_sources = [{"title": h["title"], "url": h["url"]} for h in web_hits]

        local_ctx = (
            "\n".join(f"[{i}] ({d['title']}) {d['text']}" for i, d in enumerate(docs, 1))
            if docs else "Nenhum registro interno encontrado para esta pergunta."
        )
        web_ctx = (
            "\n".join(f"[Web {i}] ({h['title']} - {h['url']}): {h['snippet']}" for i, h in enumerate(web_hits, 1))
            if web_hits else "Sem trechos externos retornados no momento."
        )

        full_prompt = (
            f"BASE INTERNA DA BANCADA:\n{local_ctx}\n\n"
            f"FONTES CONFIÁVEIS PREFERENCIAIS DO TÉCNICO:\n{trusted_names or 'iFixit, ClanGSM, GSMHosting, YouTube'}\n\n"
            f"RESULTADOS DE BUSCA NA INTERNET:\n{web_ctx}\n\n"
            f"PERGUNTA DO TÉCNICO: {question}"
        )

        if get_config("GEMINI_API_KEY"):
            try:
                reply = call_llm(full_prompt, system_prompt=HYBRID_WEB_SYSTEM_PROMPT)
                suggested = extract_wiki_articles_from_content(
                    f"Pergunta: {question}\nResposta técnica: {reply}",
                    source_label="Assistente Web",
                )[0]
                return {
                    "answer": reply,
                    "mode": "llm_web",
                    "sources": sources,
                    "web_sources": web_sources,
                    "suggested_article": suggested,
                }
            except Exception:
                pass

        # Fallback quando sem chave Gemini mas use_web=True
        if web_hits:
            lines = ["Resultados encontrados na internet e na base:", ""]
            for i, d in enumerate(docs, 1):
                lines.append(f"[{i}] {d['title']}: {d['text']}")
            for i, h in enumerate(web_hits, 1):
                lines.append(f"[Web {i}] {h['title']}: {h['snippet']}")
            joined = "\n".join(lines)
            suggested = extract_wiki_articles_from_content(joined, source_label="Busca Web")[0]
            return {
                "answer": joined,
                "mode": "retrieval",
                "sources": sources,
                "web_sources": web_sources,
                "suggested_article": suggested,
            }

    if not docs:
        return {
            "answer": "A base ainda não tem informação sobre isso. Proceda com cautela e, "
                      "se resolver o caso, cadastre a dica na Wiki (ou ative a opção 'Buscar também na Internet').",
            "mode": "retrieval",
            "sources": [],
            "web_sources": [],
            "suggested_article": None,
        }

    if get_config("GEMINI_API_KEY"):
        try:
            return {
                "answer": call_llm(build_prompt(question, docs)),
                "mode": "llm",
                "sources": sources,
                "web_sources": [],
                "suggested_article": None,
            }
        except Exception:  # rede, cota, chave inválida, resposta inesperada...
            note = "A IA está indisponível no momento. Dicas mais relevantes da base:"
    else:
        note = "IA não configurada (defina GEMINI_API_KEY). Dicas mais relevantes da base:"

    return {
        "answer": _retrieval_answer(docs, note),
        "mode": "retrieval",
        "sources": sources,
        "web_sources": [],
        "suggested_article": None,
    }
