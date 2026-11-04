"""Lista mestra de compatibilidades (estoque Outlet do Celular + peças estratégicas do mercado).

Cada grupo abaixo vira UMA peça (ex.: "Bateria EB-BA505ABU") ligada a todos os aparelhos
compatíveis. A população é idempotente: rodar várias vezes não duplica nada.

Formato de cada grupo:
    marca      -> marca dos aparelhos do grupo
    categoria  -> Bateria | Display | Subplaca | Câmera | Biometria | Periférico | Carcaça
    nome       -> nome da peça (é o que o técnico digita na busca)
    modelos    -> lista de modelos; cada item é "Modelo" ou ("Modelo", "nota só deste modelo")
    notas      -> nota geral do grupo (aplicada a todos os modelos sem nota própria)
"""
from models import Compatibility, Device, Part, WikiArticle

# --------------------------------------------------------------------------- SAMSUNG
SAMSUNG = [
    # Baterias
    {"categoria": "Bateria", "nome": "Bateria EB-BA505ABU",
     "modelos": ["Galaxy A20", "Galaxy A30", "Galaxy A30s", "Galaxy A50"]},
    {"categoria": "Bateria", "nome": "Bateria EB-BA217ABY / WT-S-N28",
     "modelos": ["Galaxy A02", "Galaxy A12", "Galaxy A21s", "Galaxy A13 4G", "Galaxy M12", "Galaxy M13"]},
    {"categoria": "Bateria", "nome": "Bateria EB-BA315ABY",
     "modelos": ["Galaxy A31", "Galaxy A32 4G", "Galaxy A22 4G"],
     "notas": "Não compatível com as versões 5G."},
    {"categoria": "Bateria", "nome": "Bateria EB-BA115ABY / EB-BA207ABY",
     "modelos": ["Galaxy A10s", "Galaxy A20s", "Galaxy A11", "Galaxy A21"]},
    {"categoria": "Bateria", "nome": "Bateria EB-BA750ABN",
     "modelos": ["Galaxy A10", "Galaxy M10", "Galaxy A7 (2018)"]},
    {"categoria": "Bateria", "nome": "Bateria EB-BG781ABY",
     "modelos": ["Galaxy S20 FE", "Galaxy A52 4G", "Galaxy A52 5G", "Galaxy A52s"]},
    {"categoria": "Bateria", "nome": "Bateria EB-BA042ABY",
     "modelos": ["Galaxy A02s", "Galaxy A03", "Galaxy A03s", "Galaxy A03 Core", "Galaxy A04", "Galaxy A04e"]},
    # Telas frontais (sem aro)
    {"categoria": "Display", "nome": "Tela Frontal Galaxy A12 (SM-A125/A127) — sem aro",
     "modelos": ["Galaxy A12", "Galaxy M12", "Galaxy F12", ("Galaxy A02", "Encaixa também no A02.")]},
    {"categoria": "Display", "nome": "Tela Frontal Galaxy A02s (SM-A025) / A03s (SM-A037) — sem aro",
     "modelos": ["Galaxy A02s", "Galaxy A03s"], "notas": "Mesmo painel LCD."},
    {"categoria": "Display", "nome": "Tela Frontal OLED Galaxy M21 / M21s / M30s / M31 — sem aro",
     "modelos": ["Galaxy M21", "Galaxy M21s", "Galaxy M30s", "Galaxy M31"], "notas": "Painéis OLED idênticos."},
    {"categoria": "Display", "nome": "Tela Frontal Galaxy A50 / A30s / A50s — sem aro",
     "modelos": ["Galaxy A50", "Galaxy A30s", "Galaxy A50s"], "notas": "Displays e biometrias compatíveis."},
    {"categoria": "Display", "nome": "Tela Frontal Galaxy A13 4G (SM-A135) / A23 4G (SM-A235) — sem aro",
     "modelos": ["Galaxy A13 4G", "Galaxy A23 4G", ("Galaxy M13", "Também atende o M13.")],
     "notas": "Painéis idênticos."},
    {"categoria": "Display", "nome": "Tela Frontal LCD 90Hz Galaxy A13 5G (SM-A136) / A04s — sem aro",
     "modelos": ["Galaxy A13 5G", "Galaxy A04s", ("Galaxy M13 5G", "Também atende o M13 5G.")],
     "notas": "Painéis LCD 90Hz idênticos."},
    {"categoria": "Display", "nome": "Tela Frontal Galaxy A10 (SM-A105) / M10 (SM-M105) — sem aro",
     "modelos": ["Galaxy A10", "Galaxy M10"], "notas": "Mesmo painel LCD."},
    # Periféricos
    {"categoria": "Periférico", "nome": "Gaveta de Chip Galaxy A10 / A20 / A30 / A50",
     "modelos": ["Galaxy A10", "Galaxy A20", "Galaxy A30", "Galaxy A50"]},
    {"categoria": "Biometria", "nome": "Leitor Biométrico Galaxy A10s / A20s / M12",
     "modelos": ["Galaxy A10s", "Galaxy A20s", "Galaxy M12"], "notas": "Mudam apenas as cores."},
    {"categoria": "Periférico", "nome": "Alto-falante Auricular Galaxy A10 / A20 / A30 / A50",
     "modelos": ["Galaxy A10", "Galaxy A20", "Galaxy A30", "Galaxy A50"]},
]

