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
    {"categoria": "Display", "nome": "Tela Frontal Galaxy A02s / A03s / A03 Core / A04e — sem aro",
     "modelos": ["Galaxy A02s", "Galaxy A03s", "Galaxy A03 Core", "Galaxy A04e"],
     "notas": "Matriz LCD unificada nas versões sem aro."},
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
    # --- Inventário consolidado (nov/2026)
    {"categoria": "Display", "nome": "Tela Frontal Galaxy A15 4G / A15 5G",
     "modelos": ["Galaxy A15 4G", "Galaxy A15 5G"], "notas": "Frontal unificada."},
    {"categoria": "Display", "nome": "Tela Frontal Galaxy M23 5G / M33 5G",
     "modelos": ["Galaxy M23 5G", "Galaxy M33 5G"], "notas": "Compartilham o mesmo painel."},
    {"categoria": "Bateria", "nome": "Bateria WT-S-N28 / WT-S-W1",
     "modelos": ["Galaxy A05", "Galaxy A04e", "Galaxy A22 5G"]},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Galaxy A12 / M12",
     "modelos": ["Galaxy A12", "Galaxy M12"], "notas": "Placa sub unificada."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Galaxy A02s / A03s",
     "modelos": ["Galaxy A02s", "Galaxy A03s"], "notas": "Placa sub unificada."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Galaxy A14 4G",
     "modelos": ["Galaxy A14 4G"], "notas": "NÃO serve no A14 5G — componentes incompatíveis entre si."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Galaxy A14 5G",
     "modelos": ["Galaxy A14 5G"], "notas": "NÃO serve no A14 4G — componentes incompatíveis entre si."},
    {"categoria": "Carcaça", "nome": "Tampa Traseira Galaxy A15 4G / A15 5G",
     "modelos": ["Galaxy A15 4G", "Galaxy A15 5G"], "notas": "Tampa unificada."},
    {"categoria": "Carcaça", "nome": "Tampa Traseira Galaxy A16 4G / A16 5G",
     "modelos": ["Galaxy A16 4G", "Galaxy A16 5G"], "notas": "Tampa unificada."},
    {"categoria": "Carcaça", "nome": "Tampa Traseira Galaxy S20 FE",
     "modelos": ["Galaxy S20 FE"]},
]

