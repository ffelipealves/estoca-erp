# Estoca — Arquitetura de referência

Design-alvo do backend e frontend. Consultar quando for implementar uma parte específica (não precisa ler inteiro para todo incremento). Uma vez que models/schemas/rotas existam de verdade, **o código manda** — se este documento divergir do código, é o doc que está desatualizado.

Invariantes cross-cutting (isolamento por sessão, quem escreve `product.quantity`, etc.) estão em `AGENTS.md`, não repetidos aqui.

## Camadas do backend

- `models/` — SQLAlchemy `DeclarativeBase`, um arquivo por entidade.
- `schemas/` — Pydantic, entrada/saída da API.
- `repositories/` — única camada que toca `AsyncSession`/SQL diretamente.
- `services/` — regra de negócio; único lugar que chama repositories de mais de uma entidade numa mesma operação (ex.: criar produto com estoque inicial mexe em `products` e `stock_movements`).
- `routers/` — só parsing de request, chamada ao service certo, e devolver o schema de resposta. Sem lógica de negócio.
- `core/` — `config.py` (Settings via pydantic-settings), `database.py` (engine async + `get_db`), `security.py` (bcrypt + JWT), `deps.py` (`get_current_session`, `get_current_user`, `require_role`), `errors.py` (`DomainError` e subclasses).

## Frontend

Next.js App Router. `app/` contém página, layout e estilos globais;
`context/SessionProvider.tsx` controla bootstrap/cold start e
`context/AuthProvider.tsx` restaura o login durante a aba. `lib/api.ts` centraliza
cookie, fallback `X-Session-Id`, Bearer token e contratos HTTP.

O shell autenticado está em `components/layout/AppShell.tsx`. Produtos e
categorias possuem componentes próprios com estados de carregamento, erro e
vazio, além de mutações visíveis somente para administrador. O saldo do produto
é apenas exibido: nenhuma tela de catálogo escreve `quantity`; a quantidade
inicial e as movimentações continuam passando pelo backend.

## Modelo de dados

Toda tabela de negócio tem `session_id` (FK → `sessions.id`, `ON DELETE CASCADE`, indexada). PKs `uuid`, timestamps `timestamptz`.

```mermaid
erDiagram
    SESSIONS ||--o{ DEMO_USERS : isola
    SESSIONS ||--o{ CATEGORIES : isola
    SESSIONS ||--o{ PRODUCTS : isola
    SESSIONS ||--o{ STOCK_MOVEMENTS : isola
    CATEGORIES ||--o{ PRODUCTS : classifica
    PRODUCTS ||--o{ STOCK_MOVEMENTS : movimenta
    DEMO_USERS |o--o{ STOCK_MOVEMENTS : registra

    SESSIONS {
        uuid id PK
        timestamptz created_at
        timestamptz last_activity_at
    }
    DEMO_USERS {
        uuid id PK
        uuid session_id FK
        varchar email
        varchar password_hash
        enum role
        varchar full_name
    }
    CATEGORIES {
        uuid id PK
        uuid session_id FK
        varchar name
        timestamptz created_at
        timestamptz updated_at
    }
    PRODUCTS {
        uuid id PK
        uuid session_id FK
        uuid category_id FK
        varchar name
        varchar sku
        numeric price
        int quantity
        int low_stock_threshold
        timestamptz created_at
        timestamptz updated_at
    }
    STOCK_MOVEMENTS {
        uuid id PK
        uuid session_id FK
        uuid product_id FK
        uuid performed_by_user_id FK
        enum type
        int quantity
        int resulting_quantity
        varchar note
        timestamptz created_at
    }
```

Toda FK para `sessions.id` é `CASCADE`. `products.category_id` é `RESTRICT` (bloqueia exclusão de categoria com produto vinculado). `stock_movements.performed_by_user_id` é `SET NULL`.

- **`sessions`**: `id`, `created_at`, `last_activity_at` (índices nos dois — usados pela query de limpeza).
- **`demo_users`**: `id`, `session_id`, `email`, `password_hash`, `role` (`admin`/`operador`), `full_name`. `UNIQUE(session_id, email)`.
- **`categories`**: `id`, `session_id`, `name`, `created_at`, `updated_at`. `UNIQUE(session_id, name)`.
- **`products`**: `id`, `session_id`, `category_id` (FK RESTRICT), `name`, `sku`, `price` (numeric 10,2), `quantity` (default 0), `low_stock_threshold` (default 5 — já na migration inicial, é usado só no sprint 2 mas evita segunda migration), `created_at`, `updated_at`. `UNIQUE(session_id, sku)`.
- **`stock_movements`**: `id`, `session_id`, `product_id` (FK CASCADE), `type` (`entrada`/`saida`/`ajuste`), `quantity`, `resulting_quantity`, `note` (nullable), `performed_by_user_id` (FK → demo_users, `SET NULL`), `created_at`. Índice composto `(session_id, product_id, created_at)`.

Enums nativos do Postgres via `sa.Enum(...)`. Rascunhar todos os models antes do primeiro `alembic revision --autogenerate`, para sair com uma migration inicial única (`0001_initial_schema.py`).

