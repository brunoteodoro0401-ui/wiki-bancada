"""Popula o banco. Idempotente: pode ser executado várias vezes.

Admin: use ADMIN_EMAIL e ADMIN_PASSWORD (mín. 8 caracteres) para definir as credenciais.
Se não definir e não existir admin, uma senha aleatória é gerada e exibida UMA vez.

ATENÇÃO: os dados de aparelhos/peças abaixo são um ponto de partida. Confira o método de
abertura e as notas com a sua experiência de bancada e ajuste pela interface (aba Aparelhos).
"""
import os
import secrets

from email_validator import EmailNotValidError, validate_email

from database import Base, SessionLocal, engine
from models import Compatibility, Device, Part, User, WikiArticle
from security import hash_password

ARTICLES = [
    {"target_device": "iPhone 11", "category": "Alerta Químico", "ai_context_text": "Não utilize calor excessivo na tela (mancha o LCD) e não use muito álcool isopropílico nas bordas (infiltra no backlight e estraga a tela).", "tags": "iphone 11, display, calor, alcool"},
    {"target_device": "Samsung (Geral)", "category": "Procedimento", "ai_context_text": "Hard Reset: 1) Conecte o cabo USB ligado ao computador (exigido na linha S23). 2) Segure Power + Vol Menos até apagar. 3) Solte Vol Menos e segure Vol Mais mantendo o Power até surgir a logo. 4) Wipe data / factory reset.", "tags": "samsung, hard reset, s23, recovery"},
    {"target_device": "Android (Geral)", "category": "Diagnóstico", "ai_context_text": "Se o aparelho ficar preso em looping infinito (reiniciando sem parar), faça um Hard Reset pelo modo Recovery.", "tags": "android, loop infinito, bootloop"},
    {"target_device": "iPhone", "category": "Compatibilidade", "ai_context_text": "Baterias Decode: se o iPhone estiver com tela paralela, pode dar erro de ativação. Solução: usar tela e bateria Decode, ou ativar a bateria nova com a tela original conectada antes de trocar a tela.", "tags": "iphone, bateria decode, erro ativacao"},
    {"target_device": "iPhone", "category": "Procedimento", "ai_context_text": "Ativação de tela Decode no diagnóstico da Apple: fazer obrigatoriamente SEM o flex de proximidade conectado.", "tags": "iphone, tela decode, diagnostico, flex"},
    {"target_device": "Geral", "category": "Resolução de Problemas", "ai_context_text": "Se a tela nova apresentar burn-in ou desenhos no fundo branco: Com o celular ligado, tire o flex da tela, segure Power por alguns segundos, tire o flex da bateria, continue segurando Power para desenergizar e ligue de novo.", "tags": "tela, burn in, fantasma, reset eletrico"},
]

# (marca, modelo, opening_method, has_flex_cable) — CONFIRA na bancada
DEVICES = [
    ("Apple", "iPhone 11", "Frontal", True),
    ("Apple", "iPhone 12", "Frontal", True),
    ("Apple", "iPhone 13", "Frontal", True),
    ("Apple", "iPhone 14", "Traseira", True),
    ("Samsung", "Galaxy A14", "Traseira", True),
    ("Samsung", "Galaxy S23", "Traseira", True),
    ("Motorola", "Moto G22", "Traseira", True),
]

# (nome, categoria)
PARTS = [
    ("Tela Decode iPhone 11", "Display"),
    ("Bateria Decode iPhone 11", "Bateria"),
    ("Flex de proximidade iPhone 11", "Flex"),
]

# (marca modelo, nome da peça, notas) — derivadas das dicas da Wiki
COMPATS = [
    ("iPhone 11", "Tela Decode iPhone 11",
     "Ativação no diagnóstico da Apple: fazer SEM o flex de proximidade conectado."),
    ("iPhone 11", "Bateria Decode iPhone 11",
     "Com tela paralela pode dar erro de ativação: usar tela e bateria Decode, ou ativar a bateria nova com a tela original conectada antes de trocar a tela."),
]


def seed_articles(db):
    added = 0
    for item in ARTICLES:
        exists = db.query(WikiArticle).filter_by(
            target_device=item["target_device"], ai_context_text=item["ai_context_text"]
        ).first()
        if not exists:
            db.add(WikiArticle(**item))
            added += 1
    return added


def seed_catalog(db):
    for marca, modelo, opening, flex in DEVICES:
        if not db.query(Device).filter_by(marca=marca, modelo=modelo).first():
            db.add(Device(marca=marca, modelo=modelo, opening_method=opening, has_flex_cable=flex))
    for nome, categoria in PARTS:
        if not db.query(Part).filter_by(nome=nome).first():
            db.add(Part(nome=nome, categoria=categoria))
    db.flush()
    for modelo, part_nome, notas in COMPATS:
        device = db.query(Device).filter_by(modelo=modelo).first()
        part = db.query(Part).filter_by(nome=part_nome).first()
        if device and part and not db.query(Compatibility).filter_by(device_id=device.id, part_id=part.id).first():
            db.add(Compatibility(device_id=device.id, part_id=part.id, notas=notas))


def seed_admin(db):
    if db.query(User).filter_by(role="admin").first():
        print("Admin já existe — nada a fazer.")
        return
    email = os.getenv("ADMIN_EMAIL", "admin@example.com").lower()
    try:  # mesma validação do login; evita criar um admin que não consegue entrar
        email = validate_email(email, check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        raise SystemExit(f"ADMIN_EMAIL inválido: {exc}")
    password = os.getenv("ADMIN_PASSWORD")
    generated = password is None
    if generated:
        password = secrets.token_urlsafe(12)
    if len(password) < 8:
        raise SystemExit("ADMIN_PASSWORD deve ter pelo menos 8 caracteres.")
    db.add(User(nome="Administrador", email=email, senha=hash_password(password), role="admin"))
    print(f"Admin criado: {email}")
    if generated:
        print(f"Senha gerada (anote, não será exibida de novo): {password}")


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        added = seed_articles(db)
        seed_catalog(db)
        seed_admin(db)
        db.commit()
        print(f"{added} artigo(s) novo(s). Wiki: {db.query(WikiArticle).count()} | "
              f"Aparelhos: {db.query(Device).count()} | Peças: {db.query(Part).count()} | "
              f"Compatibilidades: {db.query(Compatibility).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
