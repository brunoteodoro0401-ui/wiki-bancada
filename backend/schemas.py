from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from security import MAX_PASSWORD_BYTES

OpeningMethod = Literal["Frontal", "Traseira"]
Role = Literal["admin", "tecnico"]
IngestType = Literal["url", "youtube", "search", "text"]
AIProvider = Literal["gemini", "huggingface", "auto"]


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


# ---------- Trusted Sources (Fontes da IA) ----------
class TrustedSourceBase(BaseModel):
    nome: str = Field(min_length=1, max_length=150)
    url_or_domain: str = Field(min_length=3, max_length=500)
    categoria: Optional[str] = None
    ativo: bool = True


class TrustedSourceOut(TrustedSourceBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ---------- Importador Inteligente (Ingest) ----------
class IngestIn(BaseModel):
    source_type: IngestType
    content: str = Field(min_length=3, max_length=15000)
    target_device_hint: Optional[str] = None
    use_trusted_sources_only: bool = False
    auto_save: bool = False


class WebSourceOut(BaseModel):
    title: str
    url: str


class IngestOut(BaseModel):
    extracted_text_preview: str
    source_references: List[WebSourceOut] = []
    articles: List[WikiBase]
    saved_count: int = 0


# ---------- Configuração de Motor de IA (Gemini / Hugging Face) ----------
class AISettingsIn(BaseModel):
    provider: AIProvider = "auto"
    gemini_model: Optional[str] = None
    hf_model: Optional[str] = None
    gemini_api_key: Optional[str] = None
    hf_api_key: Optional[str] = None


class AISettingsOut(BaseModel):
    provider: str
    gemini_model: str
    hf_model: str
    has_gemini_key: bool
    has_hf_key: bool
    available_models: dict


# ---------- Assistente Conversacional ----------
class ChatTurn(BaseModel):
    role: Literal["user", "assistant", "bot"]
    text: str = Field(min_length=1, max_length=4000)


class AskIn(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    use_web: bool = False
    history: List[ChatTurn] = []
    provider: Optional[AIProvider] = None
    model: Optional[str] = None
    image_base64: Optional[str] = Field(default=None, max_length=6_000_000)
    image_mime_type: Optional[str] = Field(default=None, max_length=60)


class SourceOut(BaseModel):
    type: str
    id: int
    title: str


class AskOut(BaseModel):
    answer: str
    mode: Literal["llm", "llm_web", "retrieval"]
    model_used: Optional[str] = None
    sources: List[SourceOut]
    web_sources: List[WebSourceOut] = []
    follow_up_suggestions: List[str] = []
    suggested_article: Optional[WikiBase] = None


# ---------- Ordens de Serviço (O.S.) e Checklist de Bancada ----------
OSStatus = Literal["aberta", "em_bancada", "encerrada"]


class ServiceOrderIn(BaseModel):
    os_number: Optional[str] = None
    status: OSStatus = "aberta"
    stage: str = "Entrada (Pré-Reparo)"
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    device_model: str = Field(min_length=1, max_length=200)
    imei: Optional[str] = Field(default=None, max_length=60)
    bench_current: Optional[str] = None
    battery_health: Optional[str] = None
    notes: Optional[str] = None
    closure_notes: Optional[str] = None
    service_value: Optional[str] = None
    statuses: dict = {}
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    closed_at: Optional[str] = None


class ServiceOrderOut(BaseModel):
    id: int
    os_number: str
    status: str
    stage: str
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    device_model: str
    imei: Optional[str] = None
    bench_current: Optional[str] = None
    battery_health: Optional[str] = None
    notes: Optional[str] = None
    closure_notes: Optional[str] = None
    service_value: Optional[str] = None
    statuses: dict = {}
    created_at: str
    updated_at: str
    closed_at: Optional[str] = None


class ServiceOrderRestoreIn(BaseModel):
    orders: List[ServiceOrderIn]


# ---------- Busca e Importação Inteligente de Compatibilidades ----------
class CompatExtractedItem(BaseModel):
    part_nome: str = Field(min_length=1, max_length=200)
    part_categoria: Optional[str] = "Display"
    marca: str = Field(min_length=1, max_length=80)
    modelo: str = Field(min_length=1, max_length=120)
    notas: Optional[str] = None


class CompatIngestIn(BaseModel):
    source_type: IngestType = "search"
    content: str = Field(min_length=3, max_length=15000)
    category_hint: Optional[str] = None
    use_trusted_sources_only: bool = False
    auto_save: bool = False


class CompatIngestOut(BaseModel):
    extracted_text_preview: str
    source_references: List[WebSourceOut] = []
    items: List[CompatExtractedItem]
    saved_count: int = 0


class CompatBulkSaveIn(BaseModel):
    items: List[CompatExtractedItem]
