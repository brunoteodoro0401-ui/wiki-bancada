import datetime as dt
import json
import os
import re
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import rag
import schemas
from database import Base, SessionLocal, engine, ensure_schema_columns, get_db
from security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_columns(engine)
    if "PYTEST_CURRENT_TEST" not in os.environ:
        import seed
        db = SessionLocal()
        try:
            seed.seed_articles(db)
            seed.seed_catalog(db)
            seed.seed_extended_knowledge(db)
            seed.seed_compat_master_list(db)
            seed.seed_all_devices(db)
            seed.seed_trusted_sources(db)
            seed.ensure_owner_admin(db)
            db.commit()
        finally:
            db.close()
    yield


app = FastAPI(title="API Bancada", lifespan=lifespan)

# Permite o frontend local (Vite) e origens de produção via CORS_ORIGINS
_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", *_extra_origins],
    allow_origin_regex=r"https://(wiki-bancada[a-z0-9-]*)\.(vercel\.app|web\.app|firebaseapp\.com|onrender\.com)",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hash fictício para igualar o tempo de resposta quando o e-mail não existe
_DUMMY_HASH = hash_password("senha-fictícia-para-timing")


@app.get("/")
def root():
    return {"status": "ok", "service": "API Bancada", "docs": "/docs"}


def _get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if not obj:
        raise HTTPException(404, f"{label} não encontrado(a)")
    return obj


# ====================== Auth ======================
_LOGIN_ATTEMPTS: dict[str, list[float]] = {}
_LOGIN_WINDOW_SECONDS = 60
_LOGIN_MAX_FAILURES = 8


def _require_approval_enabled(db: Session) -> bool:
    row = db.get(models.AppSetting, "require_user_approval")
    return bool(row and row.value.strip().lower() == "true")


def _client_ip(request: Request) -> str:
    parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    xff = parts[-1] if parts else ""
    return xff or (request.client.host if request.client else "unknown")


