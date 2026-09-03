# Estoca

Mini ERP de estoque construído como projeto de portfólio. Cada visitante recebe
uma sandbox isolada para explorar produtos, categorias e movimentações sem ver
ou alterar dados de outra pessoa. Sessões expiram automaticamente e os dados
antigos são removidos por rotinas agendadas.

**Stack:** FastAPI · SQLAlchemy async · Alembic · PostgreSQL · Next.js ·
TypeScript · Docker

## Experimente em produção

- Frontend: https://estoca-erp.vercel.app
- API: https://estoca-api.onrender.com
- OpenAPI: https://estoca-api.onrender.com/docs
- Health check: https://estoca-api.onrender.com/healthz

O backend usa o plano gratuito do Render e pode levar cerca de um minuto para
responder à primeira requisição depois de um período sem tráfego.

As credenciais ficam preenchidas na interface:

| Perfil | Email | Senha | Acesso |
|---|---|---|---|
| Administrador | `admin@estoca.demo` | `demo123` | CRUD do catálogo e movimentações |
| Operador | `operador@estoca.demo` | `demo123` | Consulta e movimentações |

Cada nova sandbox já começa pronta para exploração, com 4 categorias, 16
produtos, saldos variados e 23 movimentações de exemplo. Há entradas, saídas,
um ajuste de inventário e produtos abaixo do estoque mínimo. O administrador
pode restaurar esse estado inicial usando o reset da sessão.

## O que está pronto

- Sandbox isolada por visitante, com expiração e limpeza automática.
- Login com perfis de administrador e operador.
- CRUD de produtos e categorias com busca e indicação de estoque baixo.
- Entrada, saída e ajuste absoluto de estoque com histórico paginado.
- Catálogo inicial realista com 16 produtos e 23 movimentações por sessão.
- Bloqueio de saída sem saldo e atualização atômica do produto e do histórico.
- Fechamento do estoque com valor armazenado, unidades, categorias ativas e
  fila de reposição por urgência.
- Interface responsiva validada em produção no Chrome e no WebKit em viewport
  de iPhone.

## Arquitetura

O monorepo separa a API em `backend/` e a aplicação web em `frontend/`:

```text
Navegador
  └─ sessionStorage + cookie/header X-Session-Id
       └─ Next.js
            └─ FastAPI: routers → services → repositories
                 └─ PostgreSQL: entidades filtradas por session_id
```

No backend, routers tratam HTTP, services concentram regras de negócio e
repositories são a única camada que acessa o banco. O frontend centraliza os
contratos HTTP em `lib/api.ts` e mantém sessão e autenticação em providers
separados.

### Decisões que sustentam o projeto

- **Isolamento por sessão:** toda tabela de negócio possui `session_id`, e toda
  leitura ou escrita é limitada à sessão resolvida na requisição.
- **Saldo coerente:** somente `stock_movement_service` altera
  `product.quantity`; saldo e histórico são persistidos na mesma transação.
- **Semântica explícita:** entrada e saída recebem deltas positivos; ajuste
  recebe o saldo final absoluto. Toda movimentação registra
  `resulting_quantity`.
- **Fallback entre domínios:** o frontend envia cookie e `X-Session-Id`, porque
  Vercel e Render estão em domínios diferentes e cookies de terceiros podem ser
  recusados.
- **Dinheiro sem ponto flutuante:** preços usam `Numeric(10,2)` no banco e
  `Decimal` no backend.
- **Limpeza por cascade:** os jobs removem sessões; o PostgreSQL apaga os dados
  relacionados por `ON DELETE CASCADE`.

O modelo de dados, os endpoints e os detalhes das camadas estão em
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). A configuração dos ambientes
publicados está em [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Desenvolvimento local

### Backend e PostgreSQL

Com Docker e Docker Compose instalados:

```bash
docker compose up --build
docker compose run --rm backend alembic upgrade head
```

A API fica em `http://localhost:8000` e o Postgres é exposto na porta `5433`.
O Compose também cria o banco `estoca_test` usado pela suíte de integração.

Para trabalhar diretamente no host, o backend usa Python 3.12 e Poetry 2.4:

```bash
cd backend
poetry sync --with dev
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload
```

### Frontend

O frontend requer Node.js 20.9 ou mais recente:

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env.local` no lugar de `cp`. A
interface fica em `http://localhost:3000`. Para usar a API local, defina
`NEXT_PUBLIC_API_URL=http://localhost:8000` no `.env.local`.

## Verificações

Backend:

```bash
docker compose run --rm backend pytest
docker compose run --rm backend ruff check .
docker compose run --rm backend ruff format --check .
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
npx playwright install webkit
npm run test:e2e:webkit
```

O teste WebKit roda contra a produção por padrão, remove os cookies e confirma
que bootstrap após recarga, login e movimentação preservam a mesma sandbox pelo
header `X-Session-Id`.

## Hospedagem e automações

O ambiente foi desenhado para custar **US$ 0/mês e não exigir cartão de
crédito**:

- Vercel hospeda o frontend.
- Render executa a API em container Docker na região de Oregon.
- Neon fornece o PostgreSQL também em Oregon, evitando tráfego inter-regional
  entre a API e o banco.
- GitHub Actions executa CI e as rotinas de limpeza.

Um workflow remove sessões expiradas a cada hora; outro reinicia todas as
sandboxes diariamente. Ambos autenticam as chamadas internas com
`X-Cron-Secret` e repetem a requisição para tolerar o cold start do Render.

## Próximos passos

- Fornecedores e clientes.
- Múltiplos depósitos.
- Refresh token e rate limit para criação de sessões.
- Ampliar os testes E2E para o CRUD completo e outros tamanhos de tela.
- Adicionar visualizações históricas de estoque usando o seed já disponível.

O histórico do projeto e os critérios de cada etapa estão em
[`docs/ROADMAP.md`](docs/ROADMAP.md).
