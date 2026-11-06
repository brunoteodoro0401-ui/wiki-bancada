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
from models import Compatibility, Device, Part, TrustedSource, User, WikiArticle
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

# ==================== Base Expandida Real de Manutenção ====================
EXTENDED_ARTICLES = [
    {
        "target_device": "iPhone (Face ID Geral)",
        "category": "Alerta Químico",
        "ai_context_text": "NUNCA aplique álcool isopropílico ou limpa-contato diretamente sobre o Dot Projector / câmera infravermelha do Face ID (iPhone X ao 15). O solvente dissolve o revestimento óptico dos cristais e inutiliza o Face ID permanentemente.",
        "tags": "iphone, face id, dot projector, alcool isopropilico, camera frontal",
    },
    {
        "target_device": "iPhone 12 / 12 Pro",
        "category": "Procedimento",
        "ai_context_text": "Abertura frontal: o aro cerâmico e a cola são muito mais rígidos que no iPhone 11. Aqueça a 80-85°C por 3 minutos. O cabo flex da tela fica no lado ESQUERDO (diferente do iPhone 11 que fica na direita). Não insira espátula profunda na lateral esquerda.",
        "tags": "iphone 12, iphone 12 pro, abertura, flex tela, esquerda, calor",
    },
    {
        "target_device": "iPhone 13 Pro / 13 Pro Max",
        "category": "Microsoldagem",
        "ai_context_text": "Defeito crônico de Tela Branca / Verde após atualização ou uso normal (display original sem trincos): falha na malha de sincronismo 120Hz no flex da tela. Solução de bancada: raspar os pontos de teste no verso do display e fazer jumper com fio esmaltado 0.02mm entre os pontos de alimentação/sinal (TP13/TP14 conforme revisão do display).",
        "tags": "iphone 13 pro, iphone 13 pro max, tela branca, tela verde, jumper, 120hz",
    },
    {
        "target_device": "iPhone 14 / 14 Plus",
        "category": "Procedimento",
        "ai_context_text": "O iPhone 14 base e 14 Plus abrem tanto pela frente (para trocar tela) quanto por trás (para trocar tampa traseira e bateria). Cuidado ao abrir a tampa traseira: o cabo flex do carregamento por indução (MagSafe) e flash LED é curtíssimo e rasga se puxar a tampa.",
        "tags": "iphone 14, iphone 14 plus, tampa traseira, abertura, magsafe, flex flash",
    },
    {
        "target_device": "iPhone (Áudio / Auricular)",
        "category": "Procedimento",
        "ai_context_text": "Som baixo no auricular (alto-falante superior): antes de desmontar o aparelho e correr risco no flex do Face ID, aplique uma gota mínima de álcool isopropílico na malha externa, escove com escova antiestática macia e use massa adesiva (Rodico / limpa-tipo) para puxar a sujeira da grade.",
        "tags": "iphone, som baixo, auricular, limpeza, rodico, alto falante",
    },
    {
        "target_device": "Samsung Linha A (A14 / A15 / A34 / A54)",
        "category": "Diagnóstico",
        "ai_context_text": "Aparelho não carrega ou exibe o triângulo amarelo com termômetro ('Temperatura da bateria muito baixa/alta'): 90% dos casos é oxidação na subplaca de carga (conector FPC) ou falha no termistor NTC presente na própria subplaca. Troque por subplaca original/com CI completo (subplacas paralelas sem termistor causam esse erro).",
        "tags": "samsung, a14, a15, a34, a54, termometro, temperatura baixa, nao carrega, subplaca, termistor",
    },
    {
        "target_device": "Samsung Galaxy A54 / S21 FE / S23",
        "category": "Procedimento",
        "ai_context_text": "Leitor de digital óptico na tela não funciona após troca de frontal: 1) Certifique-se de que a borracha/espuma de vedação óptica sob a câmera da digital não ficou obstruída. 2) Caso use tela paralela OLED, prefira modelo 'Com Aro' que já vem na altura exata focal do sensor. 3) Apague as digitais antigas e recadastre.",
        "tags": "samsung, biometria, digital na tela, a54, s21 fe, s23, sensor optico, tela oled",
    },
    {
        "target_device": "Samsung Galaxy S20 FE / S21 FE",
        "category": "Diagnóstico",
        "ai_context_text": "Falha de carregamento rápido ou touch fantasma: verifique o cabo flex principal que interliga a placa-mãe à subplaca (passa por cima da bateria). Com o aquecimento da bateria, os terminais FPC sofrem mau contato. Refaça a solda do conector FPC na placa principal ou substitua o flex interplaca.",
        "tags": "samsung, s20 fe, s21 fe, nao carrega, flex interplaca, fpc, touch fantasma",
    },
    {
        "target_device": "Motorola Moto G22 / G32 / G52 / G53",
        "category": "Procedimento",
        "ai_context_text": "Cuidado crítico na abertura traseira: o cabo flex da biometria (botão Power na lateral direita) é extremamente curto e colado próximo à borda do aro. Ao remover a tampa traseira e desparafusar o aro intermediário, solte o aro pelo lado ESQUERDO primeiro e desconecte o flex do botão Power antes de puxar a carcaça.",
        "tags": "motorola, moto g22, moto g32, moto g52, moto g53, biometria, flex power, abertura",
    },
    {
        "target_device": "Motorola Moto G52 / G82 / Edge 30",
        "category": "Compatibilidade",
        "ai_context_text": "Telas P-OLED originais desses modelos são ultrafinas. Se o cliente optar por tela Incell (LCD mais grossa), o consumo de bateria aumenta em ~30%, o aparelho aquece mais na parte inferior e a tampa pode ficar levemente alta. Oriente sempre o cliente antes de instalar versão Incell em aparelhos nativos OLED.",
        "tags": "motorola, moto g52, edge 30, tela oled, tela incell, aquecimento, consumo bateria",
    },
    {
        "target_device": "Motorola (Geral)",
        "category": "Diagnóstico",
        "ai_context_text": "Aparelho totalmente apagado que não dá sinal no carregador comum, mas consome ~0.09A a 0.45A na fonte/USB Meter: segure Power + Volume Menos por 30 segundos completos com o cabo conectado (Forced Reboot do bootloader Qualcomm/MediaTek). Muitos aparelhos travam em modo EDL/Fastboot oculto.",
        "tags": "motorola, nao liga, apagado, fastboot, edl, forced reboot, power volume menos",
    },
    {
        "target_device": "Xiaomi Poco M3 / Redmi 9T",
        "category": "Microsoldagem",
        "ai_context_text": "Defeito crônico clássico 'Dead Boot' (não liga após reiniciar ou descarregar e trava em modo EDL 9008 no PC): falha de solda fria/capacitância no circuito ao redor do CI controlador de carga/energia (BQ25601 / PM4250). Solução: remover a blindagem metálica acima do conector da bateria e fazer reflow/ressolda ou troca do capacitor/bobina de filtragem do PMIC.",
        "tags": "xiaomi, poco m3, redmi 9t, dead boot, nao liga, edl 9008, pmic, blindagem",
    },
    {
        "target_device": "Xiaomi Poco X3 Pro",
        "category": "Microsoldagem",
        "ai_context_text": "Aparelho apaga de repente, fica em tela cinza/azul com pontilhado ou morre totalmente: defeito crônico de solda BGA na memória RAM empilhada sobre a CPU (Snapdragon 860 - SM8150) e/ou PMIC (PM8150). O reparo definitivo exige Reballing de CPU + RAM com estanho em pasta 183°C.",
        "tags": "xiaomi, poco x3 pro, nao liga, tela cinza, reballing, cpu, ram, pmic",
    },
    {
        "target_device": "Xiaomi Redmi Note 10 / 11 / 12",
        "category": "Resolução de Problemas",
        "ai_context_text": "Aparelho reiniciando sozinho na logo MIUI / HyperOS ou abrindo o menu Recovery sem parar: em 85% dos casos é curto ou oxidação no botão flex Power/Volume (muito sensível a suor). Desconecte o flex dos botões laterais assim que aparecer a logo da Xiaomi; se iniciar normalmente, basta substituir o flex do botão Power.",
        "tags": "xiaomi, redmi note 10, redmi note 11, redmi note 12, loop infinito, reiniciando, botao power, recovery",
    },
    {
        "target_device": "Geral (Bancada / Microsoldagem)",
        "category": "Diagnóstico",
        "ai_context_text": "Diagnóstico na Fonte de Bancada (4.2V / 3A): 1) Consumo antes de apertar Power = curto na malha primária (VBAT / VPH_PWR). Use câmera térmica ou breu (rosin) para achar o capacitor aquecendo. 2) Consumo zero ao apertar Power = verifique tensão de 1.8V no botão Power e cristal oscilador / PMIC. 3) Consumo trava em 60mA–120mA fixo = falha de comunicação I2C, memória (eMMC/UFS) ou CPU.",
        "tags": "fonte de bancada, diagnostico, curto, vbat, vph_pwr, breu, consumo, pmic",
    },
    {
        "target_device": "Geral (Troca de Telas)",
        "category": "Procedimento",
        "ai_context_text": "Regra de ouro ao testar e instalar telas novas: 1) SEMPRE desconecte a bateria antes de conectar ou desconectar o cabo flex do display (evita queima do filtro do backlight/fusível da placa). 2) Teste touch em toda a grade, brilho mínimo/máximo e sensor de proximidade ANTES de remover os selos e colar. 3) Use cola B-7000 (transparente) ou T-7000 (preta) apenas na borda do aro, longe da câmera frontal e auricular.",
        "tags": "troca de tela, backlight, bateria desconectada, b7000, t7000, teste touch, sensor proximidade",
    },
]

