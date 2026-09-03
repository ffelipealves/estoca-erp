# Deploy do Estoca

O ambiente gratuito de produção usa Neon para PostgreSQL e Render para a API.
O frontend já existe, mas ainda não foi publicado; o alvo continua sendo a
Vercel no Dia 13. Nenhum dos provedores escolhidos exige cartão de crédito.

## Ambiente atual

- API: `https://estoca-api.onrender.com`
- Health check: `https://estoca-api.onrender.com/healthz`
- Banco: projeto `estoca-erp`, branch `production`, banco `neondb` no Neon
- Backend: Blueprint `estoca-erp`, serviço Docker Free `estoca-api` no Render
- Frontend: somente local/CI; sem projeto ou domínio Vercel documentado
- Automações de limpeza: workflows prontos; configuração e validação no GitHub
  ainda pendentes

O backend foi validado em produção. O fluxo bootstrap → sessão → login → CRUD
de catálogo foi validado com o frontend local consumindo a API publicada; isso
não equivale a uma validação do frontend em produção.

## 1. Banco no Neon

1. Crie um projeto gratuito chamado `estoca-erp`.
2. Mantenha o banco e a branch criados por padrão.
3. Em **Connect**, selecione a conexão com pool e copie a connection string.

O Neon entrega uma URL que começa com `postgresql://` e normalmente termina em
`?sslmode=require&channel_binding=require`. O backend converte esse formato
automaticamente para o driver assíncrono usado pelo SQLAlchemy. Não edite a
senha nem remova os parâmetros antes de cadastrá-la no Render.

## 2. API no Render

O arquivo `render.yaml` na raiz descreve o serviço. No Render:

1. Crie um **Blueprint** apontando para o repositório `estoca-erp`.
2. Confirme o plano **Free** do serviço `estoca-api`.
3. Informe `DATABASE_URL` com a connection string copiada do Neon.
4. Informe `CRON_SECRET` com um valor aleatório de pelo menos 32 caracteres.
   Gere com `openssl rand -hex 32` e guarde o valor para o GitHub Actions.
5. Aplique o Blueprint e aguarde o primeiro deploy.

O Render gera `JWT_SECRET` automaticamente. A imagem executa
`alembic upgrade head` antes de iniciar a API e o deploy só fica saudável quando
`GET /healthz` responde com sucesso.

O CORS começa aceitando `http://localhost:3000`, permitindo desenvolver o
frontend local contra a API publicada. Quando a Vercel fornecer o domínio do
frontend, adicione-o a `CORS_ORIGINS`, separado por vírgula.

## Variáveis efetivas da API

| Variável | Origem | Observação |
|---|---|---|
| `ENVIRONMENT` | Blueprint | Sempre `production`. |
| `DATABASE_URL` | Neon | Segredo informado ao criar o Blueprint. |
| `CORS_ORIGINS` | Blueprint | Inicialmente o frontend local. |
| `SESSION_COOKIE_SECURE` | Blueprint | Obrigatoriamente `true` em HTTPS. |
| `SESSION_COOKIE_SAMESITE` | Blueprint | `none` para frontend e API em domínios distintos. |
| `JWT_SECRET` | Render | Gerado automaticamente. |
| `CRON_SECRET` | Usuário | Mesmo valor será cadastrado no GitHub. |

## 3. Frontend na Vercel — pendente

Quando a interface de movimentações estiver pronta:

1. Importe o repositório na Vercel e defina `frontend/` como **Root Directory**.
2. Mantenha o preset Next.js e o comando de build padrão (`npm run build`).
3. Cadastre `NEXT_PUBLIC_API_URL=https://estoca-api.onrender.com` para produção.
4. Faça o primeiro deploy e copie o domínio HTTPS gerado pela Vercel.
5. No Render, atualize `CORS_ORIGINS` para conter
   `http://localhost:3000,<domínio-vercel>` e faça o redeploy da API.
6. Valide bootstrap, login, CRUD e movimentações em Chrome e Safari/iOS. Essa
   validação precisa confirmar o fallback `X-Session-Id`, não apenas o cookie.

Vercel e Render fazem auto-deploy a partir de `main` somente depois que cada
projeto está efetivamente conectado ao repositório. No estado atual, isso vale
para o Render, mas ainda não para a Vercel.

## 4. GitHub Actions de limpeza — configuração pendente

Os workflows `.github/workflows/cleanup-expired.yml` e
`.github/workflows/cleanup-daily.yml` executam, respectivamente, a limpeza de
sessões expiradas a cada hora (no minuto 17) e o reset de todas as sandboxes às
06:37 UTC diariamente. Ambos também aceitam execução manual por
`workflow_dispatch` e fazem retries para tolerar o cold start do Render.

Para ativá-los, configure no repositório:

- variável de repositório `BACKEND_URL=https://estoca-api.onrender.com`;
- secret `CRON_SECRET`, com o mesmo valor cadastrado no Render.

Os workflows enviam esse secret no header `X-Cron-Secret` das chamadas aos
endpoints internos.

Depois, execute manualmente cada workflow e confirme no log a resposta com
`deleted_sessions`. O agendamento só deve ser considerado validado depois dessas
duas execuções bem-sucedidas.
