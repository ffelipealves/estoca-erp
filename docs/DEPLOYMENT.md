# Deploy do Estoca

O ambiente gratuito de produção usa Neon para PostgreSQL e Render para a API.
O frontend será publicado na Vercel quando existir. Nenhum dos passos abaixo
exige cartão de crédito.

## 1. Banco no Neon

1. Crie um projeto gratuito chamado `estoca`.
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