## Endpoints

Prefixo `/api/v1`; limpeza interna em `/internal` (`include_in_schema=False`).

**Sessão** (sem JWT — cookie `estoca_session` ou header `X-Session-Id`)
- `POST /sessions/bootstrap` — cria sessão + seed se ausente/expirada; senão só atualiza `last_activity_at`. Seta cookie e retorna `session_id` no corpo.
- `GET /sessions/me` — info da sessão + TTL restante.
- `POST /sessions/me/reset` — reset da sessão atual (ver AGENTS.md). **Admin only.**

**Auth**
- `POST /auth/login` — `{email, password}` contra `demo_users` da sessão atual → `{access_token, user}`. JWT: `{sub: user_id, session_id, role, exp: +2h}`.

**Categorias / Produtos / Movimentações** (JWT obrigatório)
- Categorias: `GET/POST /categories`, `GET/PUT/DELETE /categories/{id}` — mutação **admin only**; delete bloqueia (422) se houver produtos vinculados.
- Produtos: `GET/POST /products` (filtros `category_id`, `search`, `low_stock`; teto de 50/sessão; sku único por sessão), `GET/PUT/DELETE /products/{id}` — mutação **admin only**.
- Movimentações: `GET /stock-movements` (paginado), `POST /stock-movements` — **admin e operador**; teto de 500/sessão.

**Dashboard (sprint 2, ainda não implementado)**: endpoints de resumo e giro
serão definidos somente se essa etapa entrar no escopo do Dia 14.

**Interno** (sem JWT, header `X-Cron-Secret` via `secrets.compare_digest`): `POST /internal/cleanup/expired`, `POST /internal/cleanup/wipe-all`. Mais `GET /healthz` público.

## `docker-compose.yml` (dev local)

Serviços existentes: `postgres:16-alpine` + `backend` (`uvicorn --reload`, volume
montado). O frontend não faz parte do Compose e roda com `npm run dev` no host.
O backend usa `DATABASE_URL=postgresql+asyncpg://estoca:estoca@postgres:5432/estoca`;
em dev, `SESSION_COOKIE_SECURE=false` / `SAMESITE=lax`. O banco de teste
`estoca_test` é criado pelo script montado em `docker-entrypoint-initdb.d`.

## GitHub Actions

- **`ci.yml`** (`pull_request` + `push: main` + `workflow_dispatch`): job `backend` (Python 3.12, Postgres de serviço, validação do Poetry, `alembic upgrade head`, `ruff check/format`, `pytest --cov` e build da imagem de produção) e job `frontend` (Node 24, `npm ci`, ESLint e build Next.js).
- **`cleanup-expired.yml`** roda a cada hora e
  **`cleanup-daily.yml`** reseta todas as sandboxes uma vez ao dia. Ambos chamam
  os endpoints internos com `X-Cron-Secret`, toleram o cold start do Render e
  aceitam `workflow_dispatch`. A variável `BACKEND_URL`, o secret `CRON_SECRET`
  e as primeiras execuções manuais ainda precisam ser configurados/validados no
  GitHub.
- Não há workflow de deploy. O Blueprint `render.yaml` descreve o Web Service
  Docker gratuito com root `backend/` e health check em `/healthz`; o Render
  faz auto-deploy do backend quando conectado ao repositório. A Vercel ainda
  não está conectada e não existe deploy público do frontend.
- O `DATABASE_URL` pode receber diretamente a connection string do Neon. A configuração troca o dialect para `postgresql+asyncpg`, converte `sslmode` para o parâmetro `ssl` do asyncpg e descarta `channel_binding`, que não é aceito pelo driver.
- Estado atual de configuração: o Render gera `JWT_SECRET` e recebe
  `CRON_SECRET` manualmente. O GitHub ainda precisa receber o mesmo
  `CRON_SECRET` como secret e `BACKEND_URL` como variável de repositório.

## Testes

**Backend** (pytest + `httpx.AsyncClient` contra Postgres real de teste) — 5 fluxos obrigatórios, todos com teste dedicado:
1. **Isolamento entre sessões** — dois clientes com cookie jars distintos não veem dados um do outro. Prova a premissa central do produto.
2. **Seed correto** — bootstrap cria N categorias/produtos/2 demo users; segunda chamada com mesmo cookie não recria.
3. **Expiração** (com `freezegun`) — 2h inatividade OU 24h de vida; `cleanup/expired` remove só as vencidas; `wipe-all` remove tudo.
4. **Regras de estoque** — entrada soma, saída bloqueia se insuficiente (422), ajuste calcula delta absoluto, teto de 500, `resulting_quantity` correto.
5. **RBAC** — operador bloqueado em mutação de produto/categoria (403) mas liberado em movimentações; reset só admin; JWT de uma sessão não funciona em outra.

**Frontend**: sem testes automatizados de UI no escopo garantido (custo/benefício ruim em 2 semanas solo) — `npm run build` no CI já cobre erros de TS. Validação real é manual nos checkpoints do roadmap.