# --------------------------------------------------------------------------- MOTOROLA
MOTOROLA = [
    # Baterias
    {"categoria": "Bateria", "nome": "Bateria JK50",
     "modelos": ["Moto G7 Power", "Moto G8 Power Lite", "Moto G9 Play", "Moto G10", "Moto G20", "Moto G30",
                 "Moto G31", "Moto G32", "Moto E7 Plus", "Moto E7 Power", "Moto E40", "Moto One Fusion"],
     "notas": "Lista informada como 6000mAh — confira a capacidade impressa na etiqueta da bateria original."},
    {"categoria": "Bateria", "nome": "Bateria NH50",
     "modelos": ["Moto G22", "Moto G13", "Moto G53", "Moto E13", "Moto E32", "Moto E32s"]},
    {"categoria": "Bateria", "nome": "Bateria MC50 (6000mAh)",
     "modelos": ["Moto G60", "Moto G9 Power", "Moto G40 Fusion"]},
    {"categoria": "Bateria", "nome": "Bateria KS40",
     "modelos": ["Moto One Vision", "Moto One Action"]},
    {"categoria": "Bateria", "nome": "Bateria HG40",
     "modelos": ["Moto G5s", "Moto G5s Plus", "Moto G6"]},
    {"categoria": "Bateria", "nome": "Bateria JG40",
     "modelos": ["Moto G7 Play", "Moto One"]},
    # Telas frontais e carcaças (sem aro)
    {"categoria": "Display", "nome": "Tela Frontal OLED Moto G31 / G41 / G71 — sem aro",
     "modelos": ["Moto G31", "Moto G41", "Moto G71"], "notas": "Frontais idênticas."},
    {"categoria": "Display", "nome": "Tela Frontal LCD 120Hz Moto G60 / G60s — sem aro",
     "modelos": ["Moto G60", "Moto G60s"], "notas": "Frontais idênticas — testar a taxa de atualização."},
    {"categoria": "Display", "nome": "Tela e Chassi Moto G8 Play / One Macro",
     "modelos": ["Moto G8 Play", "Moto One Macro"], "notas": "Telas e chassis idênticos."},
    {"categoria": "Display", "nome": "Tela Frontal LCD Moto G9 Play / E7 Plus — sem aro",
     "modelos": ["Moto G9 Play", "Moto E7 Plus"], "notas": "Mesmo painel LCD."},
    {"categoria": "Display", "nome": "Tela Frontal Moto E6s / E6i — sem aro",
     "modelos": ["Moto E6s", "Moto E6i"], "notas": "Frontais idênticas."},
    {"categoria": "Display", "nome": "Tela Frontal Moto G13 / G23 / G34 / G45 / G53 — sem aro",
     "modelos": ["Moto G13", "Moto G23", "Moto G34", "Moto G45", "Moto G53"],
     "notas": "Painéis LCD idênticos unificados."},
    {"categoria": "Display", "nome": "Tela Frontal Moto G04 / G04s / G24 / G24 Power — sem aro",
     "modelos": ["Moto G04", "Moto G04s", "Moto G24", "Moto G24 Power"], "notas": "Mesma matriz de display."},
    {"categoria": "Display", "nome": "Tela, Tampa Traseira e Chassi Moto G10 / G20 / G30",
     "modelos": ["Moto G10", ("Moto G20", "Exige lote 90Hz."), ("Moto G30", "Exige lote 90Hz.")],
     "notas": "Telas, tampas traseiras e chassis idênticos."},
    # Placas sub (carga) e periféricos
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G52 / G82",
     "modelos": ["Moto G52", "Moto G82"], "notas": "Mesma placa sub de carga."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G10 / G20",
     "modelos": ["Moto G10", "Moto G20"], "notas": "Mesma placa sub de carga."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G8 Play / One Macro",
     "modelos": ["Moto G8 Play", "Moto One Macro"], "notas": "Mesma placa sub de carga."},
    {"categoria": "Biometria", "nome": "Leitor Biométrico Traseiro Moto G7 Play / G7 Power",
     "modelos": ["Moto G7 Play", "Moto G7 Power"]},
    # --- Inventário consolidado (nov/2026)
    {"categoria": "Display", "nome": "Tela Frontal Moto G32 / G52 / G62 / G72 / G82 / G73",
     "modelos": ["Moto G32", "Moto G52", "Moto G62", "Moto G72", "Moto G82", "Moto G73"],
     "notas": "Agrupamento de compatibilidade física — diferencie a versão LCD ou OLED conforme o aparelho do cliente."},
    {"categoria": "Display", "nome": "Tela Frontal P-OLED Motorola Edge 40 / Edge 40 Neo",
     "modelos": ["Moto Edge 40", "Moto Edge 40 Neo"], "notas": "Painel P-OLED unificado."},
    {"categoria": "Bateria", "nome": "Bateria QB50", "modelos": ["Moto G84"]},
    {"categoria": "Bateria", "nome": "Bateria QM50", "modelos": ["Moto Edge 40 Neo"]},
    {"categoria": "Bateria", "nome": "Bateria QC50", "modelos": ["Moto Edge 50 Fusion"]},
    {"categoria": "Bateria", "nome": "Bateria SP50", "modelos": ["Moto Edge 60 Neo"]},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto E20 / E40",
     "modelos": ["Moto E20", "Moto E40"], "notas": "Placa sub unificada."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G04 / G04s",
     "modelos": ["Moto G04", "Moto G04s"], "notas": "Placa sub unificada."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Moto G05 5G / G15",
     "modelos": ["Moto G05 5G", "Moto G15"], "notas": "Placa sub unificada."},
    {"categoria": "Câmera", "nome": "Lentes Traseiras Moto G10 / G20 / G30",
     "modelos": ["Moto G10", "Moto G20", "Moto G30"], "notas": "Lentes traseiras unificadas."},
    {"categoria": "Carcaça", "nome": "Tampa Traseira Moto G10 / G20 / G30",
     "modelos": ["Moto G10", "Moto G20", "Moto G30"], "notas": "Tampas traseiras unificadas."},
    {"categoria": "Carcaça", "nome": "Tampa Traseira Moto G04 / G24",
     "modelos": ["Moto G04", "Moto G24"], "notas": "Tampas traseiras unificadas."},
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
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Poco X3 / X3 NFC / X3 Pro",
     "modelos": ["Poco X3", "Poco X3 NFC", "Poco X3 Pro"], "notas": "Placa sub e flex main idênticos."},
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
    # --- Inventário consolidado (nov/2026)
    {"categoria": "Display", "nome": "Tela Frontal Redmi 13C / Poco C65",
     "modelos": ["Redmi 13C", "Poco C65"], "notas": "Painel unificado."},
    {"categoria": "Display", "nome": "Tela Frontal Redmi 14C / Poco C75",
     "modelos": ["Redmi 14C", "Poco C75"], "notas": "Painel unificado."},
    {"categoria": "Display", "nome": "Tela Frontal Redmi Note 13 Pro 5G / Poco X6 5G",
     "modelos": ["Redmi Note 13 Pro 5G", "Poco X6 5G"], "notas": "Painel unificado."},
    {"categoria": "Bateria", "nome": "Bateria BN56",
     "modelos": ["Redmi 9A", "Redmi 9C"]},
    {"categoria": "Bateria", "nome": "Bateria BN5A",
     "modelos": ["Redmi Note 10 5G", "Poco M3 Pro"]},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Redmi 12C / Poco C55",
     "modelos": ["Redmi 12C", "Poco C55"], "notas": "Placa sub unificada."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Redmi 13C / Poco C65",
     "modelos": ["Redmi 13C", "Poco C65"], "notas": "Placa sub unificada."},
    {"categoria": "Subplaca", "nome": "Placa Sub de Carga Redmi 14C / Poco C75",
     "modelos": ["Redmi 14C", "Poco C75"], "notas": "Placa sub unificada."},
    {"categoria": "Câmera", "nome": "Módulos e Lentes de Câmera Redmi 14C / Poco C75",
     "modelos": ["Redmi 14C", "Poco C75"], "notas": "Módulos e lentes unificados."},
]