# --------------------------------------------------------------------------- MOTOROLA
MOTOROLA = [
    # Baterias
    {"categoria": "Bateria", "nome": "Bateria JK50", "modelos": ["Moto G7 Power", "Moto G8 Power Lite", "Moto G9 Play", "Moto G10", "Moto G20", "Moto G30", "Moto G32", "Moto E7 Plus", "Moto E7 Power", "Moto E40", "Motorola One Fusion"], "notas": "Lista informada como 6000mAh — confira a capacidade impressa na etiqueta da bateria original."},
    {"categoria": "Bateria", "nome": "Bateria NH50", "modelos": ["Moto G22", "Moto G13", "Moto G53", "Moto E13", "Moto E32", "Moto E32s"]},
    {"categoria": "Bateria", "nome": "Bateria MC50 (6000mAh)", "modelos": ["Moto G60", "Moto G9 Power", "Moto G40 Fusion"]},
    {"categoria": "Bateria", "nome": "Bateria KS50", "modelos": ["Motorola One Vision", "Motorola One Action"]},
    {"categoria": "Bateria", "nome": "Bateria HG40", "modelos": ["Moto G5s", "Moto G5s Plus", "Moto G6"]},
    {"categoria": "Bateria", "nome": "Bateria JG40", "modelos": ["Moto G7 Play", "Motorola One"]},
    {"categoria": "Bateria", "nome": "Bateria QB50", "modelos": ["Moto G84"]},
    {"categoria": "Bateria", "nome": "Bateria QM50", "modelos": ["Motorola Edge 40 Neo"]},
    {"categoria": "Bateria", "nome": "Bateria QC50", "modelos": ["Motorola Edge 50 Fusion"]},
    {"categoria": "Bateria", "nome": "Bateria SP50", "modelos": ["Motorola Edge 60 Neo"]},
    # Telas frontais e carcaças (sem aro)
    {"categoria": "Display", "nome": "Tela Frontal OLED Moto G31 / G41 / G71 — sem aro", "modelos": ["Moto G31", "Moto G41", "Moto G71"], "notas": "Frontais idênticas."},
    {"categoria": "Display", "nome": "Tela Frontal LCD 120Hz Moto G60 / G60s — sem aro", "modelos": ["Moto G60", "Moto G60s"], "notas": "Frontais idênticas — testar a taxa de atualização."},
    {"categoria": "Display", "nome": "Tela e Chassi Moto G8 Play / One Macro", "modelos": ["Moto G8 Play", "Motorola One Macro"], "notas": "Telas e chassis idênticos."},
    {"categoria": "Display", "nome": "Tela Frontal LCD Moto G9 Play / E7 Plus — sem aro", "modelos": ["Moto G9 Play", "Moto E7 Plus"], "notas": "Mesmo painel LCD."},
    {"categoria": "Display", "nome": "Tela Frontal Moto E6s / E6i — sem aro", "modelos": ["Moto E6s", "Moto E6i"], "notas": "Frontais idênticas."},
    {"categoria": "Display", "nome": "Tela Frontal Moto G13 / G23 — sem aro", "modelos": ["Moto G13", "Moto G23"], "notas": "Frontais idênticas."},
    {"categoria": "Display", "nome": "Tela Frontal Moto G04 / G04s / G24 — sem aro", "modelos": ["Moto G04", "Moto G04s", "Moto G24"], "notas": "Mesmo painel frontal."},
    {"categoria": "Display", "nome": "Tela Frontal Moto G34 / G45 / G53 — sem aro", "modelos": ["Moto G34", "Moto G45", "Moto G53"]},
    {"categoria": "Display", "nome": "Tela Frontal Moto G32 / G52 / G62 / G72 / G82 / G73 — sem aro", "modelos": ["Moto G32", "Moto G52", "Moto G62", "Moto G72", "Moto G82", "Moto G73"]},
    {"categoria": "Display", "nome": "Tela Frontal Moto Edge 40 / Edge 40 Neo — sem aro", "modelos": ["Moto Edge 40", "Moto Edge 40 Neo"]},
    {"categoria": "Display", "nome": "Tela, Tampa Traseira e Chassi Moto G10 / G20 / G30", "modelos": ["Moto G10", ("Moto G20", "Exige lote 90Hz."), ("Moto G30", "Exige lote 90Hz.")], "notas": "Telas, tampas traseiras e chassis idênticos."},
    # Placas sub (carga) e periféricos
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G52 / G82", "modelos": ["Moto G52", "Moto G82"], "notas": "Mesma placa sub de carga."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G10 / G20", "modelos": ["Moto G10", "Moto G20"], "notas": "Mesma placa sub de carga."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G8 Play / One Macro", "modelos": ["Moto G8 Play", "Motorola One Macro"], "notas": "Mesma placa sub de carga."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G05 5G / G15", "modelos": ["Moto G05 5G", "Moto G15"]},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto E20 / E40", "modelos": ["Moto E20", "Moto E40"]},
    {"categoria": "Biometria", "nome": "Leitor Biométrico Traseiro Moto G7 Play / G7 Power", "modelos": ["Moto G7 Play", "Moto G7 Power"]},
]

