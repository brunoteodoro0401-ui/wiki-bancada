import os
from contextlib import asynccontextmanager
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import models
import rag
import schemas
from database import Base, engine, get_db
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
    yield


app = FastAPI(title="API Bancada", lifespan=lifespan)

# Permite o frontend local (Vite) e origens de produção via CORS_ORIGINS
_extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", *_extra_origins],
    allow_origin_regex=r"https://.*\.(vercel\.app|web\.app|firebaseapp\.com|onrender\.com)",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hash fictício para igualar o tempo de resposta quando o e-mail não existe
_DUMMY_HASH = hash_password("senha-fictícia-para-timing")


def _get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.get(model, obj_id)
    if not obj:
        raise HTTPException(404, f"{label} não encontrado(a)")
    return obj


# ====================== Auth ======================
@app.post("/auth/register", response_model=schemas.UserOut, status_code=201)
def register(data: schemas.RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(409, "E-mail já cadastrado")
    # Cadastro público sempre cria técnico; admin só via seed ou por outro admin.
    user = models.User(nome=data.nome, email=email, senha=hash_password(data.senha), role="tecnico")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=schemas.TokenOut)
def login(data: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email.lower()).first()
    ok = verify_password(data.senha, user.senha if user else _DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(401, "E-mail ou senha inválidos")
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user}


@app.get("/auth/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


@app.get("/users", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    return db.query(models.User).order_by(models.User.id).all()


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


# ====================== Devices ======================
@app.post("/devices", response_model=schemas.DeviceOut, status_code=201)
def create_device(data: schemas.DeviceBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = models.Device(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@app.get("/devices", response_model=List[schemas.DeviceOut])
def list_devices(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
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
def list_parts(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
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
        "notas": c.notas,
        "device_label": f"{d.marca} {d.modelo}" if d else None,
        "part_nome": p.nome if p else None,
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
    db: Session = Depends(get_db),
):
    q = db.query(models.Compatibility)
    if device_id is not None:
        q = q.filter(models.Compatibility.device_id == device_id)
    if part_id is not None:
        q = q.filter(models.Compatibility.part_id == part_id)
    return [_compat_out(c, db) for c in q.order_by(models.Compatibility.id).all()]


@app.put("/compatibilities/{compat_id}", response_model=schemas.CompatOut)
def update_compat(compat_id: int, data: schemas.CompatBase, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.Compatibility, compat_id, "Compatibilidade")
    _validate_compat_refs(db, data, ignore_id=compat_id)
    for k, v in data.model_dump().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
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
def list_articles(skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
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
    return obj


@app.delete("/wiki_articles/{article_id}")
def delete_article(article_id: int, db: Session = Depends(get_db), _: models.User = Depends(require_admin)):
    obj = _get_or_404(db, models.WikiArticle, article_id, "Artigo")
    db.delete(obj)
    db.commit()
    return {"ok": True}


# ====================== Assistente (RAG) ======================
@app.post("/ask", response_model=schemas.AskOut)
def ask(data: schemas.AskIn, db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return rag.answer(db, data.question)