# --------------------------------------------------------------------------- APPLE
_IPHONE_11_TO_16 = [
    "iPhone 11", "iPhone 11 Pro", "iPhone 11 Pro Max",
    "iPhone 12", "iPhone 12 Pro", "iPhone 12 Pro Max",
    "iPhone 13", "iPhone 13 Mini", "iPhone 13 Pro", "iPhone 13 Pro Max",
    "iPhone 14", "iPhone 14 Pro", "iPhone 14 Pro Max",
    "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro", "iPhone 15 Pro Max",
    "iPhone 16", "iPhone 16 Pro Max",
]

APPLE = [
    {"categoria": "Carcaça", "nome": "Carcaça / Chassi iPhone 8 / SE 2020",
     "modelos": ["iPhone 8", "iPhone SE 2020"], "notas": "Carcaças compatíveis (muda apenas a estética da maçã)."},
    {"categoria": "Bateria", "nome": "Bateria A2479 iPhone 12 / 12 Pro",
     "modelos": ["iPhone 12", "iPhone 12 Pro"],
     "notas": "Mesma célula. Transplante do flex BMS necessário para evitar a mensagem de peça desconhecida."},
    {"categoria": "Display", "nome": "Tela Frontal Retina HD iPhone 8 / SE (2ª e 3ª Geração)",
     "modelos": ["iPhone 8", "iPhone SE 2020", "iPhone SE 2022"],
     "notas": "Frontal unificada (3D Touch opera como Haptic no SE)."},
    {"categoria": "Display", "nome": "Tela Frontal OLED iPhone 12 / 12 Pro (6.1\")",
     "modelos": ["iPhone 12", "iPhone 12 Pro"],
     "notas": "Painel OLED unificado (Exige regravação de True Tone)."},
    {"categoria": "Display", "nome": "Display iPhone 11 ao 16 Pro Max (Hard OLED / Soft OLED / Incell / Repart)",
     "modelos": _IPHONE_11_TO_16,
     "notas": "Categorizados individualmente por tecnologia (Hard OLED, Soft OLED, Incell, Basic, Repart). Sem compatibilidade cruzada além do 12/12 Pro."},
    {"categoria": "Bateria", "nome": "Baterias Exclusivas iPhone 6 ao 16 Pro Max e iPads (Com Flex / Decode Sem Flex)",
     "modelos": [
         "iPhone 6", "iPhone 6s", "iPhone 6s Plus", "iPhone 7", "iPhone 7 Plus",
         "iPhone 8", "iPhone 8 Plus", "iPhone SE (1ª geração)", "iPhone SE 2020", "iPhone SE 2022",
         "iPhone X", "iPhone XR", "iPhone XS", "iPhone XS Max",
         *_IPHONE_11_TO_16,
         "iPad 6ª geração", "iPad Air", "iPad Air 2",
     ],
     "notas": "Cadastradas com atributo 'Com Flex' ou 'Decode / Sem Flex' para transplante de BMS."},
    {"categoria": "Flex", "nome": "Flex ALS (Sensor de Proximidade / Luminosidade) — iPhone 11 ao 16 Pro Max",
     "modelos": _IPHONE_11_TO_16,
     "notas": "Organizado por sistema físico exclusivo de cada modelo."},
    {"categoria": "Flex", "nome": "Flex NFC / Bobina de Indução / Flash — iPhone 11 ao 16 Pro Max",
     "modelos": _IPHONE_11_TO_16,
     "notas": "Organizado por sistema físico exclusivo de cada modelo."},
    {"categoria": "Flex", "nome": "Flex Power / Volume / Botão de Ação — iPhone 11 ao 16 Pro Max",
     "modelos": _IPHONE_11_TO_16,
     "notas": "Organizado por sistema físico exclusivo de cada modelo."},
    {"categoria": "Biometria", "nome": "Biometrias e Botão Home (Touch ID) — iPhone 6 ao 8 Plus / SE",
     "modelos": [
         "iPhone 6", "iPhone 6s", "iPhone 6s Plus", "iPhone 7", "iPhone 7 Plus",
         "iPhone 8", "iPhone 8 Plus", "iPhone SE (1ª geração)", "iPhone SE 2020", "iPhone SE 2022",
     ],
     "notas": "Separado por geração. Touch ID original é pareado com a placa-mãe."},
    {"categoria": "Câmera", "nome": "Módulos de Câmera e Lentes Safira (Lente + Frame + OCA) — iPhone 11 ao 16 Pro Max",
     "modelos": _IPHONE_11_TO_16,
     "notas": "Lentes Safira, Lente+Frame+OCA e Módulos separados estritamente por modelo."},
    {"categoria": "Carcaça", "nome": "Vidro Traseiro iPhone (Com Aro e Ímã / Furo Maior OEM)",
     "modelos": ["iPhone 8", "iPhone 8 Plus", "iPhone X", "iPhone XR", "iPhone XS", "iPhone XS Max", *_IPHONE_11_TO_16],
     "notas": "Agrupados por modelo com variações: Com Aro e Ímã, Furo Maior OEM e Cores."},
    {"categoria": "Carcaça", "nome": "Carcaça Completa iPhone (Com Flex / Sem Flex / Gaveta SIM / e-SIM)",
     "modelos": ["iPhone 8", "iPhone 8 Plus", "iPhone SE 2020", "iPhone SE 2022", "iPhone X", "iPhone XR", "iPhone XS", "iPhone XS Max", *_IPHONE_11_TO_16],
     "notas": "Agrupadas por modelo com variações: Com Flex, Sem Flex, Gaveta SIM, e-SIM e Cor."},
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
    {"categoria": "Display", "nome": "Tela Frontal Realme C61 / C63",
     "modelos": ["C61", "C63"], "notas": "Frontal unificada."},
]