MOTOROLA = [
    # Baterias
    {"categoria": "Bateria", "nome": "Bateria JK50",
     "modelos": ["Moto G7 Power", "Moto G8 Power Lite", "Moto G9 Play", "Moto G10", "Moto G20", "Moto G30",
                 "Moto G32", "Moto E7 Plus", "Moto E7 Power", "Moto E40", "Motorola One Fusion"],
     "notas": "Lista informada como 6000mAh — confira a capacidade impressa na etiqueta da bateria original."},
    {"categoria": "Bateria", "nome": "Bateria NH50",
     "modelos": ["Moto G22", "Moto G13", "Moto G53", "Moto E13", "Moto E32", "Moto E32s"]},
    {"categoria": "Bateria", "nome": "Bateria MC50 (6000mAh)",
     "modelos": ["Moto G60", "Moto G9 Power", "Moto G40 Fusion"]},
    {"categoria": "Bateria", "nome": "Bateria KS40",
     "modelos": ["Motorola One Vision", "Motorola One Action"]},
    {"categoria": "Bateria", "nome": "Bateria HG40",
     "modelos": ["Moto G5s", "Moto G5s Plus", "Moto G6"]},
    {"categoria": "Bateria", "nome": "Bateria JG40",
     "modelos": ["Moto G7 Play", "Motorola One"]},
    # Telas frontais e carcaças (sem aro)
    {"categoria": "Display", "nome": "Tela Frontal OLED Moto G31 / G41 / G71 — sem aro",
     "modelos": ["Moto G31", "Moto G41", "Moto G71"], "notas": "Frontais idênticas."},
    {"categoria": "Display", "nome": "Tela Frontal LCD 120Hz Moto G60 / G60s — sem aro",
     "modelos": ["Moto G60", "Moto G60s"], "notas": "Frontais idênticas — testar a taxa de atualização."},
    {"categoria": "Display", "nome": "Tela e Chassi Moto G8 Play / One Macro",
     "modelos": ["Moto G8 Play", "Motorola One Macro"], "notas": "Telas e chassis idênticos."},
    {"categoria": "Display", "nome": "Tela Frontal LCD Moto G9 Play / E7 Plus — sem aro",
     "modelos": ["Moto G9 Play", "Moto E7 Plus"], "notas": "Mesmo painel LCD."},
    {"categoria": "Display", "nome": "Tela Frontal Moto E6s / E6i — sem aro",
     "modelos": ["Moto E6s", "Moto E6i"], "notas": "Frontais idênticas."},
    {"categoria": "Display", "nome": "Tela Frontal Moto G13 / G23 — sem aro",
     "modelos": ["Moto G13", "Moto G23"], "notas": "Frontais idênticas."},
    {"categoria": "Display", "nome": "Tela Frontal Moto G04 / G04s / G24 — sem aro",
     "modelos": ["Moto G04", "Moto G04s", "Moto G24"], "notas": "Mesmo painel frontal."},
    {"categoria": "Display", "nome": "Tela, Tampa Traseira e Chassi Moto G10 / G20 / G30",
     "modelos": ["Moto G10", ("Moto G20", "Exige lote 90Hz."), ("Moto G30", "Exige lote 90Hz.")],
     "notas": "Telas, tampas traseiras e chassis idênticos."},
    # Placas sub (carga) e periféricos
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G52 / G82",
     "modelos": ["Moto G52", "Moto G82"], "notas": "Mesma placa sub de carga."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G10 / G20",
     "modelos": ["Moto G10", "Moto G20"], "notas": "Mesma placa sub de carga."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G8 Play / One Macro",
     "modelos": ["Moto G8 Play", "Motorola One Macro"], "notas": "Mesma placa sub de carga."},
    {"categoria": "Biometria", "nome": "Leitor Biométrico Traseiro Moto G7 Play / G7 Power",
     "modelos": ["Moto G7 Play", "Moto G7 Power"]},
]

