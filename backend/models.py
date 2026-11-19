from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text

from database import Base


class User(Base):
    __tablename__ = "Users"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    senha = Column(String, nullable=False)
    role = Column(String, default="tecnico")


class Device(Base):
    __tablename__ = "Devices"

    id = Column(Integer, primary_key=True, index=True)
    marca = Column(String, index=True, nullable=False)
    modelo = Column(String, index=True, nullable=False)
    model_code = Column(String, index=True)
    device_type = Column(String, index=True, default="Smartphone")
    opening_method = Column(String)
    opening_temp = Column(String)
    has_flex_cable = Column(Boolean, default=False)
    technical_notes = Column(Text)


class Part(Base):
    __tablename__ = "Parts"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True, nullable=False)
    categoria = Column(String, index=True)
    part_code = Column(String, index=True)
    quality_tier = Column(String)


class Compatibility(Base):
    __tablename__ = "Compatibilities"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("Devices.id"), index=True, nullable=False)
    part_id = Column(Integer, ForeignKey("Parts.id"), index=True, nullable=False)
    compatibility_type = Column(String, default="Direta")
    notas = Column(Text)


class WikiArticle(Base):
    __tablename__ = "Wiki_Articles"

    id = Column(Integer, primary_key=True, index=True)
    target_device = Column(String, index=True, nullable=False)
    category = Column(String, index=True)
    severity = Column(String, default="Informativo")
    ai_context_text = Column(Text, nullable=False)
    tags = Column(String)


class TrustedSource(Base):
    __tablename__ = "Trusted_Sources"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    url_or_domain = Column(String, nullable=False)
    categoria = Column(String)
    ativo = Column(Boolean, default=True)


class AppSetting(Base):
    __tablename__ = "App_Settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)


class ServiceOrder(Base):
    __tablename__ = "Service_Orders"

    id = Column(Integer, primary_key=True, index=True)
    os_number = Column(String, index=True, nullable=False)
    status = Column(String, default="aberta")
    stage = Column(String, default="Entrada (Pré-Reparo)")
    client_name = Column(String)
    client_phone = Column(String)
    device_model = Column(String, nullable=False)
    imei = Column(String, index=True)
    bench_current = Column(String)
    battery_health = Column(String)
    notes = Column(Text)
    closure_notes = Column(Text)
    service_value = Column(String)
    statuses_json = Column(Text, nullable=False, default="{}")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    closed_at = Column(String)
