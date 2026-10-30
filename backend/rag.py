"""Assistente de bancada: RAG Inteligente + Conversa Contínua + Busca Profunda em Fontes + Multi-Modelo (Gemini & Hugging Face).

Suporta:
- Google Gemini (gemini-3.6-flash, gemini-3.5-flash, gemini-2.5-pro, gemini-3.5-flash-lite)
- Hugging Face Inference Router (Qwen/Qwen2.5-72B-Instruct, meta-llama/Llama-3.3-70B-Instruct, deepseek-ai/DeepSeek-V3 ou qualquer modelo do huggingface.co)
- Memória de conversa multi-turno (entende perguntas de continuação sobre o mesmo aparelho/defeito)
- Leitura profunda e paralela dos links das Fontes Confiáveis (Trusted_Sources) e URLs coladas no chat.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
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
DEFAULT_MODEL = "gemini-3.6-flash"
FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
]
DEFAULT_HF_MODEL = "Qwen/Qwen2.5-72B-Instruct"

AVAILABLE_MODELS = {
    "gemini": [
        {"id": "gemini-3.6-flash", "label": "Gemini 3.6 Flash (Recomendado — Rápido e Inteligente)"},
        {"id": "gemini-3.5-flash", "label": "Gemini 3.5 Flash (Equilibrado)"},
        {"id": "gemini-2.5-pro", "label": "Gemini 2.5 Pro (Raciocínio Profundo)"},
        {"id": "gemini-3.5-flash-lite", "label": "Gemini 3.5 Flash Lite (Ultra-leve)"},
    ],
    "huggingface": [
        {"id": "Qwen/Qwen2.5-72B-Instruct", "label": "Qwen 2.5 72B Instruct (Excelente em PT-BR e Técnica)"},
        {"id": "meta-llama/Llama-3.3-70B-Instruct", "label": "Llama 3.3 70B Instruct (Meta)"},
        {"id": "deepseek-ai/DeepSeek-V3", "label": "DeepSeek V3 (Avançado)"},
        {"id": "Qwen/Qwen2.5-Coder-32B-Instruct", "label": "Qwen 2.5 32B Instruct"},
        {"id": "mistralai/Mistral-Small-24B-Instruct-2501", "label": "Mistral Small 24B Instruct"},
    ],
}

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
    """Sincroniza chaves e modelos salvos na tabela App_Settings do banco."""
    if "PYTEST_CURRENT_TEST" in os.environ:
        return
    mapping = {
        "gemini_api_key": "GEMINI_API_KEY",
        "gemini_model": "GEMINI_MODEL",
        "hf_api_key": "HF_API_KEY",
        "hf_model": "HF_MODEL",
        "ai_provider": "AI_PROVIDER",
    }
    try:
        rows = db.query(models.AppSetting).all()
        for r in rows:
            env_name = mapping.get(r.key)
            if env_name and r.value and not os.getenv(env_name):
                os.environ[env_name] = r.value.strip()
    except Exception:
        pass


def get_ai_settings(db: Session) -> Dict:
    _sync_db_settings(db)
    provider = get_config("AI_PROVIDER", "auto")
    gemini_model = get_config("GEMINI_MODEL", DEFAULT_MODEL)
    hf_model = get_config("HF_MODEL", DEFAULT_HF_MODEL)
    # Se no banco estava salvo gemini-3.5-flash-lite antigo, promove para gemini-3.6-flash
    if gemini_model == "gemini-3.5-flash-lite":
        gemini_model = DEFAULT_MODEL
    return {
        "provider": provider,
        "gemini_model": gemini_model,
        "hf_model": hf_model,
        "has_gemini_key": bool(get_config("GEMINI_API_KEY")),
        "has_hf_key": bool(get_config("HF_API_KEY")),
        "available_models": AVAILABLE_MODELS,
    }


def save_ai_settings(
    db: Session,
    provider: str = "auto",
    gemini_model: Optional[str] = None,
    hf_model: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
    hf_api_key: Optional[str] = None,
) -> Dict:
    updates = {"ai_provider": provider}
    os.environ["AI_PROVIDER"] = provider
    if gemini_model:
        updates["gemini_model"] = gemini_model.strip()
        os.environ["GEMINI_MODEL"] = gemini_model.strip()
    if hf_model:
        updates["hf_model"] = hf_model.strip()
        os.environ["HF_MODEL"] = hf_model.strip()
    if gemini_api_key is not None and gemini_api_key.strip():
        updates["gemini_api_key"] = gemini_api_key.strip()
        os.environ["GEMINI_API_KEY"] = gemini_api_key.strip()
    if hf_api_key is not None and hf_api_key.strip():
        updates["hf_api_key"] = hf_api_key.strip()
        os.environ["HF_API_KEY"] = hf_api_key.strip()

    for k, v in updates.items():
        db.merge(models.AppSetting(key=k, value=v))
    db.commit()
    return get_ai_settings(db)


STOPWORDS = {
    "a", "o", "e", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
    "um", "uma", "uns", "umas", "para", "por", "com", "sem", "que", "se", "ao",
    "como", "qual", "quais", "meu", "minha", "esta", "esse", "essa", "isso", "eu",
    "ou", "foi", "ser", "tem", "ta", "to", "pra", "pro", "mais", "muito", "ele",
    "ela", "nele", "nela", "isso", "fazer", "faz", "quando", "onde", "porque",
}

# Sinônimos técnicos de bancada para enriquecer a busca no banco
SYNONYMS = {
    "frontal": "tela",
    "visor": "tela",
    "lcd": "tela",
    "oled": "tela",
    "amoled": "tela",
    "touch": "tela",
    "carregar": "carga",
    "carregando": "carga",
    "carregador": "carga",
    "dock": "carga",
    "conector": "carga",
    "reiniciando": "loop",
    "bootloop": "loop",
    "travado": "loop",
    "apagado": "liga",
    "morto": "liga",
}

SYSTEM_PROMPT = (
    "Você é um técnico sênior de bancada e especialista em manutenção de smartphones. "
    "Converse de forma natural, prestativa e direta em português, mantendo a continuidade "
    "do assunto caso o técnico esteja fazendo perguntas em sequência sobre o mesmo aparelho ou defeito. "
    "Use as informações do CONTEXTO fornecido como base principal e cite as fontes com [1], [2]. "
    "Se o contexto não cobrir algum detalhe, avise claramente e oriente com segurança técnica sem inventar."
)

HYBRID_WEB_SYSTEM_PROMPT = (
    "Você é um mestre especialista em manutenção de celulares, diagnóstico eletrônico e microsoldagem de bancada. "
    "Você está conversando diretamente com um técnico na bancada. Seja natural, claro, conversacional e muito preciso:\n"
    "1) Mantenha o contexto da conversa: se o técnico perguntar 'e onde fica esse CI?', 'qual temperatura uso?' ou 'e se não resolver?', "
    "continue falando do mesmo aparelho e defeito das mensagens anteriores.\n"
    "2) Combine a BASE INTERNA DA BANCADA [1], [2] com o conteúdo lido das FONTES CONFIÁVEIS / INTERNET [Web 1], [Web 2] "
    "e seu conhecimento técnico verificado.\n"
    "3) Estruture a resposta de forma prática: Diagnóstico provável, Passo a passo na bancada e Alertas de risco "
    "(cabos flex, temperatura, álcool no LCD/Face ID, consumo na fonte, malhas VBAT/VPH_PWR).\n"
    "4) Ao final da resposta, faça 1 pergunta curta e inteligente ao técnico (ex: 'Você já mediu o consumo na fonte ou testou com outra peça?') "
    "para continuar ajudando no diagnóstico."
)


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    return "".join(c for c in text if unicodedata.category(c) != "Mn").lower()


def tokenize(text: str, expand_synonyms: bool = False) -> set:
    out = set()
    for tok in re.findall(r"[a-z0-9]+", _norm(text or "")):
        if tok in STOPWORDS:
            continue
        if len(tok) > 3 and tok.endswith("s"):  # plural simples
            tok = tok[:-1]
        out.add(tok)
        if expand_synonyms and tok in SYNONYMS:
            out.add(SYNONYMS[tok])
    return out


KNOWN_DEVICE_PATTERNS = [
    r"iphone\s*\d+\s*(?:pro\s*max|pro|plus|mini)?",
    r"galaxy\s*[aszm]\d+\s*(?:fe|ultra|plus|5g)?",
    r"s2\d\s*(?:fe|ultra|plus)?",
    r"a[12357]\d\s*(?:5g)?",
    r"moto\s*[ge]\d+\s*(?:plus|play|power)?",
    r"edge\s*\d+\s*(?:neo|pro|ultra)?",
    r"poco\s*[xmfc]\d+\s*(?:pro|gt|nfc)?",
    r"redmi\s*(?:note\s*)?\d+\s*(?:pro|s|c|t|4g|5g)?",
    r"iphone",
    r"samsung",
    r"motorola",
    r"xiaomi",
]


def extract_device_mention(text: str) -> Optional[str]:
    norm = _norm(text)
    for pat in KNOWN_DEVICE_PATTERNS:
        m = re.search(rf"\b({pat})\b", norm)
        if m:
            return m.group(1).strip()
    return None


def build_contextual_query(question: str, history: Optional[List[Dict]] = None) -> str:
    """Se a pergunta atual for de continuação ('e onde faço o jumper?', 'qual valor?'),
    injeta o aparelho e o tema das mensagens anteriores para a busca não se perder.
    """
    if not history:
        return question.strip()

    has_own_device = extract_device_mention(question) is not None
    q_tokens = tokenize(question)
    is_followup = (not has_own_device) or len(q_tokens) <= 4 or bool(
        re.match(r"^(e\b|mas\b|como\b|qual\b|quais\b|onde\b|quanto\b|serve\b|nesse\b|nele\b|nela\b|entao\b|se\b)", _norm(question))
    )

    if not is_followup:
        return question.strip()

    # Busca o último aparelho e as últimas perguntas do usuário no histórico
    recent_user_texts: List[str] = []
    last_device: Optional[str] = None
    for turn in reversed(history[-6:]):
        t_text = (turn.get("text") if isinstance(turn, dict) else getattr(turn, "text", "")) or ""
        t_role = (turn.get("role") if isinstance(turn, dict) else getattr(turn, "role", "")) or ""
        if not last_device:
            last_device = extract_device_mention(t_text)
        if t_role == "user" and len(recent_user_texts) < 2:
            recent_user_texts.append(t_text)

    parts: List[str] = []
    if last_device and last_device not in _norm(question):
        parts.append(last_device)
    if recent_user_texts:
        parts.append(recent_user_texts[0][:120])
    parts.append(question.strip())
    return " ".join(parts)


def format_history_block(history: Optional[List[Dict]]) -> str:
    if not history:
        return ""
    lines = ["HISTÓRICO RECENTE DESTA CONVERSA NA BANCADA:"]
    for turn in history[-6:]:
        role = (turn.get("role") if isinstance(turn, dict) else getattr(turn, "role", "")) or "user"
        text = (turn.get("text") if isinstance(turn, dict) else getattr(turn, "text", "")) or ""
        speaker = "TÉCNICO" if role == "user" else "ASSISTENTE"
        lines.append(f"- {speaker}: {text[:500]}")
    return "\n".join(lines) + "\n\n"


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
    q = tokenize(question, expand_synonyms=True)
    if not q:
        return []
    scored = []
    for doc in build_documents(db):
        head = tokenize(doc["head"], expand_synonyms=True)
        body = tokenize(doc["text"], expand_synonyms=True) | tokenize(doc["extra"], expand_synonyms=True)
        score = 2 * len(q & head) + len(q & body)
        if score > 0:
            scored.append((score, doc))
    scored.sort(key=lambda s: s[0], reverse=True)
    return [d for _, d in scored[:k]]


def build_prompt(question: str, docs: List[Dict], history: Optional[List[Dict]] = None) -> str:
    ctx = "\n".join(f"[{i}] ({d['title']}) {d['text']}" for i, d in enumerate(docs, 1))
    hist_block = format_history_block(history)
    return f"CONTEXTO:\n{ctx}\n\n{hist_block}PERGUNTA DO TÉCNICO: {question}"


def _call_huggingface(prompt: str, system_prompt: str, model_override: Optional[str] = None) -> str:
    """Chama a API Router do Hugging Face (compatível com OpenAI Chat Completions)."""
    hf_key = get_config("HF_API_KEY")
    if not hf_key:
        raise RuntimeError("HF_API_KEY não configurada.")
    hf_model = model_override or get_config("HF_MODEL", DEFAULT_HF_MODEL)
    candidates = [hf_model]
    for fallback in ("Qwen/Qwen2.5-72B-Instruct", "meta-llama/Llama-3.3-70B-Instruct"):
        if fallback not in candidates:
            candidates.append(fallback)

    last_exc: Exception | None = None
    for model in candidates:
        try:
            resp = httpx.post(
                "https://router.huggingface.co/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {hf_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": 900,
                    "temperature": 0.3,
                },
                timeout=22,
            )
            if resp.status_code in (404, 429, 503):
                last_exc = RuntimeError(f"HF {model}: HTTP {resp.status_code}")
                continue
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            last_exc = exc
            continue
    raise last_exc or RuntimeError("Falha ao consultar Hugging Face")


def _call_gemini(prompt: str, system_prompt: str, model_override: Optional[str] = None) -> str:
    """Chama a API REST do Gemini com thinkingBudget=0 (respostas em ~2s) e fallback automático."""
    key = get_config("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY não configurada.")
    preferred = model_override or get_config("GEMINI_MODEL", DEFAULT_MODEL)
    if preferred == "gemini-3.5-flash-lite" and not model_override:
        preferred = DEFAULT_MODEL
    candidates = [preferred, *[m for m in FALLBACK_MODELS if m != preferred]]

    last_exc: Exception | None = None
    for model in candidates:
        try:
            gen_config: Dict = {"temperature": 0.3}
            if "flash" in model and "2.0" not in model:
                gen_config["thinkingConfig"] = {"thinkingBudget": 0}
            resp = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": key},
                json={
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": gen_config,
                },
                timeout=16,
            )
            if resp.status_code in (400, 404, 429, 503):
                last_exc = RuntimeError(f"{model}: HTTP {resp.status_code}")
                continue
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as exc:
            last_exc = exc
            continue
    raise last_exc or RuntimeError("Falha ao consultar Gemini")


def call_llm(
    prompt: str,
    system_prompt: str = SYSTEM_PROMPT,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """Roteador inteligente entre Google Gemini e Hugging Face (com fallback cruzado)."""
    chosen_provider = provider or get_config("AI_PROVIDER", "auto")

    if chosen_provider == "huggingface" and get_config("HF_API_KEY"):
        try:
            return _call_huggingface(prompt, system_prompt, model_override=model)
        except Exception:
            if get_config("GEMINI_API_KEY"):
                return _call_gemini(prompt, system_prompt)
            raise

    if get_config("GEMINI_API_KEY"):
        try:
            return _call_gemini(prompt, system_prompt, model_override=model if chosen_provider == "gemini" else None)
        except Exception:
            if get_config("HF_API_KEY"):
                return _call_huggingface(prompt, system_prompt)
            raise

    if get_config("HF_API_KEY"):
        return _call_huggingface(prompt, system_prompt, model_override=model)

    raise RuntimeError("Nenhuma chave de IA configurada (GEMINI_API_KEY ou HF_API_KEY).")


def _clean_html_text(raw_html: str) -> str:
    cleaned = re.sub(r"<(script|style|noscript|svg|header|footer|nav)[^>]*>.*?</\1>", " ", raw_html, flags=re.S | re.I)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = html.unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _ddg_lite_query(search_q: str, max_results: int = 6) -> List[Dict[str, str]]:
    results: List[Dict[str, str]] = []
    try:
        resp = httpx.post(
            "https://lite.duckduckgo.com/lite/",
            data={"q": search_q},
            headers={"User-Agent": USER_AGENT},
            timeout=6,
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


def _normalize_domain(url_or_domain: str) -> str:
    clean = re.sub(r"^https?://(www\.)?", "", url_or_domain.strip().lower())
    return clean.split("/")[0]


def _is_specific_url(url_or_domain: str) -> bool:
    u = url_or_domain.strip()
    if u.startswith(("http://", "https://")):
        parsed = urlparse(u)
        return bool(parsed.path and parsed.path not in ("/", "")) or bool(parsed.query)
    return "/" in u and not u.endswith("/")


def search_web(
    query: str,
    trusted_domains: Optional[List[str]] = None,
    strict_domains: bool = False,
    max_results: int = 6,
) -> List[Dict[str, str]]:
    """Busca paralela na internet e nas Fontes Confiáveis cadastradas, priorizando os links do usuário."""
    base_q = query.strip()
    tech_q = base_q
    if not any(w in base_q.lower() for w in ("reparo", "celular", "manutenção", "jumper", "troca", "esquema")):
        tech_q = f"{base_q} reparo manutenção celular"

    clean_domains = []
    if trusted_domains:
        for d in trusted_domains:
            dom = _normalize_domain(d)
            if dom and dom not in clean_domains and dom != "youtube.com":
                clean_domains.append(dom)

    queries_to_run: List[str] = []
    if clean_domains:
        site_filter = " OR ".join(f"site:{d}" for d in clean_domains[:5])
        queries_to_run.append(f"{base_q} ({site_filter})")
    if not strict_domains or not queries_to_run:
        queries_to_run.append(tech_q)

    combined: List[Dict[str, str]] = []
    seen_urls = set()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(_ddg_lite_query, q, max_results) for q in queries_to_run]
        for fut in as_completed(futures):
            try:
                for item in fut.result():
                    if item["url"] not in seen_urls:
                        seen_urls.add(item["url"])
                        combined.append(item)
            except Exception:
                pass

    # Ordena priorizando hits que pertencem às Fontes Confiáveis do usuário
    if clean_domains:
        def _is_trusted(hit: Dict[str, str]) -> int:
            u = hit["url"].lower()
            return 0 if any(d in u for d in clean_domains) else 1

        combined.sort(key=_is_trusted)

    return combined[:max_results]


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
            timeout=6,
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
            timeout=7,
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
                    parts.append(f"Descrição do Vídeo:\n{desc[:3000]}")

            cap_match = re.search(r'"captionTracks":(\[.*?\])', page.text)
            if cap_match:
                try:
                    tracks = json.loads(cap_match.group(1))
                    if tracks and isinstance(tracks, list):
                        base_url = tracks[0].get("baseUrl")
                        if base_url:
                            cap_resp = httpx.get(base_url, headers={"User-Agent": USER_AGENT}, timeout=6)
                            if cap_resp.status_code == 200:
                                transcript = _clean_html_text(cap_resp.text)
                                if transcript:
                                    parts.append(f"Transcrição / Legenda:\n{transcript[:5000]}")
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


def fetch_url_content(url: str, timeout: int = 8) -> Tuple[str, List[Dict[str, str]]]:
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
            timeout=timeout,
            follow_redirects=True,
        )
        resp.raise_for_status()
        title_match = re.search(r"<title[^>]*>(.*?)</title>", resp.text, flags=re.S | re.I)
        title = _clean_html_text(title_match.group(1)) if title_match else clean_url
        body_text = _clean_html_text(resp.text)[:6000]
        return f"Fonte: {title} ({clean_url})\n\nConteúdo:\n{body_text}", [{"title": title[:120], "url": clean_url}]
    except Exception as exc:
        return f"URL informada: {clean_url} (Aviso na leitura direta: {exc})", [{"title": clean_url, "url": clean_url}]


def enrich_hits_with_page_content(hits: List[Dict[str, str]], max_pages: int = 2) -> List[Dict[str, str]]:
    """Entra em paralelo nos principais links encontrados e extrai o texto real da página
    para que a IA leia o procedimento completo e não apenas 1 linha de resumo.
    """
    if not hits:
        return []
    targets = hits[:max_pages]

    def _read_one(hit: Dict[str, str]) -> Tuple[str, str]:
        url = hit["url"]
        try:
            text, _ = fetch_url_content(url, timeout=4)
            return url, text[:1800]
        except Exception:
            return url, ""

    extra_by_url: Dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=max_pages) as pool:
        futures = [pool.submit(_read_one, h) for h in targets]
        for fut in as_completed(futures):
            try:
                u, body = fut.result()
                if body:
                    extra_by_url[u] = body
            except Exception:
                pass

    enriched = []
    for h in hits:
        full_body = extra_by_url.get(h["url"], "")
        combined_snippet = h.get("snippet", "")
        if full_body and len(full_body) > len(combined_snippet):
            combined_snippet = f"{combined_snippet}\nTrecho da página: {full_body}"
        enriched.append({**h, "snippet": combined_snippet[:2000]})
    return enriched


def build_fast_suggestion(question: str, reply: str, hint: Optional[str] = None) -> Dict[str, str]:
    """Cria a sugestão de card para a Wiki instantaneamente (sem 2ª chamada bloqueante ao LLM)."""
    device = hint or extract_device_mention(f"{question} {reply}") or "Geral"
    device = device.title() if device != "Geral" else "Geral"
    for fix_from, fix_to in (("Iphone", "iPhone"), ("Poco", "Poco"), ("Moto ", "Moto "), ("S2", "S2")):
        device = device.replace(fix_from, fix_to)

    lower_r = reply.lower()
    if any(w in lower_r for w in ("jumper", "reballing", "solda", "pmic", "bga", "ci ")):
        category = "Microsoldagem"
    elif any(w in lower_r for w in ("álcool", "alcool", "calor", "temperatura", "solvente")):
        category = "Alerta Químico"
    elif any(w in lower_r for w in ("compatível", "compativel", "universal", "mesma tela")):
        category = "Compatibilidade"
    elif any(w in lower_r for w in ("fonte de bancada", "consumo", "multímetro", "curto")):
        category = "Diagnóstico"
    else:
        category = "Procedimento"

    clean_text = re.sub(r"\s+", " ", reply).strip()[:900]
    tags = ", ".join(list(tokenize(f"{device} {question}"))[:7]) or "reparo, bancada"
    return {
        "target_device": device[:100],
        "category": category,
        "ai_context_text": clean_text,
        "tags": tags[:200],
    }


def build_follow_up_suggestions(question: str, reply: str, contextual_q: str) -> List[str]:
    """Gera sugestões rápidas e clicáveis de continuação da conversa sobre o mesmo assunto."""
    dev = extract_device_mention(f"{question} {contextual_q} {reply}")
    dev_label = dev.upper() if dev and len(dev) <= 4 else (dev.title().replace("Iphone", "iPhone") if dev else "esse aparelho")
    lower_all = f"{question} {reply}".lower()

    suggestions: List[str] = []
    if "tela" in lower_all or "display" in lower_all or "frontal" in lower_all:
        suggestions.append(f"Quais cuidados ao abrir e remover a tela do {dev_label}?")
        suggestions.append(f"Qual tela ou peça é compatível com o {dev_label}?")
    elif "carga" in lower_all or "carrega" in lower_all or "termômetro" in lower_all:
        suggestions.append(f"Como testar a subplaca e o termistor NTC do {dev_label}?")
        suggestions.append(f"Qual a tensão correta no conector da bateria do {dev_label}?")
    elif "liga" in lower_all or "curto" in lower_all or "pmic" in lower_all:
        suggestions.append(f"Como identificar o curto na malha primária do {dev_label}?")
        suggestions.append(f"Qual consumo esperado na fonte de bancada para o {dev_label}?")
    else:
        suggestions.append(f"Quais os defeitos crônicos mais comuns do {dev_label}?")
        suggestions.append(f"Como abrir o {dev_label} sem danificar cabos flex?")

    suggestions.append("E se esse procedimento não resolver, qual o próximo teste na placa?")
    return suggestions[:3]


def extract_wiki_articles_from_content(
    raw_text: str,
    target_device_hint: Optional[str] = None,
    source_label: str = "",
) -> List[Dict[str, str]]:
    """Extrai dicas técnicas estruturadas para a Wiki usando IA (com fallback heurístico)."""
    hint = (target_device_hint or "").strip()
    if get_config("GEMINI_API_KEY") or get_config("HF_API_KEY"):
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

    return [build_fast_suggestion(hint or "", raw_text, hint=hint)]


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
        hits = enrich_hits_with_page_content(hits, max_pages=2)
        refs = [{"title": h["title"], "url": h["url"]} for h in hits]
        if hits:
            extracted_text = "\n\n".join(
                f"Fonte: {h['title']} ({h['url']})\nConteúdo extraído: {h['snippet']}" for h in hits
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


def answer(
    db: Session,
    question: str,
    use_web: bool = False,
    history: Optional[List[Dict]] = None,
    provider: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict:
    _sync_db_settings(db)
    contextual_q = build_contextual_query(question, history)
    docs = retrieve(db, contextual_q)
    sources = [{"type": d["type"], "id": d["id"], "title": d["title"]} for d in docs]

    # Detecta se o usuário colou algum link direto na pergunta
    urls_in_question = re.findall(r"https?://[^\s)>]+", question)
    has_ai_key = bool(get_config("GEMINI_API_KEY") or get_config("HF_API_KEY"))
    active_model_label = model or (
        get_config("HF_MODEL", DEFAULT_HF_MODEL)
        if (provider or get_config("AI_PROVIDER")) == "huggingface"
        else get_config("GEMINI_MODEL", DEFAULT_MODEL)
    )

    if use_web or urls_in_question:
        trusted_rows = db.query(models.TrustedSource).filter_by(ativo=True).all()
        trusted_domains = [r.url_or_domain for r in trusted_rows]
        trusted_names = ", ".join(f"{r.nome} ({r.url_or_domain})" for r in trusted_rows[:10])

        web_hits: List[Dict[str, str]] = []
        # 1) Se o técnico colou uma URL na pergunta, lê essa URL diretamente!
        for direct_url in urls_in_question[:2]:
            txt, refs = fetch_url_content(direct_url, timeout=6)
            web_hits.append({
                "title": refs[0]["title"] if refs else direct_url,
                "url": direct_url,
                "snippet": txt[:2500],
            })

        # 2) Se alguma Fonte Confiável cadastrada é um link direto relevante para a pergunta, lê ela também!
        q_tokens = tokenize(contextual_q, expand_synonyms=True)
        for tr in trusted_rows:
            if _is_specific_url(tr.url_or_domain):
                tr_tokens = tokenize(f"{tr.nome} {tr.categoria or ''} {tr.url_or_domain}", expand_synonyms=True)
                if q_tokens & tr_tokens:
                    txt, refs = fetch_url_content(tr.url_or_domain, timeout=5)
                    web_hits.append({
                        "title": tr.nome,
                        "url": refs[0]["url"] if refs else tr.url_or_domain,
                        "snippet": txt[:2000],
                    })

        # 3) Busca na web + nas Fontes Confiáveis e lê o conteúdo das top páginas em paralelo
        searched = search_web(contextual_q, trusted_domains=trusted_domains, strict_domains=False, max_results=5)
        searched = enrich_hits_with_page_content(searched, max_pages=2)
        for sh in searched:
            if all(sh["url"] != existing["url"] for existing in web_hits):
                web_hits.append(sh)

        web_sources = [{"title": h["title"], "url": h["url"]} for h in web_hits[:6]]

        local_ctx = (
            "\n".join(f"[{i}] ({d['title']}) {d['text']}" for i, d in enumerate(docs, 1))
            if docs else "Nenhum registro interno encontrado para esta pergunta."
        )
        web_ctx = (
            "\n".join(f"[Web {i}] ({h['title']} - {h['url']}):\n{h['snippet']}" for i, h in enumerate(web_hits[:5], 1))
            if web_hits else "Sem trechos externos retornados no momento."
        )
        hist_block = format_history_block(history)

        full_prompt = (
            f"BASE INTERNA DA BANCADA:\n{local_ctx}\n\n"
            f"FONTES CONFIÁVEIS PREFERENCIAIS DO TÉCNICO:\n{trusted_names or 'iFixit, ClanGSM, GSMHosting, YouTube'}\n\n"
            f"CONTEÚDO LIDO DAS FONTES / INTERNET:\n{web_ctx}\n\n"
            f"{hist_block}"
            f"PERGUNTA ATUAL DO TÉCNICO: {question}"
        )

        if has_ai_key:
            try:
                reply = call_llm(full_prompt, system_prompt=HYBRID_WEB_SYSTEM_PROMPT, provider=provider, model=model)
                suggested = build_fast_suggestion(contextual_q, reply)
                follow_ups = build_follow_up_suggestions(question, reply, contextual_q)
                return {
                    "answer": reply,
                    "mode": "llm_web",
                    "model_used": active_model_label,
                    "sources": sources,
                    "web_sources": web_sources,
                    "follow_up_suggestions": follow_ups,
                    "suggested_article": suggested,
                }
            except Exception:
                pass

        if web_hits:
            lines = ["Resultados encontrados na internet e na base:", ""]
            for i, d in enumerate(docs, 1):
                lines.append(f"[{i}] {d['title']}: {d['text']}")
            for i, h in enumerate(web_hits[:5], 1):
                lines.append(f"[Web {i}] {h['title']}: {h['snippet'][:400]}")
            joined = "\n".join(lines)
            return {
                "answer": joined,
                "mode": "retrieval",
                "model_used": None,
                "sources": sources,
                "web_sources": web_sources,
                "follow_up_suggestions": build_follow_up_suggestions(question, joined, contextual_q),
                "suggested_article": build_fast_suggestion(contextual_q, joined),
            }

    if not docs:
        return {
            "answer": "A base ainda não tem informação sobre isso. Proceda com cautela e, "
                      "se resolver o caso, cadastre a dica na Wiki (ou ative a opção 'Buscar também na Internet').",
            "mode": "retrieval",
            "model_used": None,
            "sources": [],
            "web_sources": [],
            "follow_up_suggestions": [],
            "suggested_article": None,
        }

    if has_ai_key:
        try:
            reply = call_llm(build_prompt(question, docs, history=history), provider=provider, model=model)
            return {
                "answer": reply,
                "mode": "llm",
                "model_used": active_model_label,
                "sources": sources,
                "web_sources": [],
                "follow_up_suggestions": build_follow_up_suggestions(question, reply, contextual_q),
                "suggested_article": build_fast_suggestion(contextual_q, reply),
            }
        except Exception:
            note = "A IA está indisponível no momento. Dicas mais relevantes da base:"
    else:
        note = "IA não configurada (defina GEMINI_API_KEY). Dicas mais relevantes da base:"

    return {
        "answer": _retrieval_answer(docs, note),
        "mode": "retrieval",
        "model_used": None,
        "sources": sources,
        "web_sources": [],
        "follow_up_suggestions": build_follow_up_suggestions(question, "", contextual_q),
        "suggested_article": None,
    }