EXTENDED_DEVICES = [
    ("Apple", "iPhone 8", "Frontal", True),
    ("Apple", "iPhone SE 2020", "Frontal", True),
    ("Apple", "iPhone SE 2022", "Frontal", True),
    ("Apple", "iPhone XR", "Frontal", True),
    ("Apple", "iPhone 12 Pro", "Frontal", True),
    ("Apple", "iPhone 13 Pro", "Frontal", True),
    ("Apple", "iPhone 13 Pro Max", "Frontal", True),
    ("Apple", "iPhone 14 Pro Max", "Frontal", True),
    ("Apple", "iPhone 15", "Traseira", True),
    ("Samsung", "Galaxy A02", "Traseira", True),
    ("Samsung", "Galaxy A02s", "Traseira", True),
    ("Samsung", "Galaxy A03", "Traseira", True),
    ("Samsung", "Galaxy A03s", "Traseira", True),
    ("Samsung", "Galaxy A12", "Traseira", True),
    ("Samsung", "Galaxy M12", "Traseira", True),
    ("Samsung", "Galaxy A13 4G", "Traseira", True),
    ("Samsung", "Galaxy M14 5G", "Traseira", True),
    ("Samsung", "Galaxy A15", "Traseira", True),
    ("Samsung", "Galaxy A32 4G", "Traseira", True),
    ("Samsung", "Galaxy M32", "Traseira", True),
    ("Samsung", "Galaxy A34", "Traseira", True),
    ("Samsung", "Galaxy A54", "Traseira", True),
    ("Samsung", "Galaxy S20 FE", "Traseira", True),
    ("Samsung", "Galaxy S21 FE", "Traseira", True),
    ("Motorola", "Moto G7 Power", "Traseira", True),
    ("Motorola", "Moto G8 Power Lite", "Traseira", True),
    ("Motorola", "Moto G9 Play", "Traseira", True),
    ("Motorola", "Moto G10", "Traseira", True),
    ("Motorola", "Moto G20", "Traseira", True),
    ("Motorola", "Moto G30", "Traseira", True),
    ("Motorola", "Moto E32", "Traseira", True),
    ("Motorola", "Moto G32", "Traseira", True),
    ("Motorola", "Moto G52", "Traseira", True),
    ("Motorola", "Moto G60", "Traseira", True),
    ("Motorola", "Moto G82", "Traseira", True),
    ("Motorola", "Edge 30", "Traseira", True),
    ("Xiaomi", "Redmi 9A", "Traseira", True),
    ("Xiaomi", "Redmi 9C", "Traseira", True),
    ("Xiaomi", "Redmi 10A", "Traseira", True),
    ("Xiaomi", "Redmi Note 9S", "Traseira", True),
    ("Xiaomi", "Redmi Note 9 Pro", "Traseira", True),
    ("Xiaomi", "Poco M3", "Traseira", True),
    ("Xiaomi", "Redmi 9T", "Traseira", True),
    ("Xiaomi", "Poco X3 Pro", "Traseira", True),
    ("Xiaomi", "Redmi Note 10 4G", "Traseira", True),
    ("Xiaomi", "Redmi Note 10S", "Traseira", True),
    ("Xiaomi", "Redmi Note 11", "Traseira", True),
    ("Xiaomi", "Redmi Note 11S", "Traseira", True),
    ("Xiaomi", "Poco M5s", "Traseira", True),
    ("Xiaomi", "Redmi Note 12 4G", "Traseira", True),
]

