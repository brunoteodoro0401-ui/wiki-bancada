# Guia Passo a Passo: Publicação na Nuvem e Uso em Várias Máquinas

Este guia mostra, do zero, tudo o que você precisa fazer para:
1. Ativar a Inteligência Artificial (Google Gemini)
2. Guardar o código no GitHub (para usar em vários computadores)
3. Criar o banco de dados na nuvem (PostgreSQL gratuito)
4. Colocar a API (Backend) no ar gratuitamente (Render)
5. Colocar o Site (Frontend) no ar gratuitamente (Vercel)
6. Trabalhar no projeto em qualquer computador no dia a dia

---

## Etapa 1: Gerar sua Chave Gratuita da IA (Gemini)

1. Acesse **https://aistudio.google.com/apikey** e faça login com sua conta Google.
2. Clique no botão azul **"Create API key"**.
3. Se aparecer **"Create API key in new project"**, clique nele.
   - *Caso peça para selecionar/importar um projeto existente e a lista esteja vazia:* abra **https://console.cloud.google.com/projectcreate**, digite o nome `wiki-bancada`, clique em **Criar**, volte ao AI Studio, clique em **Import project**, selecione `wiki-bancada` e depois clique em **Create API key**.
4. Copie a chave gerada (ela começa com `AIza...`).
5. **Para funcionar na sua máquina atual:** abra o arquivo `backend/.env` e cole a chave na frente de `GEMINI_API_KEY=`:
   ```ini
   GEMINI_API_KEY=AIzaSySuaChaveAqui...
   GEMINI_MODEL=gemini-2.5-flash
   ```
   Salve o arquivo (não precisa reiniciar o servidor local).

---

## Etapa 2: Subir o Código para o GitHub

O Git já está iniciado e com commit pronto na pasta `C:\Users\Triagem 2\.gemini\antigravity\scratch\bancada`.

1. Acesse **https://github.com/new** e faça login.
2. Em **Repository name**, digite: `wiki-bancada`
3. Escolha **Public** (ou **Private**, ambos funcionam).
4. **NÃO marque** "Add a README file" nem ".gitignore".
5. Clique em **Create repository**.
6. Copie o link HTTPS que aparecer na tela (ex: `https://github.com/SEU_USUARIO/wiki-bancada.git`).
7. Envie esse link para o assistente aqui no Antigravity **OU** rode estes 2 comandos no PowerShell:
   ```powershell
   cd "C:\Users\Triagem 2\.gemini\antigravity\scratch\bancada"
   git remote add origin https://github.com/SEU_USUARIO/wiki-bancada.git
   git push -u origin main
   ```

---

## Etapa 3: Criar o Banco de Dados na Nuvem (Neon — Gratuito)

Para que as dicas, aparelhos e usuários fiquem salvos na internet e não se percam:

1. Acesse **https://neon.tech** e clique em **Sign Up** (pode entrar com sua conta do GitHub ou Google).
2. Ao entrar, crie um projeto chamado `wiki-bancada` (região: *US East* ou *South America / São Paulo* se disponível).
3. Na tela inicial do projeto (**Dashboard**), localize a caixa **Connection string**.
4. Copie a URL que começa com `postgresql://...` (ex: `postgresql://neondb_owner:senha@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require`).
5. Guarde essa URL para usar na Etapa 4.

---

## Etapa 4: Colocar o Backend (API Python) no Ar — Render.com

1. Acesse **https://render.com** e clique em **Get Started for Free** (entre usando sua conta do **GitHub**).
2. No painel do Render, clique em **New +** (canto superior direito) e escolha **Web Service**.
3. Conecte seu repositório `wiki-bancada` da lista e clique em **Connect**.
4. Preencha os campos exatamente assim:
   - **Name:** `wiki-bancada-api`
   - **Language / Runtime:** `Python 3`
   - **Branch:** `main`
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt && python seed.py`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** selecione **Free** ($0/mês)
5. Role até a seção **Environment Variables**, clique em **Add Environment Variable** e adicione estas 5 variáveis:

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | *(Cole a URL `postgresql://...` que você copiou do Neon na Etapa 3)* |
   | `GEMINI_API_KEY` | *(Cole sua chave `AIza...` da Etapa 1)* |
   | `GEMINI_MODEL` | `gemini-2.5-flash` |
   | `ADMIN_EMAIL` | *(Seu e-mail de administrador, ex: `seuemail@gmail.com`)* |
   | `ADMIN_PASSWORD` | *(Sua senha de administrador, mínimo 8 caracteres)* |
   | `JWT_SECRET` | *(Digite qualquer frase longa e secreta com mais de 32 caracteres)* |

6. Clique em **Create Web Service**.
7. Aguarde cerca de 2 a 3 minutos até aparecer **Live** (verde).
8. Copie a URL pública gerada no topo (ex: `https://wiki-bancada-api.onrender.com`).
   - *Teste abrindo `https://wiki-bancada-api.onrender.com/docs` no navegador — você verá o Swagger no ar!*

---

## Etapa 5: Colocar o Site (Frontend React) no Ar — Vercel

1. Acesse **https://vercel.com** e clique em **Sign Up / Log In** (entre com sua conta do **GitHub**).
2. No painel da Vercel, clique em **Add New... > Project**.
3. Procure o repositório `wiki-bancada` e clique em **Import**.
4. Na tela de configuração:
   - Em **Root Directory**, clique em **Edit**, selecione a pasta **`frontend`** e confirme.
   - Abra a aba **Environment Variables** e adicione:
     - **Key:** `VITE_API_URL`
     - **Value:** `https://wiki-bancada-api.onrender.com` *(a URL da sua API gerada na Etapa 4, **sem** barra `/` no final)*
5. Clique em **Deploy**.
6. Em ~1 minuto a Vercel mostrará a tela de parabéns com o link público do seu sistema (ex: `https://wiki-bancada.vercel.app`).
   - Esse link já pode ser acessado por qualquer pessoa no celular ou computador!

---

## Etapa 6: Como Trabalhar em Outros Computadores

### Na primeira vez em um computador novo:
1. Instale o **Git**, **Python 3.11+** e **Node.js** na máquina nova.
2. Abra o terminal (PowerShell) e baixe o projeto do GitHub:
   ```powershell
   git clone https://github.com/SEU_USUARIO/wiki-bancada.git
   cd wiki-bancada
   ```
3. Configure o Backend local:
   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
   copy .env.example .env
   # Edite o arquivo .env com sua GEMINI_API_KEY (e DATABASE_URL se quiser usar o mesmo banco da nuvem)
   .\.venv\Scripts\python.exe seed.py
   .\.venv\Scripts\python.exe -m uvicorn main:app --port 8000
   ```
4. Configure o Frontend local (em outro terminal):
   ```powershell
   cd frontend
   npm.cmd install
   npm.cmd run dev
   ```

### No dia a dia (alternando entre máquinas):
- **Ao sentar em uma máquina para trabalhar (baixar novidades):**
  ```powershell
  git pull
  ```
- **Ao terminar uma alteração (enviar para o GitHub e atualizar o site público automaticamente):**
  ```powershell
  git add .
  git commit -m "descricao do que mudou"
  git push
  ```
  *(Assim que você der `git push`, a Vercel e o Render atualizam o site e a API em produção sozinhos!)*