# --------------------------------------------------------------------------- INFORMÁTICA & MAQUINÁRIO
DELL = [
    {"categoria": "Informática", "nome": "Telas, Baterias, Palmrests e Dobradiças — Dell Latitude / Vostro / Inspiron",
     "modelos": ["Latitude 3410", "Latitude 3420", "Latitude 5400", "Latitude 5410", "Latitude 5420", "Vostro 3400", "Vostro 3510", "Vostro 5402", "Inspiron"],
     "notas": "Estoque auxiliar de peças para notebooks Dell."},
]

LENOVO = [
    {"categoria": "Informática", "nome": "Telas, Baterias, Palmrests e Dobradiças — Lenovo ThinkPad / V15 / IdeaPad",
     "modelos": ["ThinkPad E14 (Gen 1 a Gen 6)", "ThinkPad T470", "ThinkPad T480", "Lenovo V15", "IdeaPad 320 / S145"],
     "notas": "Estoque auxiliar de peças para notebooks Lenovo."},
]

HP = [
    {"categoria": "Informática", "nome": "Telas, Baterias, Palmrests e Dobradiças — HP ProBook / Linha 240 e 250",
     "modelos": ["ProBook 440 G7 / G9", "HP 240 G7", "HP 250 G8 / G9"],
     "notas": "Estoque auxiliar de peças para notebooks HP."},
]

