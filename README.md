# 🔧 Wiki de Bancada

Sistema de gestão de conhecimento técnico + Assistente de IA multi-modelo para manutenção de smartphones e microsoldagem.

Construído com **FastAPI + SQLAlchemy (SQLite / PostgreSQL)** no backend e **React 19 + Vite + Tailwind CSS v4** no frontend.

---

## ✨ Principais Funcionalidades
- **📘 Dicas de Bancada (Wiki):** Catálogo pesquisável e filtrável por categoria (*Procedimento*, *Diagnóstico*, *Microsoldagem*, *Alerta Químico*, *Compatibilidade*, *Resolução de Problemas*).
- **📱 Aparelhos & Ficha 360º:** Cadastro de modelos com método de abertura (*Frontal* / *Traseira*), alertas de cabo flex e modal **Ficha 360º** consolidando peças compatíveis, dicas do modelo e atalho para consulta na IA.
- **🔩 Peças e Compatibilidades:** Relacionamento N:N entre peças e aparelhos com notas de instalação e ativação.
- **🌐 Fontes da IA & Importador Inteligente (`/ingest`):** Extração estruturada de dicas a partir de pesquisas na web, vídeos do YouTube (título, descrição e legendas), URLs de fóruns/guias (iFixit, ClanGSM, GSMHosting) ou textos de grupos (WhatsApp/Facebook).
- **🤖 Assistente Conversacional Híbrido (`/ask`):**
  - Suporte a **Google Gemini** (`gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-2.5-pro`) e **Hugging Face Router** (`Qwen 2.5 72B`, `Llama 3.3 70B`, `DeepSeek V3`) com fallback automático.
  - Memória de conversa contínua multi-turno persistida na sessão.
  - Busca híbrida combinando a base interna da bancada + leitura paralela de Fontes Confiáveis com proteção anti-SSRF.
- **👥 Controle de Acesso (RBAC):** Gestão de equipe diretamente pela interface (`admin` e `tecnico`).

---

## 🚀 Backend (`backend/`)
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe seed.py
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000   # Swagger em /docs
.\.venv\Scripts\python.exe -m pytest -v                       # Testes automatizados
```

### Variáveis de Ambiente (`backend/.env`)
| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | String de conexão PostgreSQL (Neon/Render). Se ausente, usa SQLite local (`bancada.db`). |
| `JWT_SECRET` | Segredo de assinatura JWT. Se ausente localmente, é gerado em `backend/.jwt_secret`. |
| `GEMINI_API_KEY` | Chave da API do Google Gemini (configurável também pela interface como Admin). |
| `GEMINI_MODEL` | Modelo padrão do Gemini (padrão: `gemini-3.6-flash`). |
| `HF_API_KEY` | Token da API do Hugging Face para uso de modelos abertos (opcional). |
| `HF_MODEL` | Modelo padrão do Hugging Face (padrão: `Qwen/Qwen2.5-72B-Instruct`). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Credenciais do administrador inicial criado pelo `seed.py`. |

---

## 💻 Frontend (`frontend/`)
```powershell
cd frontend
npm.cmd install
npm.cmd run dev     # http://localhost:5173
npm.cmd test        # Vitest
npm.cmd run lint    # Oxlint
npm.cmd run build   # Build de produção
```

---

## 🔒 Permissões
- **Leitura** (dicas, aparelhos, peças, compatibilidades, fontes): pública.
- **Assistente IA (`/ask`)**: qualquer usuário autenticado (`tecnico` ou `admin`).
- **Escrita, Importação (`/ingest`), Configurações de IA (`/ai_settings`) e Gestão de Equipe (`/users`)**: exclusivo para `admin`.