EXTENDED_PARTS = [
    ("Tela OLED iPhone 12 / 12 Pro Universal (6.1\")", "Display"),
    ("Tela Retina HD iPhone SE 2020 / SE 2022 (Comp. iPhone 8)", "Display"),
    ("Bateria A2111 (iPhone 11) — 3110mAh", "Bateria"),
    ("Tela PLS LCD Universal Galaxy A02 / A12 / M12", "Display"),
    ("Tela PLS LCD Universal Galaxy A02s / A03 / A03s", "Display"),
    ("Tela PLS LCD Galaxy A14 5G (SM-A146) / Galaxy M14 5G", "Display"),
    ("Tela Super AMOLED Galaxy A32 4G / Galaxy M32 (Sem Aro)", "Display"),
    ("Bateria EB-BA217ABY (5000mAh) — Linha Samsung A02/A03s/A12/A13/A21s/M12", "Bateria"),
    ("Subplaca de Carga Original Galaxy A54 (com CI e NTC)", "Subplaca"),
    ("Tela Super AMOLED Redmi Note 10 4G / Note 10S / Note 11 4G / Note 11S / Poco M5s", "Display"),
    ("Tela IPS LCD Redmi 9A / Redmi 9C / Redmi 10A / Poco C3", "Display"),
    ("Tela IPS LCD Redmi Note 9S / Redmi Note 9 Pro / Poco M2 Pro", "Display"),
    ("Bateria BN57 (5160mAh) — Poco X3 / Poco X3 NFC / Poco X3 Pro", "Bateria"),
    ("Bateria BN59 (5000mAh) — Redmi Note 10 4G / Note 10S / Poco M5s", "Bateria"),
    ("Bateria BN62 (6000mAh) — Poco M3 / Redmi 9T", "Bateria"),
    ("Tela IPS LCD Moto G10 / Moto G20 / Moto G30", "Display"),
    ("Tela IPS LCD Moto G22 / Moto E32", "Display"),
    ("Tela P-OLED Moto G52 / Moto G82 (Sem Aro)", "Display"),
    ("Flex Botão Power / Biometria Moto G22 / G32 / E32", "Flex"),
    ("Bateria JK50 (5000mAh) — Moto G7 Power / G8 Power Lite / G9 Play / G20", "Bateria"),
]