REFOX = [
    {"categoria": "Maquinário & Insumos", "nome": "Laser e Separação Refox — LM80E / RK10 (UV) / Separadoras RF20 e RF40",
     "modelos": ["LM80E (Laser)", "RK10 (UV)", "Separadora RF20", "Separadora RF40"],
     "notas": "Equipamentos de bancada Refox para separação e remoção a laser."},
    {"categoria": "Maquinário & Insumos", "nome": "Laminação e Tira-Bolhas Refox — FM45 / Estufas UV RM26 e RM22",
     "modelos": ["Laminadora FM45", "Estufa UV RM26", "Estufa UV RM22"],
     "notas": "Equipamentos Refox para recondicionamento de telas e cura UV."},
    {"categoria": "Maquinário & Insumos", "nome": "Insumos e Ferramentas Refox — Cola SupBond RA21 / Fio de Aço / OCA 250um / DF40 / DF45 / Chaves RS2 e RS3",
     "modelos": ["Cola SupBond RA21", "Fio de Aço (0.028mm a 0.08mm)", "Cola OCA 250um", "Organizadores DF40 / DF45", "Chaves de Precisão RS2 / RS3"],
     "notas": "Insumos e ferramentas de precisão para bancada."},
]

MASTER_GROUPS = (
    [dict(g, marca="Samsung") for g in SAMSUNG]
    + [dict(g, marca="Motorola") for g in MOTOROLA]
    + [dict(g, marca="Xiaomi") for g in XIAOMI]
    + [dict(g, marca="Apple") for g in APPLE]
    + [dict(g, marca="LG") for g in LG]
    + [dict(g, marca="Realme") for g in REALME]
    + [dict(g, marca="Dell") for g in DELL]
    + [dict(g, marca="Lenovo") for g in LENOVO]
    + [dict(g, marca="HP") for g in HP]
    + [dict(g, marca="Refox") for g in REFOX]
)

