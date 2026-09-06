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

A seção inicial é o Painel (`components/dashboard/DashboardPanel.tsx`), que
concentra o fechamento da sessão e o gráfico de valor por categoria
(`CategoryValueChart`, derivado do mesmo `GET /products`) e a evolução do saldo
(`BalanceTimelineChart`, sobre `GET /stock-movements/balance-timeline`); as telas de catálogo e
operação ficam com os próprios dados, sem resumo embutido. Os gráficos são
marcação, CSS e SVG à mão, sem biblioteca: barra horizontal fina para comparação
de magnitude, série única em um só tom (`#0f8a5f`, o acento do app, validado
contra a superfície de papel), rótulos em tokens de texto e nunca na cor da
série. A série histórica é desenhada em **degrau**, não em diagonal: o saldo muda
no evento e se mantém até o próximo, e interpolar afirmaria uma variação contínua
que não aconteceu. O SVG mede a largura real do container para os rótulos não
encolherem, e carrega um `viewBox` correspondente para que uma medição defasada
escale o desenho em vez de cortá-lo.

O shell autenticado está em `components/layout/AppShell.tsx`, que declara as
seções em `NAV_GROUPS` — a navegação, o cabeçalho e o conteúdo derivam dessa
mesma estrutura, e um grupo marcado `adminOnly` não é renderizado para operador.
Produtos e categorias possuem componentes próprios com estados de carregamento,
erro e vazio. Os controles de mutação permanecem visíveis para o operador —
apagados, com cadeado e `aria-disabled` via `components/auth/AdminAction.tsx` —
e o clique explica a restrição em vez de a ação sumir da tela; `lib/permissions.ts`
centraliza esse texto e converte um 403 da API na mesma orientação.

A tabela de produtos ordena e filtra **no cliente** (nome, categoria, preço e
saldo; filtro por categoria e por estoque abaixo do mínimo). É deliberado: o
teto é de 50 produtos por sessão e a lista inteira já está em memória, então uma
ida ao servidor por clique de cabeçalho só somaria latência. Os parâmetros
`category_id`, `search` e `low_stock` de `GET /products` continuam existindo e
testados para consumidores da API. No mobile o cabeçalho da tabela fica oculto,
então a ordenação ganha um `select` próprio.

A lista de movimentações continua paginada **no servidor**, e por isso os
filtros de produto, tipo e período também são do servidor. O `input[type=date]`
devolve um dia civil sem fuso; a conversão para instante (início e fim do dia
local) acontece no navegador, o único lugar que conhece o fuso do usuário.
Qualquer mudança de filtro volta para a primeira página.
`components/admin/AdminPanel.tsx` concentra a área restrita: identidade da
sandbox com contagem regressiva a partir de `GET /sessions/me`, matriz de
permissões por perfil e o reset da sessão. As credenciais demo ficam em
`lib/demo-users.ts`, compartilhadas entre a tela de login e o painel. O resumo do estoque
é derivado no cliente a partir da mesma lista de produtos, sem endpoint ou fonte
de estado paralela. O saldo do produto é apenas exibido: nenhuma tela de catálogo
escreve `quantity`; a quantidade inicial e as movimentações continuam passando
pelo backend.

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
- `POST /sessions/me/reset` — reset da sessão atual (ver AGENTS.md). **Admin only.** Exposto na aba Administração.

**Auth**
- `POST /auth/login` — `{email, password}` contra `demo_users` da sessão atual → `{access_token, user}`. JWT: `{sub: user_id, session_id, role, exp: +2h}`.

**Categorias / Produtos / Movimentações** (JWT obrigatório)
- Categorias: `GET/POST /categories`, `GET/PUT/DELETE /categories/{id}` — mutação **admin only**; delete bloqueia (422) se houver produtos vinculados.
- Produtos: `GET/POST /products` (filtros `category_id`, `search`, `low_stock`; teto de 50/sessão; sku único por sessão), `GET/PUT/DELETE /products/{id}` — mutação **admin only**.
- Movimentações: `GET /stock-movements/balance-timeline` devolve o saldo total da sessão após cada evento — `LAG` particionado por produto extrai o delta de cada movimentação e a soma corrente reconstrói o total, em uma consulta só. É o único agregado servido pelo backend, e não conflita com a regra do dashboard: são dados de outra natureza, não os números do fechamento.
- Movimentações: `GET /stock-movements` (paginado; filtros `product_id`, `type` e o período `date_from`/`date_to`, instantes ISO 8601 inclusivos comparados contra `created_at` em UTC — intervalo invertido devolve 422), `POST /stock-movements` — **admin e operador**; teto de 500/sessão.