# --------------------------------------------------------------------------- XIAOMI / REDMI / POCO
XIAOMI = [
    # Telas frontais
    {"categoria": "Display", "nome": "Tela AMOLED Redmi Note 10 4G / Note 10S / Poco M5s",
     "modelos": ["Redmi Note 10 4G", "Redmi Note 10S", "Poco M5s"], "notas": "O mesmo painel atende os três."},
    {"categoria": "Display", "nome": "Tela LCD Poco X3 / Poco X3 Pro",
     "modelos": ["Poco X3", "Poco X3 Pro"], "notas": "Telas e aros idênticos."},
    {"categoria": "Display", "nome": "Tela AMOLED Mi 9T / Mi 9T Pro (K20 / K20 Pro)",
     "modelos": ["Mi 9T", "Mi 9T Pro"], "notas": "Painel AMOLED, tampa e botões iguais."},
    # Baterias
    {"categoria": "Bateria", "nome": "Bateria BN53",
     "modelos": ["Redmi Note 9 Pro", "Redmi Note 10 Pro"]},
    {"categoria": "Bateria", "nome": "Bateria BN54",
     "modelos": ["Redmi Note 9 5G", "Redmi 10X 4G", "Redmi 9", "Poco M2"]},
    {"categoria": "Bateria", "nome": "Bateria BM4F",
     "modelos": ["Mi A3", "Mi 9 Lite"]},
    {"categoria": "Bateria", "nome": "Bateria BN47 / BM47",
     "modelos": ["Mi A2 Lite", "Redmi 6 Pro", "Redmi 4X"]},
    # Placas sub (conector de carga)
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Poco X3 NFC / Poco X3 Pro",
     "modelos": ["Poco X3 NFC", "Poco X3 Pro"], "notas": "Placa sub e flex main idênticos."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Redmi Note 9S / Note 9 Pro / Poco M2 Pro",
     "modelos": ["Redmi Note 9S", "Redmi Note 9 Pro", "Poco M2 Pro"], "notas": "Placa sub intercambiável."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga 220733SL — Redmi A1 / A1+ / A2+ / Poco C50",
     "modelos": ["Redmi A1", "Redmi A1+", "Redmi A2+", "Poco C50"], "notas": "Mesma placa sub (220733SL)."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Redmi 10C / Poco C40",
     "modelos": ["Redmi 10C", "Poco C40"], "notas": "PCB de carga idêntico."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Mi A3 / Mi 9 Lite",
     "modelos": ["Mi A3", "Mi 9 Lite"], "notas": "Mesma placa sub."},
    # Câmeras
    {"categoria": "Câmera", "nome": "Câmeras Frontal 5MP e Traseira 13MP — Redmi 9A / 9i / Poco C31",
     "modelos": ["Redmi 9A", "Redmi 9i", "Poco C31"]},
    {"categoria": "Câmera", "nome": "Câmera Traseira Principal 48MP — Redmi Note 8 / Note 8T",
     "modelos": ["Redmi Note 8", "Redmi Note 8T"], "notas": "Câmera traseira principal de 48MP idêntica."},
    {"categoria": "Câmera", "nome": "Câmera Frontal 16MP — Redmi Note 9S / Poco M2 Pro",
     "modelos": ["Redmi Note 9S", "Poco M2 Pro"]},
    {"categoria": "Câmera", "nome": "Lente Secundária 2MP (Macro / Profundidade) — Poco X3 / X3 Pro / Note 9 / Poco M3",
     "modelos": ["Poco X3", "Poco X3 Pro", "Redmi Note 9", "Poco M3"], "notas": "Lentes secundárias genéricas 2MP."},
]