EXTENDED_COMPATS = [
    ("iPhone 12", "Tela OLED iPhone 12 / 12 Pro Universal (6.1\")", "A mesma frontal serve tanto no iPhone 12 (6.1\") quanto no iPhone 12 Pro (6.1\"). Transfira o flex do auricular original para manter o Face ID."),
    ("iPhone 12 Pro", "Tela OLED iPhone 12 / 12 Pro Universal (6.1\")", "Totalmente compatível com iPhone 12 base (mesmo encaixe e protocolo de imagem/touch)."),
    ("iPhone 8", "Tela Retina HD iPhone SE 2020 / SE 2022 (Comp. iPhone 8)", "Mesmo display de 4.7\"; transfira o botão Home original e o flex da câmera/auricular."),
    ("iPhone SE 2020", "Tela Retina HD iPhone SE 2020 / SE 2022 (Comp. iPhone 8)", "Compatível com telas de iPhone 8 (atenção apenas a versões antigas de CI de touch em telas paralelas)."),
    ("iPhone SE 2022", "Tela Retina HD iPhone SE 2020 / SE 2022 (Comp. iPhone 8)", "Mesma estrutura frontal de 4.7\" do iPhone SE 2020; transfira o botão Home original."),
    ("Galaxy A02", "Tela PLS LCD Universal Galaxy A02 / A12 / M12", "Compatível na versão sem aro; verifique versão da subplaca (A125 vs A127) caso o touch não funcione."),
    ("Galaxy A12", "Tela PLS LCD Universal Galaxy A02 / A12 / M12", "Mesma frontal sem aro do A02 e M12. Atenção: com aro os botões laterais mudam."),
    ("Galaxy M12", "Tela PLS LCD Universal Galaxy A02 / A12 / M12", "Compatível na versão sem aro com Galaxy A12 e A02."),
    ("Galaxy A02s", "Tela PLS LCD Universal Galaxy A02s / A03 / A03s", "Mesma frontal sem aro entre A02s, A03 e A03s."),
    ("Galaxy A03", "Tela PLS LCD Universal Galaxy A02s / A03 / A03s", "Compatível sem aro com A02s e A03s."),
    ("Galaxy A03s", "Tela PLS LCD Universal Galaxy A02s / A03 / A03s", "Compatível sem aro; com aro o recorte da biometria no botão Power difere do A02s."),
    ("Galaxy A14", "Tela PLS LCD Galaxy A14 5G (SM-A146) / Galaxy M14 5G", "Atenção: Galaxy A14 4G (A145) e A14 5G (A146) têm conectores FPC diferentes. A versão A14 5G (A146B) é compatível sem aro com o M14 5G."),
    ("Galaxy M14 5G", "Tela PLS LCD Galaxy A14 5G (SM-A146) / Galaxy M14 5G", "Compatível na versão sem aro com a tela do Galaxy A14 5G (modelo SM-A146B)."),
    ("Galaxy A32 4G", "Tela Super AMOLED Galaxy A32 4G / Galaxy M32 (Sem Aro)", "Display sem aro é compatível com o Galaxy M32 (no A32 mantém leitor óptico de digital)."),
    ("Galaxy M32", "Tela Super AMOLED Galaxy A32 4G / Galaxy M32 (Sem Aro)", "Aceita a frontal sem aro do Galaxy A32 4G."),
    ("Galaxy A12", "Bateria EB-BA217ABY (5000mAh) — Linha Samsung A02/A03s/A12/A13/A21s/M12", "Bateria original Samsung SCUD-WT-N6 / EB-BA217ABY 5000mAh compatível com toda a família."),
    ("Galaxy A13 4G", "Bateria EB-BA217ABY (5000mAh) — Linha Samsung A02/A03s/A12/A13/A21s/M12", "Mesmo conector FPC e dimensões da bateria do A12/A21s."),
    ("Galaxy A03s", "Bateria EB-BA217ABY (5000mAh) — Linha Samsung A02/A03s/A12/A13/A21s/M12", "Compatível direta (5000mAh)."),
    ("Galaxy A54", "Subplaca de Carga Original Galaxy A54 (com CI e NTC)", "Exige subplaca com termistor NTC para não apresentar erro de temperatura alta/baixa ao carregar."),
    ("Redmi Note 10 4G", "Tela Super AMOLED Redmi Note 10 4G / Note 10S / Note 11 4G / Note 11S / Poco M5s", "Display sem aro é compatível entre Redmi Note 10 4G, Note 10S, Note 11 4G, Note 11S e Poco M5s (atenção: com aro os encaixes mudam)."),
    ("Redmi Note 10S", "Tela Super AMOLED Redmi Note 10 4G / Note 10S / Note 11 4G / Note 11S / Poco M5s", "Compatível na versão sem aro com Note 10 4G e Poco M5s."),
    ("Redmi Note 11", "Tela Super AMOLED Redmi Note 10 4G / Note 10S / Note 11 4G / Note 11S / Poco M5s", "Compatível na versão sem aro; verifique versão do flex antes de colar."),
    ("Redmi Note 11S", "Tela Super AMOLED Redmi Note 10 4G / Note 10S / Note 11 4G / Note 11S / Poco M5s", "Mesmo display sem aro do Redmi Note 11 4G."),
    ("Poco M5s", "Tela Super AMOLED Redmi Note 10 4G / Note 10S / Note 11 4G / Note 11S / Poco M5s", "O Poco M5s possui a mesma construção e tela do Redmi Note 10S."),
    ("Redmi 9A", "Tela IPS LCD Redmi 9A / Redmi 9C / Redmi 10A / Poco C3", "Frontal universal compatível entre Redmi 9A, 9C, 9i, 10A e Poco C3."),
    ("Redmi 9C", "Tela IPS LCD Redmi 9A / Redmi 9C / Redmi 10A / Poco C3", "Mesma frontal do Redmi 9A e 10A."),
    ("Redmi 10A", "Tela IPS LCD Redmi 9A / Redmi 9C / Redmi 10A / Poco C3", "Mesma frontal do Redmi 9A e 9C."),
    ("Redmi Note 9S", "Tela IPS LCD Redmi Note 9S / Redmi Note 9 Pro / Poco M2 Pro", "Frontal sem aro idêntica entre Redmi Note 9S, Note 9 Pro (Global) e Poco M2 Pro."),
    ("Redmi Note 9 Pro", "Tela IPS LCD Redmi Note 9S / Redmi Note 9 Pro / Poco M2 Pro", "Compatível com a tela sem aro do Redmi Note 9S."),
    ("Poco X3 Pro", "Bateria BN57 (5160mAh) — Poco X3 / Poco X3 NFC / Poco X3 Pro", "Bateria modelo BN57 5160mAh compatível com toda a família Poco X3 / X3 Pro."),
    ("Redmi Note 10 4G", "Bateria BN59 (5000mAh) — Redmi Note 10 4G / Note 10S / Poco M5s", "Bateria BN59 5000mAh compatível entre Note 10 4G, Note 10S e Poco M5s."),
    ("Poco M3", "Bateria BN62 (6000mAh) — Poco M3 / Redmi 9T", "Bateria BN62 de 6000mAh compartilhada entre Poco M3 e Redmi 9T."),
    ("Redmi 9T", "Bateria BN62 (6000mAh) — Poco M3 / Redmi 9T", "Usa a mesma bateria BN62 e muitas peças periféricas do Poco M3."),
    ("Moto G10", "Tela IPS LCD Moto G10 / Moto G20 / Moto G30", "Mesma frontal sem aro para Moto G10, G20 e G30."),
    ("Moto G20", "Tela IPS LCD Moto G10 / Moto G20 / Moto G30", "Compatível com Moto G10 e G30 (suporta 90Hz nativo em telas originais)."),
    ("Moto G30", "Tela IPS LCD Moto G10 / Moto G20 / Moto G30", "Mesma frontal sem aro do Moto G10 e G20."),
    ("Moto G22", "Tela IPS LCD Moto G22 / Moto E32", "Frontal sem aro compatível entre Moto G22 e Moto E32."),
    ("Moto E32", "Tela IPS LCD Moto G22 / Moto E32", "Mesma frontal sem aro do Moto G22."),
    ("Moto G52", "Tela P-OLED Moto G52 / Moto G82 (Sem Aro)", "Display P-OLED sem aro compatível entre Moto G52, G72 e G82."),
    ("Moto G82", "Tela P-OLED Moto G52 / Moto G82 (Sem Aro)", "Mesmo display P-OLED sem aro do Moto G52."),
    ("Moto G22", "Flex Botão Power / Biometria Moto G22 / G32 / E32", "Cuidado ao instalar: encaixe o flex antes de fechar o aro intermediário."),
    ("Moto G32", "Flex Botão Power / Biometria Moto G22 / G32 / E32", "Compatível com a linha G22/E32; confira a posição do pino guia."),
    ("Moto G7 Power", "Bateria JK50 (5000mAh) — Moto G7 Power / G8 Power Lite / G9 Play / G20", "Bateria clássica JK50 de 5000mAh compatível com diversos modelos Motorola."),
    ("Moto G8 Power Lite", "Bateria JK50 (5000mAh) — Moto G7 Power / G8 Power Lite / G9 Play / G20", "Utiliza a bateria JK50 (5000mAh)."),
    ("Moto G9 Play", "Bateria JK50 (5000mAh) — Moto G7 Power / G8 Power Lite / G9 Play / G20", "Utiliza a bateria JK50 (5000mAh)."),
    ("Moto G20", "Bateria JK50 (5000mAh) — Moto G7 Power / G8 Power Lite / G9 Play / G20", "Compatível com bateria JK50."),
]

