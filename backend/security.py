"""Autenticação: hash de senha (bcrypt), JWT e dependências de autorização."""
import datetime as dt
import os
import secrets
from pathlib import Path

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

import models
from database import get_db

ALGORITHM = "HS256"
TOKEN_TTL = dt.timedelta(hours=8)
MAX_PASSWORD_BYTES = 72  # limite do bcrypt

_bearer = HTTPBearer(auto_error=False)


def _load_secret() -> str:
    """JWT_SECRET do ambiente; senão gera e persiste em .jwt_secret (ignorado no git)."""
    env = os.getenv("JWT_SECRET")
    if env:
        return env
    path = Path(__file__).parent / ".jwt_secret"
    if path.exists():
        return path.read_text().strip()
    secret = secrets.token_urlsafe(48)
    path.write_text(secret)
    return secret


SECRET_KEY = _load_secret()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_access_token(user: models.User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": dt.datetime.now(dt.timezone.utc) + TOKEN_TTL,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Não autenticado ou token inválido.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    user = db.get(models.User, user_id)
    if user is None:
        raise unauthorized
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    # A role é lida do banco (não do token), então rebaixar um admin vale na hora.
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso restrito a administradores.")
    return user
