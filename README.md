# Wiki de Bancada

Wiki + assistente de IA para manutenção de celulares. FastAPI + SQLite (backend) e React + Vite + Tailwind (frontend).

## Backend (`backend/`)
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
# Opcional: ADMIN_EMAIL / ADMIN_PASSWORD (senão uma senha aleatória é gerada e exibida uma vez)
.\.venv\Scripts\python.exe seed.py
.\.venv\Scripts\python.exe -m uvicorn main:app --port 8000   # Swagger em /docs
.\.venv\Scripts\python.exe -m pytest                          # testes
```

Variáveis de ambiente:
| Variável | Para quê |
| --- | --- |
| `JWT_SECRET` | Segredo do JWT. Se ausente, é gerado e salvo em `backend/.jwt_secret`. |
| `GEMINI_API_KEY` | Liga o assistente com IA. Sem ela, `/ask` devolve as dicas mais relevantes (modo `retrieval`). |
| `GEMINI_MODEL` | Modelo do Gemini (padrão `gemini-2.0-flash`). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Credenciais do admin criado pelo `seed.py`. |

## Frontend (`frontend/`)
```powershell
npm.cmd install
npm.cmd run dev     # http://localhost:5173
npm.cmd test        # vitest
npm.cmd run lint
npm.cmd run build
```

## Permissões
- Leitura (dicas, aparelhos, peças, compatibilidades): pública.
- Escrita (POST/PUT/DELETE): somente `admin`.
- `/ask` (assistente): qualquer usuário logado.
- Cadastro público cria sempre `tecnico`; um admin pode promover usuários em `PUT /users/{id}/role`.