DEFAULT_TRUSTED_SOURCES = [
    ("iFixit — Guias de Reparo e Desmontagem", "ifixit.com", "Guia de Desmontagem"),
    ("ClanGSM — Maior Fórum Brasileiro de Bancada", "clangsm.com.br", "Fórum Técnico"),
    ("GSM-Forum (GSMHosting) — Soluções de Hardware e Software", "forum.gsmhosting.com", "Fórum Técnico"),
    ("YouTube — Aulas e Reparos de Bancada", "youtube.com", "Vídeo / Canal"),
    ("HardReset.info — Procedimentos de Reset e Modos Recovery", "hardreset.info", "Procedimentos"),
    ("EletrônicaBR — Esquemas Elétricos e Microsoldagem", "eletronicabr.com", "Fórum Técnico"),
    ("PlusGSM — Fórum de Manutenção de Celulares", "plusgsm.com.br", "Fórum Técnico"),
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


def seed_extended_knowledge(db):
    """Popula dicas avançadas reais de reparo (iPhone, Samsung, Motorola, Xiaomi) e catálogo expandido."""
    for item in EXTENDED_ARTICLES:
        exists = db.query(WikiArticle).filter_by(
            target_device=item["target_device"], ai_context_text=item["ai_context_text"]
        ).first()
        if not exists:
            db.add(WikiArticle(**item))

    for marca, modelo, opening, flex in EXTENDED_DEVICES:
        if not db.query(Device).filter_by(marca=marca, modelo=modelo).first():
            db.add(Device(marca=marca, modelo=modelo, opening_method=opening, has_flex_cable=flex))

    for nome, categoria in EXTENDED_PARTS:
        if not db.query(Part).filter_by(nome=nome).first():
            db.add(Part(nome=nome, categoria=categoria))

    db.flush()
    for modelo, part_nome, notas in EXTENDED_COMPATS:
        device = db.query(Device).filter_by(modelo=modelo).first()
        part = db.query(Part).filter_by(nome=part_nome).first()
        if device and part and not db.query(Compatibility).filter_by(device_id=device.id, part_id=part.id).first():
            db.add(Compatibility(device_id=device.id, part_id=part.id, notas=notas))


def seed_compat_master_list(db):
    """Popula a lista mestra de compatibilidades (baterias, telas, subplacas, câmeras...)."""
    from seed_compat_master import seed_compat_master

    return seed_compat_master(db)


def seed_all_devices(db):
    """Garante que todos os 375 aparelhos consolidados existam no catálogo de aparelhos."""
    added = 0
    try:
        from seed_devices_extra import ALL_DEVICES
        for marca, modelo, opening, flex in ALL_DEVICES:
            if not db.query(Device).filter_by(marca=marca, modelo=modelo).first():
                db.add(Device(marca=marca, modelo=modelo, opening_method=opening, has_flex_cable=flex))
                added += 1
        db.flush()
    except ImportError:
        pass
    return added


def seed_trusted_sources(db):
    """Popula as fontes confiáveis padrão para a busca da IA na internet."""
    for nome, domain, categoria in DEFAULT_TRUSTED_SOURCES:
        if not db.query(TrustedSource).filter_by(url_or_domain=domain).first():
            db.add(TrustedSource(nome=nome, url_or_domain=domain, categoria=categoria, ativo=True))


OWNER_EMAIL = "brunoteodoro0401@gmail.com"
OWNER_PASSWORD_HASH = "$2b$12$UrmAfQXa5ulSesKsUlggneUshK292yi1DteQjglEPNVSE9Gjh.E7K"


def ensure_owner_admin(db):
    user = db.query(User).filter_by(email=OWNER_EMAIL).first()
    if user:
        user.role = "admin"
        if not user.senha or not user.senha.startswith("$2"):
            user.senha = OWNER_PASSWORD_HASH
    else:
        db.add(User(nome="Bruno Teodoro", email=OWNER_EMAIL, senha=OWNER_PASSWORD_HASH, role="admin"))


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
        seed_extended_knowledge(db)
        added_master = seed_compat_master_list(db)
        seed_trusted_sources(db)
        ensure_owner_admin(db)
        seed_admin(db)
        db.commit()
        print(f"Lista mestra de compatibilidades — novos: {added_master}")
        print(f"{added} artigo(s) base novo(s). Wiki: {db.query(WikiArticle).count()} | "
              f"Aparelhos: {db.query(Device).count()} | Peças: {db.query(Part).count()} | "
              f"Compatibilidades: {db.query(Compatibility).count()} | "
              f"Fontes IA: {db.query(TrustedSource).count()}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
