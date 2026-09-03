# Estoca

Mini ERP de estoque de portfólio. Cada visitante recebe uma sessão isolada
(sandbox) para mexer em produtos, categorias e movimentações de estoque. Quando
a sessão expira, uma próxima visita recebe uma sandbox nova e isolada. Os
endpoints que removem sessões antigas e os workflows de agendamento estão ativos
e foram validados manualmente no Dia 13.

**Stack:** FastAPI + SQLAlchemy (async) + Alembic + Poetry · Next.js + TypeScript · PostgreSQL · Docker

🚧 Em desenvolvimento — ver [`docs/ROADMAP.md`](docs/ROADMAP.md) para o cronograma e [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para o design técnico.

## Produção

O backend está publicado no Render e usa PostgreSQL no Neon:

- Frontend: https://estoca-erp.vercel.app
- API: https://estoca-api.onrender.com
- Health check: https://estoca-api.onrender.com/healthz
- OpenAPI: https://estoca-api.onrender.com/docs

O serviço usa o plano gratuito do Render e pode levar cerca de 50 segundos para
responder à primeira requisição depois de um período sem tráfego.

O frontend está publicado na Vercel e conectado à API do Render. O fluxo de
bootstrap, login, catálogo e movimentações foi validado no domínio de produção,
sem erros no console. O fallback sem cookie também foi validado no WebKit 26.5
do Playwright, em viewport de iPhone 13, mantendo a sandbox pelo header
`X-Session-Id` durante bootstrap, login e movimentação.

## Funcionalidades atuais

- Sessão sandbox isolada por visitante, com cookie e fallback `X-Session-Id`.
- Login com perfis de administrador e operador.
- Catálogo responsivo com busca, estoque baixo e CRUD de produtos e categorias.
- Fechamento do estoque com valor armazenado, unidades, categorias ativas e
  fila de reposição por urgência.
- Mutações de catálogo restritas ao administrador; operador tem acesso de leitura.
- Histórico paginado e formulário de entrada, saída e ajuste disponíveis para
  administrador e operador.

## Desenvolvimento local

Com Docker e Docker Compose instalados, suba o backend e os bancos de desenvolvimento e teste:

```bash
docker compose up --build
```

A API fica disponível em `http://localhost:8000` e sua documentação interativa em `http://localhost:8000/docs`.

Para aplicar as migrations ou executar a suíte de testes no ambiente reproduzível do container:

```bash
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend pytest
```

O frontend roda separadamente no host:

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

A interface fica em `http://localhost:3000`. O arquivo de exemplo aponta para a
API publicada; use `NEXT_PUBLIC_API_URL=http://localhost:8000` para trabalhar
somente com o ambiente local.

## Dependências do backend

O backend usa Poetry 2.4 e mantém as versões resolvidas em `backend/poetry.lock`. Para gerenciar dependências diretamente no host:

```bash
cd backend
poetry sync --with dev
poetry add nome-do-pacote
poetry add --group dev nome-do-pacote
```

O grupo principal contém somente o necessário em produção; testes e ferramentas de desenvolvimento ficam no grupo `dev`.
