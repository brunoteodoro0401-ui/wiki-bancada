from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from security import MAX_PASSWORD_BYTES

OpeningMethod = Literal["Frontal", "Traseira"]
Role = Literal["admin", "tecnico"]


# ---------- Auth / Users ----------
class RegisterIn(BaseModel):
    nome: str = Field(min_length=2, max_length=100)
    email: EmailStr
    senha: str = Field(min_length=8)

    @field_validator("senha")
    @classmethod
    def senha_cabe_no_bcrypt(cls, v: str) -> str:
        if len(v.encode()) > MAX_PASSWORD_BYTES:
            raise ValueError(f"A senha deve ter no máximo {MAX_PASSWORD_BYTES} bytes.")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    senha: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    email: EmailStr
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RoleUpdate(BaseModel):
    role: Role


# ---------- Devices ----------
class DeviceBase(BaseModel):
    marca: str = Field(min_length=1)
    modelo: str = Field(min_length=1)
    opening_method: Optional[OpeningMethod] = None
    has_flex_cable: bool = False


class DeviceOut(DeviceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Parts ----------
class PartBase(BaseModel):
    nome: str = Field(min_length=1)
    categoria: Optional[str] = None


class PartOut(PartBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Compatibilities ----------
class CompatBase(BaseModel):
    device_id: int
    part_id: int
    notas: Optional[str] = None


class CompatOut(CompatBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    device_label: Optional[str] = None
    part_nome: Optional[str] = None


# ---------- Wiki ----------
class WikiBase(BaseModel):
    target_device: str = Field(min_length=1)
    category: Optional[str] = None
    ai_context_text: str = Field(min_length=1)
    tags: Optional[str] = None


class WikiOut(WikiBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Assistente ----------
class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=1000)


class SourceOut(BaseModel):
    type: str
    id: int
    title: str


class AskOut(BaseModel):
    answer: str
    mode: Literal["llm", "retrieval"]
    sources: List[SourceOut]