# --------------------------------------------------------------------------- APPLE
APPLE = [
    {"categoria": "Carcaça", "nome": "Carcaça / Chassi iPhone 8 / SE 2020",
     "modelos": ["iPhone 8", "iPhone SE 2020"], "notas": "Carcaças compatíveis (muda apenas a estética da maçã)."},
    {"categoria": "Bateria", "nome": "Bateria A2479 iPhone 12 / 12 Pro",
     "modelos": ["iPhone 12", "iPhone 12 Pro"],
     "notas": "Mesma célula. Transplante do flex BMS necessário para evitar a mensagem de peça desconhecida."},
]

# --------------------------------------------------------------------------- LG
LG = [
    {"categoria": "Display", "nome": "Tela Frontal LCD LG K42 / K52 / K62",
     "modelos": ["K42", "K52", "K62"], "notas": "Frontal LCD idêntica."},
    {"categoria": "Display", "nome": "Tela Frontal LG K22 / K22 Plus",
     "modelos": ["K22", "K22 Plus"], "notas": "Display idêntico."},
    {"categoria": "Bateria", "nome": "Bateria BL-T39",
     "modelos": ["K12", "K12 Plus", "K12 Max", "G7 ThinQ"]},
    {"categoria": "Subplaca", "nome": "Placa Sub LG K52 / K62",
     "modelos": ["K52", "K62"], "notas": "Intercambiáveis."},
    {"categoria": "Subplaca", "nome": "Placa Sub LG K11 / K11 Plus",
     "modelos": ["K11", "K11 Plus"], "notas": "Intercambiáveis."},
    {"categoria": "Biometria", "nome": "Leitor Biométrico e Flex de Volume LG K41S / K51S",
     "modelos": ["K41S", "K51S"], "notas": "As telas são incompatíveis, mas o leitor biométrico e o flex de volume servem em ambos."},
]

# --------------------------------------------------------------------------- REALME
REALME = [
    {"categoria": "Subplaca", "nome": "Placa Sub e Conector Micro-USB Realme C11 (2021) / C20 / C21",
     "modelos": ["C11 (2021)", "C20", "C21"], "notas": "Mesma placa sub e conector Micro-USB."},
    {"categoria": "Câmera", "nome": "Câmera Frontal 5MP (sensor em gota) Realme C11 (2021) / C20 / C21Y",
     "modelos": ["C11 (2021)", "C20", "C21Y"]},
]

MASTER_GROUPS = (
    [dict(g, marca="Samsung") for g in SAMSUNG]
    + [dict(g, marca="Motorola") for g in MOTOROLA]
    + [dict(g, marca="Xiaomi") for g in XIAOMI]
    + [dict(g, marca="Apple") for g in APPLE]
    + [dict(g, marca="LG") for g in LG]
    + [dict(g, marca="Realme") for g in REALME]
)