# Peças que ganharam novos modelos e mudaram de nome: o registro antigo é renomeado
# (mantendo id e vínculos) em vez de criar uma peça duplicada.
RENAMES = {
    "Tela Frontal Galaxy A02s (SM-A025) / A03s (SM-A037) — sem aro":
        "Tela Frontal Galaxy A02s / A03s / A03 Core / A04e — sem aro",
    "Tela Frontal Moto G13 / G23 — sem aro": "Tela Frontal Moto G13 / G23 / G34 / G45 / G53 — sem aro",
    "Tela Frontal Moto G04 / G04s / G24 — sem aro": "Tela Frontal Moto G04 / G04s / G24 / G24 Power — sem aro",
    "Placa Sub de Carga Poco X3 NFC / Poco X3 Pro": "Placa Sub de Carga Poco X3 / X3 NFC / X3 Pro",
}

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
    # --- Regras do inventário consolidado (nov/2026)
    {"target_device": "Motorola Moto G32 / G52 / G62 / G72 / G82 / G73", "category": "Compatibilidade",
     "ai_context_text": "As frontais do Moto G32, G52, G62, G72, G82 e G73 formam um agrupamento de compatibilidade física. Antes de trocar, diferencie a versão LCD ou OLED de acordo com o aparelho do cliente.",
     "tags": "moto g32, moto g52, moto g62, moto g72, moto g82, moto g73, tela, lcd, oled"},
    {"target_device": "Samsung Galaxy A14 4G / A14 5G", "category": "Compatibilidade",
     "ai_context_text": "A placa sub (conector de carga) do Galaxy A14 4G e a do A14 5G são componentes diferentes e incompatíveis entre si. Confirme a versão do aparelho antes de pedir a peça.",
     "tags": "galaxy a14, a14 4g, a14 5g, placa sub, conector de carga, incompatível"},
    {"target_device": "Apple iPhone 11 ao 17 Pro Max", "category": "Compatibilidade",
     "ai_context_text": "Displays de iPhone 11 ao 17 Pro Max são cadastrados individualmente por modelo e por tecnologia (Hard OLED, Soft OLED, Incell, Basic, Repart). Não há compatibilidade cruzada entre modelos, exceto iPhone 12 e 12 Pro, que usam o mesmo painel OLED (exige regravação do True Tone).",
     "tags": "iphone, display, tela, hard oled, soft oled, incell, repart, true tone"},
    {"target_device": "Apple iPhone / Apple Watch / iPad", "category": "Compatibilidade",
     "ai_context_text": "Baterias Apple (Deji, Decode e originais) de iPhone 5 ao 16 Pro Max, Apple Watch (S3 ao S10 e Ultra) e iPads (Air, Mini, Pro) são exclusivas por modelo — a única unificada é a A2479 (iPhone 12 / 12 Pro). Elas vêm 'Com Flex' ou 'Decode / Sem Flex'; nas versões sem flex é preciso transplantar o BMS da bateria original.",
     "tags": "iphone, apple watch, ipad, bateria, deji, decode, com flex, sem flex, bms"},
    {"target_device": "Apple iPhone 11 ao 17 Pro Max", "category": "Compatibilidade",
     "ai_context_text": "Câmeras de iPhone 11 ao 17 Pro Max (lente safira, lente + frame + OCA e módulos) e flexes (ALS de proximidade/luminosidade, NFC / bobina de indução / flash, power / volume / botão de ação) são separados estritamente por modelo — não há intercâmbio entre modelos. Biometria e botão Home são organizados do iPhone 6 ao 8 Plus / SE.",
     "tags": "iphone, câmera, lente safira, flex als, flex nfc, bobina indução, flash, flex power, volume, botão de ação, home, biometria"},
    {"target_device": "Apple iPhone", "category": "Compatibilidade",
     "ai_context_text": "Vidros traseiros de iPhone são agrupados por modelo (Vidro Traseiro [Modelo]) com variações: com aro e ímã, furo maior OEM e cores. Carcaças são agrupadas como Carcaça Completa [Modelo] com variações: com flex, sem flex, gaveta SIM, e-SIM e cor. Confira a variação certa para o aparelho do cliente.",
     "tags": "iphone, vidro traseiro, carcaça, aro, ímã, furo maior, e-sim, gaveta sim"},
]


NON_MOBILE_BRANDS = {"dell", "lenovo", "hp", "refox", "sony", "outros"}

DEVICE_ALIASES = {
    ("motorola", "motorola one"): ("Motorola", "Moto One"),
    ("motorola", "motorola one action"): ("Motorola", "Moto One Action"),
    ("motorola", "motorola one fusion"): ("Motorola", "Moto One Fusion"),
    ("motorola", "motorola one macro"): ("Motorola", "Moto One Macro"),
    ("motorola", "motorola one vision"): ("Motorola", "Moto One Vision"),
    ("motorola", "motorola edge 40"): ("Motorola", "Moto Edge 40"),
    ("motorola", "motorola edge 40 neo"): ("Motorola", "Moto Edge 40 Neo"),
    ("motorola", "motorola edge 50 fusion"): ("Motorola", "Moto Edge 50 Fusion"),
    ("motorola", "motorola edge 60 neo"): ("Motorola", "Moto Edge 60 Neo"),
    ("apple", "iphone se (2ª geração)"): ("Apple", "iPhone SE 2020"),
    ("apple", "iphone se (3ª geração)"): ("Apple", "iPhone SE 2022"),
    ("xiaomi", "14c"): ("Xiaomi", "Redmi 14C"),
    ("samsung", "galaxy j7 pro"): ("Samsung", "Galaxy J7 Pro"),
}