@app.post("/auth/register", response_model=schemas.UserOut, status_code=201)
def register(data: schemas.RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(409, "E-mail já cadastrado")
    # Quando a aprovação estiver ativa, novos cadastros nascem aguardando liberação de um admin.
    initial_role = "bloqueado" if _require_approval_enabled(db) else "tecnico"
    user = models.User(nome=data.nome, email=email, senha=hash_password(data.senha), role=initial_role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=schemas.TokenOut)
def login(request: Request, data: schemas.LoginIn, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    email_norm = data.email.lower()
    ip_key = f"ip:{ip}"
    email_key = f"email:{email_norm}"
    now = time.monotonic()
    if "PYTEST_CURRENT_TEST" not in os.environ:
        for key in (ip_key, email_key):
            recent = [ts for ts in _LOGIN_ATTEMPTS.get(key, []) if now - ts < _LOGIN_WINDOW_SECONDS]
            if recent:
                _LOGIN_ATTEMPTS[key] = recent
            else:
                _LOGIN_ATTEMPTS.pop(key, None)
            if len(recent) >= _LOGIN_MAX_FAILURES:
                raise HTTPException(429, "Muitas tentativas de login. Aguarde 1 minuto e tente novamente.")

    user = db.query(models.User).filter(models.User.email == email_norm).first()
    ok = verify_password(data.senha, user.senha if user else _DUMMY_HASH)
    if not user or not ok:
        if "PYTEST_CURRENT_TEST" not in os.environ:
            _LOGIN_ATTEMPTS.setdefault(ip_key, []).append(now)
            _LOGIN_ATTEMPTS.setdefault(email_key, []).append(now)
        raise HTTPException(401, "E-mail ou senha inválidos")
    _LOGIN_ATTEMPTS.pop(ip_key, None)
    _LOGIN_ATTEMPTS.pop(email_key, None)
    if user.role == "bloqueado":
        raise HTTPException(403, "Sua conta está aguardando aprovação ou foi bloqueada pelo administrador.")
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user}


@app.get("/auth/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


@app.get("/users", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    return db.query(models.User).order_by(models.User.id).all()


@app.get("/users/settings", response_model=schemas.UserSettingsOut)
def get_user_settings(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    return {"require_approval": _require_approval_enabled(db)}


@app.put("/users/settings", response_model=schemas.UserSettingsOut)
def update_user_settings(
    data: schemas.UserSettingsIn,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    db.merge(models.AppSetting(key="require_user_approval", value="true" if data.require_approval else "false"))
    db.commit()
    return {"require_approval": data.require_approval}


@app.put("/users/{user_id}/role", response_model=schemas.UserOut)
def update_role(
    user_id: int,
    data: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = _get_or_404(db, models.User, user_id, "Usuário")
    if user.id == admin.id and data.role != "admin":
        raise HTTPException(400, "Você não pode remover o seu próprio acesso de administrador")
    user.role = data.role
    db.commit()
    db.refresh(user)
    return user


@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(require_admin),
):
    user = _get_or_404(db, models.User, user_id, "Usuário")
    if user.id == admin.id:
        raise HTTPException(400, "Você não pode excluir a sua própria conta")
    db.delete(user)
    db.commit()
    return {"ok": True}


# ====================== Devices ======================
@app.post("/devices", response_model=schemas.DeviceOut, status_code=201)
def create_device(data: schemas.DeviceBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = models.Device(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.get("/devices", response_model=List[schemas.DeviceOut])
def list_devices(skip: int = 0, limit: int = 2000, db: Session = Depends(get_db)):
    return db.query(models.Device).order_by(models.Device.marca, models.Device.modelo).offset(skip).limit(limit).all()


@app.get("/devices/{device_id}", response_model=schemas.DeviceOut)
def get_device(device_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, models.Device, device_id, "Device")


@app.put("/devices/{device_id}", response_model=schemas.DeviceOut)
def update_device(device_id: int, data: schemas.DeviceBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.Device, device_id, "Device")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    rag.invalidate_docs_cache()
    return obj


@app.delete("/devices/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.Device, device_id, "Device")
    db.query(models.Compatibility).filter(models.Compatibility.device_id == device_id).delete()
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ====================== Parts ======================
@app.post("/parts", response_model=schemas.PartOut, status_code=201)
def create_part(data: schemas.PartBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = models.Part(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.get("/parts", response_model=List[schemas.PartOut])
def list_parts(skip: int = 0, limit: int = 2000, db: Session = Depends(get_db)):
    return db.query(models.Part).order_by(models.Part.categoria, models.Part.nome).offset(skip).limit(limit).all()


@app.get("/parts/{part_id}", response_model=schemas.PartOut)
def get_part(part_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, models.Part, part_id, "Peça")


@app.put("/parts/{part_id}", response_model=schemas.PartOut)
def update_part(part_id: int, data: schemas.PartBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.Part, part_id, "Peça")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    rag.invalidate_docs_cache()
    return obj


@app.delete("/parts/{part_id}")
def delete_part(part_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.Part, part_id, "Peça")
    db.query(models.Compatibility).filter(models.Compatibility.part_id == part_id).delete()
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ====================== Compatibilities ======================
def _compat_out(c: models.Compatibility, db: Session) -> dict:
    d = db.get(models.Device, c.device_id)
    p = db.get(models.Part, c.part_id)
    return {
        "id": c.id,
        "device_id": c.device_id,
        "part_id": c.part_id,
        "compatibility_type": c.compatibility_type or "Direta",
        "notas": c.notas,
        "device_label": f"{d.marca} {d.modelo}" if d else None,
        "device_code": d.model_code if d else None,
        "part_nome": p.nome if p else None,
        "part_code": p.part_code if p else None,
    }


def _validate_compat_refs(db: Session, data: schemas.CompatBase, ignore_id: int | None = None):
    _get_or_404(db, models.Device, data.device_id, "Device")
    _get_or_404(db, models.Part, data.part_id, "Peça")
    q = db.query(models.Compatibility).filter(
        models.Compatibility.device_id == data.device_id,
        models.Compatibility.part_id == data.part_id,
    )
    if ignore_id is not None:
        q = q.filter(models.Compatibility.id != ignore_id)
    if q.first():
        raise HTTPException(409, "Essa compatibilidade já está cadastrada")


@app.post("/compatibilities", response_model=schemas.CompatOut, status_code=201)
def create_compat(data: schemas.CompatBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    _validate_compat_refs(db, data)
    obj = models.Compatibility(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _compat_out(obj, db)


@app.get("/compatibilities", response_model=List[schemas.CompatOut])
def list_compat(
    device_id: int | None = None,
    part_id: int | None = None,
    skip: int = 0,
    limit: int = 2000,
    db: Session = Depends(get_db),
):
    q = (
        db.query(models.Compatibility, models.Device, models.Part)
        .outerjoin(models.Device, models.Compatibility.device_id == models.Device.id)
        .outerjoin(models.Part, models.Compatibility.part_id == models.Part.id)
    )
    if device_id is not None:
        q = q.filter(models.Compatibility.device_id == device_id)
    if part_id is not None:
        q = q.filter(models.Compatibility.part_id == part_id)
    rows = q.order_by(models.Compatibility.id).offset(skip).limit(limit).all()
    return [
        {
            "id": c.id,
            "device_id": c.device_id,
            "part_id": c.part_id,
            "compatibility_type": c.compatibility_type or "Direta",
            "notas": c.notas,
            "device_label": f"{d.marca} {d.modelo}" if d else None,
            "device_code": d.model_code if d else None,
            "part_nome": p.nome if p else None,
            "part_code": p.part_code if p else None,
        }
        for c, d, p in rows
    ]


@app.put("/compatibilities/{compat_id}", response_model=schemas.CompatOut)
def update_compat(compat_id: int, data: schemas.CompatBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.Compatibility, compat_id, "Compatibilidade")
    _validate_compat_refs(db, data, ignore_id=compat_id)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    rag.invalidate_docs_cache()
    return _compat_out(obj, db)


@app.delete("/compatibilities/{compat_id}")
def delete_compat(compat_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.Compatibility, compat_id, "Compatibilidade")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ====================== Wiki Articles ======================
@app.post("/wiki_articles", response_model=schemas.WikiOut, status_code=201)
def create_article(data: schemas.WikiBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = models.WikiArticle(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.get("/wiki_articles", response_model=List[schemas.WikiOut])
def list_articles(skip: int = 0, limit: int = 1000, db: Session = Depends(get_db)):
    return db.query(models.WikiArticle).order_by(models.WikiArticle.id).offset(skip).limit(limit).all()


@app.get("/wiki_articles/{article_id}", response_model=schemas.WikiOut)
def get_article(article_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, models.WikiArticle, article_id, "Artigo")


@app.put("/wiki_articles/{article_id}", response_model=schemas.WikiOut)
def update_article(article_id: int, data: schemas.WikiBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.WikiArticle, article_id, "Artigo")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    rag.invalidate_docs_cache()
    return obj


@app.delete("/wiki_articles/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.WikiArticle, article_id, "Artigo")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ====================== Trusted Sources (Fontes da IA) ======================
@app.get("/sources", response_model=List[schemas.TrustedSourceOut])
def list_sources(db: Session = Depends(get_db)):
    return db.query(models.TrustedSource).order_by(models.TrustedSource.id).all()


@app.post("/sources", response_model=schemas.TrustedSourceOut, status_code=201)
def create_source(data: schemas.TrustedSourceBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = models.TrustedSource(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.put("/sources/{source_id}", response_model=schemas.TrustedSourceOut)
def update_source(source_id: int, data: schemas.TrustedSourceBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.TrustedSource, source_id, "Fonte")
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj


@app.delete("/sources/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.TrustedSource, source_id, "Fonte")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ====================== Importador Inteligente (Ingest) ======================
@app.post("/ingest", response_model=schemas.IngestOut)
def ingest(data: schemas.IngestIn, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    return rag.ingest_content(
        db=db,
        source_type=data.source_type,
        content=data.content,
        target_device_hint=data.target_device_hint,
        use_trusted_sources_only=data.use_trusted_sources_only,
        auto_save=data.auto_save,
    )


@app.post("/ingest_compatibilities", response_model=schemas.CompatIngestOut)
def ingest_compatibilities_endpoint(
    data: schemas.CompatIngestIn,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    return rag.ingest_compatibilities(
        db=db,
        source_type=data.source_type,
        content=data.content,
        category_hint=data.category_hint,
        use_trusted_sources_only=data.use_trusted_sources_only,
        auto_save=data.auto_save,
    )


@app.post("/compatibilities/bulk_save")
def bulk_save_compatibilities_endpoint(
    data: schemas.CompatBulkSaveIn,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    saved = rag.save_extracted_compatibilities(
        db=db,
        items=[it.model_dump() for it in data.items],
    )
    return {"saved_count": saved}


# ====================== Configuração do Motor de IA ======================
@app.get("/ai_settings", response_model=schemas.AISettingsOut)
def get_ai_settings_endpoint(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return rag.get_ai_settings(db)


@app.put("/ai_settings", response_model=schemas.AISettingsOut)
def update_ai_settings_endpoint(
    data: schemas.AISettingsIn,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    return rag.save_ai_settings(
        db=db,
        provider=data.provider,
        gemini_model=data.gemini_model,
        hf_model=data.hf_model,
        gemini_api_key=data.gemini_api_key,
        hf_api_key=data.hf_api_key,
    )


# ====================== Assistente (RAG + Web) ======================
@app.post("/ask", response_model=schemas.AskOut)
def ask(data: schemas.AskIn, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return rag.answer(
        db=db,
        question=data.question,
        use_web=data.use_web,
        history=[t.model_dump() for t in data.history],
        provider=data.provider,
        model=data.model,
        image_base64=data.image_base64,
        image_mime_type=data.image_mime_type,
    )


# ====================== Ordens de Serviço (O.S.) & Checklist ======================
def _get_os_storage_dir() -> Path:
    docs_dir = Path.home() / "Documents"
    if docs_dir.exists():
        target = docs_dir / "Wiki_Bancada_OS"
    else:
        target = Path(__file__).parent / "ordens_de_servico"
    return target


def _order_to_dict(row: models.ServiceOrder) -> dict:
    try:
        statuses = json.loads(row.statuses_json or "{}")
    except Exception:
        statuses = {}
    return {
        "id": row.id,
        "os_number": row.os_number,
        "status": row.status,
        "stage": row.stage,
        "client_name": row.client_name,
        "client_phone": row.client_phone,
        "device_model": row.device_model,
        "imei": row.imei,
        "bench_current": row.bench_current,
        "battery_health": row.battery_health,
        "notes": row.notes,
        "closure_notes": row.closure_notes,
        "service_value": row.service_value,
        "statuses": statuses,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "closed_at": row.closed_at,
    }


def _persist_os_file_on_disk(order_dict: dict) -> None:
    if "PYTEST_CURRENT_TEST" in os.environ:
        return
    try:
        folder = _get_os_storage_dir()
        folder.mkdir(parents=True, exist_ok=True)
        safe_os = re.sub(r"[^a-zA-Z0-9_-]", "_", order_dict["os_number"])
        safe_dev = re.sub(r"[^a-zA-Z0-9_-]", "_", order_dict["device_model"])[:30]
        base_name = f"{safe_os}_{safe_dev}"
        json_path = folder / f"{base_name}.json"
        json_path.write_text(json.dumps(order_dict, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def _next_os_number(db: Session) -> str:
    # Usa o maior número já existente (e não a contagem) para não repetir após exclusões.
    highest = 0
    for (num,) in db.query(models.ServiceOrder.os_number).all():
        m = re.fullmatch(r"OS-(\d+)", (num or "").strip())
        if m:
            highest = max(highest, int(m.group(1)))
    return f"OS-{highest + 1:04d}"


@app.get("/service_orders/storage_info")
def get_os_storage_info(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    folder = _get_os_storage_dir()
    total = db.query(models.ServiceOrder).count()
    return {
        "local_folder_path": str(folder),
        "total_orders": total,
    }


@app.get("/service_orders", response_model=List[schemas.ServiceOrderOut])
def list_service_orders(
    status: str | None = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    q = db.query(models.ServiceOrder)
    if status:
        q = q.filter(models.ServiceOrder.status == status)
    rows = q.order_by(models.ServiceOrder.id.desc()).limit(300).all()
    return [_order_to_dict(r) for r in rows]


@app.post("/service_orders", response_model=schemas.ServiceOrderOut, status_code=201)
def create_service_order(data: schemas.ServiceOrderIn, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    now_str = dt.datetime.now().strftime("%d/%m/%Y %H:%M")
    requested_num = (data.os_number or "").strip()
    if requested_num and db.query(models.ServiceOrder).filter(models.ServiceOrder.os_number == requested_num).first():
        os_num = _next_os_number(db)
    else:
        os_num = requested_num or _next_os_number(db)
    closed_at = data.closed_at or (now_str if data.status == "encerrada" else None)
    obj = models.ServiceOrder(
        os_number=os_num,
        status=data.status,
        stage=data.stage,
        client_name=data.client_name,
        client_phone=data.client_phone,
        device_model=data.device_model.strip(),
        imei=(data.imei or "").strip() or None,
        bench_current=data.bench_current,
        battery_health=data.battery_health,
        notes=data.notes,
        closure_notes=data.closure_notes,
        service_value=data.service_value,
        statuses_json=json.dumps(data.statuses or {}, ensure_ascii=False),
        created_at=data.created_at or now_str,
        updated_at=now_str,
        closed_at=closed_at,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    out = _order_to_dict(obj)
    _persist_os_file_on_disk(out)
    return out


@app.put("/service_orders/{order_id}", response_model=schemas.ServiceOrderOut)
def update_service_order(order_id: int, data: schemas.ServiceOrderIn, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    obj = _get_or_404(db, models.ServiceOrder, order_id, "Ordem de Serviço")
    now_str = dt.datetime.now().strftime("%d/%m/%Y %H:%M")
    if data.os_number and data.os_number.strip():
        obj.os_number = data.os_number.strip()
    obj.status = data.status
    obj.stage = data.stage
    obj.client_name = data.client_name
    obj.client_phone = data.client_phone
    obj.device_model = data.device_model.strip()
    obj.imei = (data.imei or "").strip() or None
    obj.bench_current = data.bench_current
    obj.battery_health = data.battery_health
    obj.notes = data.notes
    obj.closure_notes = data.closure_notes
    obj.service_value = data.service_value
    obj.statuses_json = json.dumps(data.statuses or {}, ensure_ascii=False)
    obj.updated_at = now_str
    if data.status == "encerrada" and not obj.closed_at:
        obj.closed_at = data.closed_at or now_str
    elif data.status != "encerrada":
        obj.closed_at = None
    db.commit()
    db.refresh(obj)
    out = _order_to_dict(obj)
    _persist_os_file_on_disk(out)
    return out


@app.delete("/service_orders/{order_id}")
def delete_service_order(order_id: int, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    obj = _get_or_404(db, models.ServiceOrder, order_id, "Ordem de Serviço")
    db.delete(obj)
    db.commit()
    return {"ok": True}


@app.post("/service_orders/restore")
def restore_service_orders(data: schemas.ServiceOrderRestoreIn, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    restored = 0
    now_str = dt.datetime.now().strftime("%d/%m/%Y %H:%M")
    for item in data.orders:
        os_num = (item.os_number or "").strip() or _next_os_number(db)
        existing = (
            db.query(models.ServiceOrder)
            .filter(
                models.ServiceOrder.os_number == os_num,
                models.ServiceOrder.device_model == item.device_model.strip(),
            )
            .first()
        )
        if existing:
            existing.status = item.status
            existing.stage = item.stage
            existing.client_name = item.client_name
            existing.client_phone = item.client_phone
            existing.imei = (item.imei or "").strip() or None
            existing.bench_current = item.bench_current
            existing.battery_health = item.battery_health
            existing.notes = item.notes
            existing.closure_notes = item.closure_notes
            existing.service_value = item.service_value
            existing.statuses_json = json.dumps(item.statuses or {}, ensure_ascii=False)
            existing.updated_at = item.updated_at or now_str
            existing.closed_at = item.closed_at
            _persist_os_file_on_disk(_order_to_dict(existing))
        else:
            obj = models.ServiceOrder(
                os_number=os_num,
                status=item.status,
                stage=item.stage,
                client_name=item.client_name,
                client_phone=item.client_phone,
                device_model=item.device_model.strip(),
                imei=(item.imei or "").strip() or None,
                bench_current=item.bench_current,
                battery_health=item.battery_health,
                notes=item.notes,
                closure_notes=item.closure_notes,
                service_value=item.service_value,
                statuses_json=json.dumps(item.statuses or {}, ensure_ascii=False),
                created_at=item.created_at or now_str,
                updated_at=item.updated_at or now_str,
                closed_at=item.closed_at,
            )
            db.add(obj)
            db.flush()
            _persist_os_file_on_disk(_order_to_dict(obj))
        restored += 1
    db.commit()
    return {"restored_count": restored}