**Dashboard**: o fechamento do estoque é calculado no frontend a partir de
`GET /products`, sem endpoint agregado paralelo. Exibe valor armazenado,
quantidade total de unidades, categorias ativas e fila de reposição por
urgência. A regra vale para **esses números**: dados de outra natureza (uma
série histórica sobre `stock_movements`, por exemplo) não são fonte paralela e
podem ter endpoint próprio.

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
  aceitam `workflow_dispatch`. A variável `BACKEND_URL` e o secret `CRON_SECRET`
  estão configurados no GitHub. As execuções manuais dos dois workflows foram
  validadas com sucesso em produção.
- Não há workflow de deploy. O Blueprint `render.yaml` descreve o Web Service
  Docker gratuito com root `backend/` e health check em `/healthz`; o Render
  faz auto-deploy do backend quando conectado ao repositório. A Vercel também
  está conectada e publica o frontend em `https://estoca-erp.vercel.app`.
- O `DATABASE_URL` pode receber diretamente a connection string do Neon. A configuração troca o dialect para `postgresql+asyncpg`, converte `sslmode` para o parâmetro `ssl` do asyncpg e descarta `channel_binding`, que não é aceito pelo driver.
- Estado atual de configuração: o Render gera `JWT_SECRET` e recebe
  `CRON_SECRET` manualmente. O GitHub possui o mesmo `CRON_SECRET` como secret e
  `BACKEND_URL=https://estoca-api.onrender.com` como variável de repositório.
- Render e Neon estão na AWS US West 2 (Oregon). O banco ativo é o projeto
  `estoca-erp-oregon`, branch `production`, database `neondb`; o projeto antigo
  em São Paulo foi removido após o cutover e a validação em produção.

## Seed da sandbox

O bootstrap de uma sessão nova e o reset administrativo criam o mesmo estado
inicial: 4 categorias, 16 produtos, 2 usuários demo e 23 movimentações
distribuídas ao longo de 14 dias. O seed inteiro roda em uma transação e
`created_at` usa `server_default=func.now()` — que no Postgres é o horário da
*transação* —, então sem uma passada explícita de retrodatação as 23
movimentações nasceriam com o mesmo carimbo: a linha do tempo somem e o filtro
por período fica sem o que filtrar. A rota pública continua recusando
`created_at` vindo do cliente; quem fabrica a data aqui é o servidor montando a
sandbox. A expiração de sessão não é afetada — ela olha `sessions`. Os
produtos começam com saldos variados; dois produtos ficam abaixo do estoque
mínimo para alimentar a fila de reposição.

O seed não escreve `product.quantity` diretamente. Primeiro cria os produtos e
usuários, depois registra o estoque inicial e o histórico adicional por
`StockMovementService`. Assim, a mesma regra responsável pelas movimentações
reais mantém saldo e `resulting_quantity` coerentes. Uma segunda chamada de
bootstrap na mesma sessão não duplica nenhum item.

## Testes

**Backend** (pytest + `httpx.AsyncClient` contra Postgres real de teste) — 5 fluxos obrigatórios, todos com teste dedicado:
1. **Isolamento entre sessões** — dois clientes com cookie jars distintos não veem dados um do outro. Prova a premissa central do produto.
2. **Seed correto** — bootstrap cria 4 categorias, 16 produtos, 23
   movimentações e 2 usuários demo; segunda chamada com o mesmo cookie não
   recria.
3. **Expiração** (com `freezegun`) — 2h inatividade OU 24h de vida; `cleanup/expired` remove só as vencidas; `wipe-all` remove tudo.
4. **Regras de estoque** — entrada soma, saída bloqueia se insuficiente (422), ajuste calcula delta absoluto, teto de 500, `resulting_quantity` correto.
5. **RBAC** — operador bloqueado em mutação de produto/categoria (403) mas liberado em movimentações; reset só admin; JWT de uma sessão não funciona em outra.

**Frontend**: `npm run build` no CI cobre erros de TypeScript e a validação dos
checkpoints permanece manual. `npm run screenshots`
(`frontend/scripts/capture-screenshots.mjs`) percorre as telas principais com os
dois perfis e grava `docs/screenshots/`; roda contra uma sandbox nova, então as
imagens sempre mostram o mesmo catálogo inicial. `npm run demos`
(`capture-demos.mjs`) grava os GIFs de `docs/demos/` — Playwright registra a
interação em vídeo e o `ffmpeg` converte, cortando a abertura da sessão pelo
instante que cada roteiro marca. Há um teste E2E direcionado em Playwright/WebKit
para o risco cross-domain principal: com cookies removidos, ele confirma em
produção que bootstrap após recarga, login e movimentação preservam a sandbox
por `X-Session-Id`. A suíte não roda na CI para evitar o download do navegador
em todos os pushes.

A suíte atual do backend possui 35 testes. O seed populado, o reset e os
limites de produtos e movimentações são cobertos contra PostgreSQL real.