PART_MERGES = {
    "Bateria BN57 (Poco X3 / Poco X3 NFC / Poco X3 Pro)":
        "Bateria BN57 (5160mAh) — Poco X3 / Poco X3 NFC / Poco X3 Pro",
    "Tela OLED iPhone 12 / 12 Pro Universal":
        'Tela OLED iPhone 12 / 12 Pro Universal (6.1")',
    "Tela Super AMOLED Redmi Note 10 4G / Note 11 4G / Poco M5s":
        "Tela Super AMOLED Redmi Note 10 4G / Note 10S / Note 11 4G / Note 11S / Poco M5s",
}

ORPHAN_PART_REPAIRS = {
    "Câmera Traseira Iphone 13 / 13 pro": ("Apple", ["iPhone 13", "iPhone 13 Pro"], None),
    "Bateria A2111 (iPhone 11) — 3110mAh": ("Apple", ["iPhone 11"], "Bateria 3110mAh (A2111) exclusiva do iPhone 11."),
    "Flex de proximidade iPhone 11": ("Apple", ["iPhone 11"], "Sensor de proximidade / auricular pareado com Face ID."),
}


def _default_device_attrs(marca: str, modelo: str) -> tuple[str | None, bool]:
    """Define método de abertura e alerta de flex padrão por marca/modelo."""
    brand_low = (marca or "").strip().lower()
    mod_low = (modelo or "").strip().lower()
    if brand_low in NON_MOBILE_BRANDS or "roteador" in mod_low:
        return None, False
    if brand_low == "apple":
        if "ipad" in mod_low:
            return "Frontal", True
        # iPhone 14 (base), 14 Plus, e linha 15/16/17 abrem pela traseira (14 Pro/Max abrem pela frontal)
        is_rear_iphone = (
            mod_low == "iphone 14"
            or "14 plus" in mod_low
            or any(v in mod_low for v in ("iphone 15", "iphone 16", "iphone 17"))
        )
        return ("Traseira" if is_rear_iphone else "Frontal"), True
    return "Traseira", True


def _merge_or_rename_devices(db) -> None:
    """Unifica aparelhos duplicados com grafias diferentes mantendo compatibilidades."""
    all_devs = db.query(Device).order_by(Device.id).all()
    by_key = {( (d.marca or "").strip().lower(), (d.modelo or "").strip().lower() ): d for d in all_devs}
    compat_pairs = {(c.device_id, c.part_id) for c in db.query(Compatibility).all()}

    for d in all_devs:
        key = ((d.marca or "").strip().lower(), (d.modelo or "").strip().lower())
        target_spec = DEVICE_ALIASES.get(key)
        if not target_spec:
            continue
        t_marca, t_modelo = target_spec
        t_key = (t_marca.lower(), t_modelo.lower())
        if d.marca == t_marca and d.modelo == t_modelo:
            continue
        target = by_key.get(t_key)
        if target and target.id != d.id:
            for c in db.query(Compatibility).filter_by(device_id=d.id).all():
                if (target.id, c.part_id) not in compat_pairs:
                    c.device_id = target.id
                    compat_pairs.add((target.id, c.part_id))
                else:
                    db.delete(c)
            if not target.opening_method and d.opening_method:
                target.opening_method = d.opening_method
            target.has_flex_cable = bool(target.has_flex_cable or d.has_flex_cable)
            by_key.pop(key, None)
            db.delete(d)
        else:
            by_key.pop(key, None)
            d.marca = t_marca
            d.modelo = t_modelo
            by_key[t_key] = d
    db.flush()


