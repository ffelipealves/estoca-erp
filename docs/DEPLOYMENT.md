# Deploy do Estoca

O ambiente gratuito de produção usa Neon para PostgreSQL, Render para a API e
Vercel para o frontend. Nenhum dos provedores escolhidos exige cartão de crédito.

## Ambiente atual

- API: `https://estoca-api.onrender.com`
- Frontend: `https://estoca-erp.vercel.app`
- Health check: `https://estoca-api.onrender.com/healthz`
- Banco: projeto `estoca-erp`, branch `production`, banco `neondb` no Neon
- Backend: Blueprint `estoca-erp`, serviço Docker Free `estoca-api` no Render
- Frontend: projeto `estoca-erp` na Vercel, conectado à branch `main`
- Automações de limpeza: workflows, variável `BACKEND_URL` e secret
  `CRON_SECRET` configurados e validados manualmente

O fluxo bootstrap → sessão → login → catálogo → movimentações foi validado com
frontend e backend nos domínios de produção, sem erros no console. A validação
equivalente em Safari/iOS ainda está pendente.

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

O CORS aceita `http://localhost:3000` e `https://estoca-erp.vercel.app`. Um
preflight partindo do domínio da Vercel foi validado com resposta HTTP 200 e o
header `Access-Control-Allow-Origin` correto.

## Variáveis efetivas da API

| Variável | Origem | Observação |
|---|---|---|
| `ENVIRONMENT` | Blueprint | Sempre `production`. |
| `DATABASE_URL` | Neon | Segredo informado ao criar o Blueprint. |
| `CORS_ORIGINS` | Render | Frontend local e domínio público da Vercel. |
| `SESSION_COOKIE_SECURE` | Blueprint | Obrigatoriamente `true` em HTTPS. |
| `SESSION_COOKIE_SAMESITE` | Blueprint | `none` para frontend e API em domínios distintos. |
| `JWT_SECRET` | Render | Gerado automaticamente. |
| `CRON_SECRET` | Usuário | Mesmo valor será cadastrado no GitHub. |

## 3. Frontend na Vercel

Configuração efetiva do projeto:

1. Importe o repositório na Vercel e defina `frontend/` como **Root Directory**.
2. Mantenha o preset Next.js e o comando de build padrão (`npm run build`).
3. Cadastre `NEXT_PUBLIC_API_URL=https://estoca-api.onrender.com` para produção.
4. O domínio público resultante é `https://estoca-erp.vercel.app`.
5. No Render, atualize `CORS_ORIGINS` para conter
   `http://localhost:3000,<domínio-vercel>` e faça o redeploy da API.
6. Bootstrap, login, catálogo e movimentações já foram validados no navegador
   de produção. Ainda falta repetir o fluxo em Safari/iOS para concluir a
   validação do fallback `X-Session-Id` em ambos os ambientes exigidos.

Vercel e Render fazem auto-deploy a partir de `main`; ambos estão conectados ao
repositório.

## 4. GitHub Actions de limpeza

Os workflows `.github/workflows/cleanup-expired.yml` e
`.github/workflows/cleanup-daily.yml` executam, respectivamente, a limpeza de
sessões expiradas a cada hora (no minuto 17) e o reset de todas as sandboxes às
06:37 UTC diariamente. Ambos também aceitam execução manual por
`workflow_dispatch` e fazem retries para tolerar o cold start do Render.

Estão configurados no repositório:

- variável de repositório `BACKEND_URL=https://estoca-api.onrender.com`;
- secret `CRON_SECRET`, com o mesmo valor cadastrado no Render.

Os workflows enviam esse secret no header `X-Cron-Secret` das chamadas aos
endpoints internos.

As primeiras execuções manuais foram concluídas com sucesso em 2026-09-03. A
limpeza de expiradas removeu 9 sessões e o reset diário removeu a sandbox
restante. Depois do reset, uma nova visita ao frontend criou uma sessão isolada
e exibiu a tela de login sem erros no console.