# Alertas de bancada importantes da lista (também alimentam a IA).
MASTER_ARTICLES = [
    {"target_device": "iPhone 12 / 12 Pro", "category": "Compatibilidade",
     "ai_context_text": "As telas OLED do iPhone 12 e do iPhone 12 Pro são idênticas, mas exigem a gravação do True Tone (transferir os dados da tela original) para manter o recurso.",
     "tags": "iphone 12, iphone 12 pro, tela oled, true tone"},
    {"target_device": "iPhone 8 / SE 2020", "category": "Compatibilidade",
     "ai_context_text": "iPhone 8 e iPhone SE (2ª geração) usam o mesmo display. No SE o 3D Touch atua como Haptic Touch. As carcaças também são compatíveis; muda apenas a estética da maçã.",
     "tags": "iphone 8, iphone se 2020, display, 3d touch, carcaça"},
    {"target_device": "iPhone 12 / 12 Pro", "category": "Compatibilidade",
     "ai_context_text": "A bateria do iPhone 12 e do 12 Pro é a mesma célula (A2479). É necessário transplantar o flex do BMS para evitar a mensagem de 'peça desconhecida' em Ajustes.",
     "tags": "iphone 12, iphone 12 pro, bateria, a2479, bms"},
    {"target_device": "Redmi Note 8 / Note 8T", "category": "Compatibilidade",
     "ai_context_text": "As telas do Redmi Note 8 e do Redmi Note 8T são INCOMPATÍVEIS entre si. Apenas a câmera traseira principal de 48MP é idêntica nos dois.",
     "tags": "redmi note 8, redmi note 8t, tela, incompatível, câmera 48mp"},
    {"target_device": "Samsung Galaxy A31 / A32 4G / A22 4G", "category": "Compatibilidade",
     "ai_context_text": "A bateria EB-BA315ABY serve no A31, A32 4G e A22 4G, mas NÃO é compatível com as versões 5G desses modelos.",
     "tags": "galaxy a31, a32 4g, a22 4g, bateria, eb-ba315aby, 5g"},
    {"target_device": "Motorola Moto G60 / G60s", "category": "Compatibilidade",
     "ai_context_text": "A tela LCD 120Hz do Moto G60 e do G60s é idêntica. Sempre teste a taxa de atualização (120Hz) após a troca.",
     "tags": "moto g60, moto g60s, tela, 120hz"},
    {"target_device": "Motorola Moto G10 / G20 / G30", "category": "Compatibilidade",
     "ai_context_text": "Moto G10, G20 e G30 compartilham telas, tampas traseiras e chassis. No G20 e no G30 é preciso usar lotes de tela de 90Hz.",
     "tags": "moto g10, moto g20, moto g30, tela, 90hz, chassi"},
    {"target_device": "LG K41S / K51S", "category": "Compatibilidade",
     "ai_context_text": "As telas do LG K41S e do K51S são incompatíveis, mas o leitor biométrico e o flex de volume servem em ambos.",
     "tags": "lg k41s, lg k51s, biometria, flex volume, tela incompatível"},
]


def _find_device(db, marca: str, modelo: str):
    for d in db.query(Device).filter(Device.modelo.ilike(modelo)).all():
        if (d.marca or "").lower() == marca.lower():
            return d
    return None


def seed_compat_master(db) -> dict:
    """Cria (sem duplicar) aparelhos, peças, vínculos e dicas da lista mestra."""
    new_devices = new_parts = new_links = new_articles = 0

    for group in MASTER_GROUPS:
        part = db.query(Part).filter_by(nome=group["nome"]).first()
        if not part:
            part = Part(nome=group["nome"], categoria=group["categoria"])
            db.add(part)
            new_parts += 1

        for item in group["modelos"]:
            modelo, nota = (item, None) if isinstance(item, str) else item
            nota = nota or group.get("notas")
            device = _find_device(db, group["marca"], modelo)
            if not device:
                device = Device(marca=group["marca"], modelo=modelo, opening_method=None, has_flex_cable=False)
                db.add(device)
                new_devices += 1
            db.flush()
            exists = db.query(Compatibility).filter_by(device_id=device.id, part_id=part.id).first()
            if not exists:
                db.add(Compatibility(device_id=device.id, part_id=part.id, notas=nota))
                new_links += 1

    for item in MASTER_ARTICLES:
        exists = db.query(WikiArticle).filter_by(
            target_device=item["target_device"], ai_context_text=item["ai_context_text"]
        ).first()
        if not exists:
            db.add(WikiArticle(**item))
            new_articles += 1

    db.flush()
    return {"devices": new_devices, "parts": new_parts, "compatibilities": new_links, "articles": new_articles}