def _merge_duplicate_parts(db) -> None:
    """Higieniza categorias com espaços e mescla peças duplicadas conhecidas."""
    parts = db.query(Part).order_by(Part.id).all()
    for p in parts:
        if p.categoria and p.categoria != p.categoria.strip():
            p.categoria = p.categoria.strip()

    by_name = {p.nome: p for p in parts}
    compat_pairs = {(c.device_id, c.part_id) for c in db.query(Compatibility).all()}

    for old_name, keep_name in PART_MERGES.items():
        old = by_name.get(old_name)
        keep = by_name.get(keep_name)
        if not old or not keep or old.id == keep.id:
            continue
        for c in db.query(Compatibility).filter_by(part_id=old.id).all():
            if (c.device_id, keep.id) not in compat_pairs:
                c.part_id = keep.id
                compat_pairs.add((c.device_id, keep.id))
            else:
                db.delete(c)
        db.delete(old)
    db.flush()


def seed_compat_master(db) -> dict:
    """Cria (sem duplicar) aparelhos, peças, vínculos e dicas da lista mestra."""
    new_devices = new_parts = new_links = new_articles = 0

    _merge_or_rename_devices(db)
    _merge_duplicate_parts(db)

    # Carrega registros em memória com 1 SELECT por tabela para inicialização rápida
    existing_parts = {p.nome: p for p in db.query(Part).all()}
    for old_name, new_name in RENAMES.items():
        old = existing_parts.get(old_name)
        if old and new_name not in existing_parts:
            old.nome = new_name
            existing_parts.pop(old_name)
            existing_parts[new_name] = old
    db.flush()

    existing_devices = {
        ((d.marca or "").strip().lower(), (d.modelo or "").strip().lower()): d
        for d in db.query(Device).all()
    }
    # Preenche método de abertura padrão para aparelhos que ficaram sem essa informação
    for d in existing_devices.values():
        if d.opening_method is None and (d.marca or "").strip().lower() not in NON_MOBILE_BRANDS:
            opening, flex = _default_device_attrs(d.marca, d.modelo)
            if opening:
                d.opening_method = opening
                d.has_flex_cable = flex

    existing_links = {(c.device_id, c.part_id) for c in db.query(Compatibility).all()}

    def _ensure_device(marca: str, modelo: str) -> Device:
        nonlocal new_devices
        key = (marca.lower(), modelo.lower())
        device = existing_devices.get(key)
        if not device:
            opening, flex = _default_device_attrs(marca, modelo)
            device = Device(marca=marca, modelo=modelo, opening_method=opening, has_flex_cable=flex)
            db.add(device)
            db.flush()
            existing_devices[key] = device
            new_devices += 1
        return device

    for group in MASTER_GROUPS:
        part = existing_parts.get(group["nome"])
        if not part:
            part = Part(nome=group["nome"], categoria=group["categoria"])
            db.add(part)
            db.flush()
            existing_parts[group["nome"]] = part
            new_parts += 1

        for item in group["modelos"]:
            modelo, nota = (item, None) if isinstance(item, str) else item
            nota = nota or group.get("notas")
            device = _ensure_device(group["marca"], modelo)
            if (device.id, part.id) not in existing_links:
                db.add(Compatibility(device_id=device.id, part_id=part.id, notas=nota))
                existing_links.add((device.id, part.id))
                new_links += 1

    # Vincula peças órfãs legadas caso já existam no banco (sem criar novas peças)
    for part_name, (marca, modelos, nota) in ORPHAN_PART_REPAIRS.items():
        part = existing_parts.get(part_name)
        if not part:
            continue
        for modelo in modelos:
            dev = existing_devices.get((marca.lower(), modelo.lower()))
            if dev and (dev.id, part.id) not in existing_links:
                db.add(Compatibility(device_id=dev.id, part_id=part.id, notas=nota))
                existing_links.add((dev.id, part.id))
                new_links += 1

    existing_articles = {
        (a.target_device, a.ai_context_text) for a in db.query(WikiArticle).all()
    }
    for item in MASTER_ARTICLES:
        key = (item["target_device"], item["ai_context_text"])
        if key not in existing_articles:
            db.add(WikiArticle(**item))
            existing_articles.add(key)
            new_articles += 1

    db.flush()
    return {"devices": new_devices, "parts": new_parts, "compatibilities": new_links, "articles": new_articles}
