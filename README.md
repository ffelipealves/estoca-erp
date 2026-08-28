# Estoca

Mini ERP de estoque de portfólio. Cada visitante recebe uma sessão isolada (sandbox) para mexer em produtos, categorias e movimentações de estoque — a sessão expira e é resetada automaticamente, então a demo está sempre "zerada" para o próximo visitante.

**Stack:** FastAPI + SQLAlchemy (async) + Alembic + Poetry · Next.js + TypeScript · PostgreSQL · Docker

🚧 Em desenvolvimento — ver [`docs/ROADMAP.md`](docs/ROADMAP.md) para o cronograma e [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) para o design técnico.

## Produção

O backend está publicado no Render e usa PostgreSQL no Neon:

- API: https://estoca-api.onrender.com
- Health check: https://estoca-api.onrender.com/healthz
- OpenAPI: https://estoca-api.onrender.com/docs

O serviço usa o plano gratuito do Render e pode levar cerca de 50 segundos para
responder à primeira requisição depois de um período sem tráfego.

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

## Dependências do backend

O backend usa Poetry 2.4 e mantém as versões resolvidas em `backend/poetry.lock`. Para gerenciar dependências diretamente no host:

```bash
cd backend
poetry sync --with dev
poetry add nome-do-pacote
poetry add --group dev nome-do-pacote
```

O grupo principal contém somente o necessário em produção; testes e ferramentas de desenvolvimento ficam no grupo `dev`.
