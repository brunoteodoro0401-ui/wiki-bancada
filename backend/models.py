from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text

from database import Base


class User(Base):
    __tablename__ = "Users"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    senha = Column(String, nullable=False)
    role = Column(String, default="user")


class Device(Base):
    __tablename__ = "Devices"

    id = Column(Integer, primary_key=True, index=True)
    marca = Column(String, nullable=False)
    modelo = Column(String, nullable=False)
    opening_method = Column(String)
    has_flex_cable = Column(Boolean, default=False)


class Part(Base):
    __tablename__ = "Parts"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    categoria = Column(String)


class Compatibility(Base):
    __tablename__ = "Compatibilities"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("Devices.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("Parts.id"), nullable=False)
    notas = Column(Text)


class WikiArticle(Base):
    __tablename__ = "Wiki_Articles"

    id = Column(Integer, primary_key=True, index=True)
    target_device = Column(String, index=True, nullable=False)
    category = Column(String, index=True)
    ai_context_text = Column(Text, nullable=False)
    tags = Column(String)


class AppSetting(Base):
    __tablename__ = "App_Settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)

