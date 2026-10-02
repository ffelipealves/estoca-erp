# Estoca — Arquitetura de referência

Design-alvo do backend e frontend. Consultar quando for implementar uma parte específica (não precisa ler inteiro para todo incremento). Uma vez que models/schemas/rotas existam de verdade, **o código manda** — se este documento divergir do código, é o doc que está desatualizado.

Invariantes cross-cutting (isolamento por sessão, quem escreve `product.quantity`, etc.) estão em `AGENTS.md`, não repetidos aqui.

## Camadas do backend

- `models/` — SQLAlchemy `DeclarativeBase`, um arquivo por entidade.
- `schemas/` — Pydantic, entrada/saída da API.
- `repositories/` — única camada que toca `AsyncSession`/SQL diretamente.
- `services/` — regra de negócio; único lugar que chama repositories de mais de uma entidade numa mesma operação (ex.: criar produto com estoque inicial mexe em `products` e `stock_movements`).
- `routers/` — só parsing de request, chamada ao service certo, e devolver o schema de resposta. Sem lógica de negócio.
- `core/` — `config.py` (Settings via pydantic-settings), `database.py` (engine async + `get_db`), `security.py` (bcrypt + JWT), `deps.py` (`get_current_session`, `get_current_user`, `require_role` e o `DbSession`, com escopo `function` para o commit de `get_db` acontecer antes de a resposta sair), `errors.py` (`DomainError` e subclasses).

## Frontend

Next.js App Router com Tailwind v4, componentes do shadcn/ui sobre Radix
(`components/ui/`, customizados como "teclas" e "visores") e o sistema visual
"Coletor" descrito em [`DESIGN.md`](DESIGN.md): tokens de cor e raio em
`app/globals.css`, Archivo como única família (o eixo de largura condensa
números e títulos), amarelo reservado à ação principal e cor de operação só nos
sinais `+ − =`.

**Rotas.** `/entrar` é o login; o grupo `app/(app)/` tem uma rota por área
(`/painel`, `/produtos`, `/categorias`, `/movimentacoes`, `/administracao`) e um
layout que guarda o acesso: sem login, leva a `/entrar?next=<área>` e volta para
ela depois. Tudo renderiza no cliente, porque sessão e login vivem no
`sessionStorage` da aba. Filtros, ordenação e página ficam na URL
(`components/estoca/use-url-state.ts`), escritos pelo `history` nativo.

**Dados.** `lib/api.ts` centraliza os contratos HTTP, o cookie, o fallback
`X-Session-Id` e o Bearer token, e avisa quem acompanha a sessão a cada resposta
2xx ou 401. `lib/estoca/store.tsx` é a store da aplicação:

- **Boot** em três requisições reais — `/healthz` acorda o servidor gratuito,
  `POST /sessions/bootstrap` abre ou reabre a sandbox e `GET /sessions/me` lê o
  prazo. Um 401 durante o boot é falha de boot, com "Tentar novamente".
- **Relógio:** a cada resposta da API, o prazo é recalculado como
  `min(agora + inactivity_seconds, max_expires_at)`, no relógio do servidor. O
  fim do prazo, ou um 401 depois do boot, leva à tela de sandbox expirada; se só
  o token venceu, a pessoa volta a `/entrar` na mesma sandbox.
- **Login e perfil:** `POST /auth/login` com as contas de `lib/demo-users.ts`;
  trocar de perfil é logar com a outra conta, na mesma sandbox.
- **Catálogo:** categorias e produtos (no máximo 50) ficam em memória e são a
  fonte dos totais, da fila de estoque baixo e do valor por categoria. As ações
  de escrita chamam a API e atualizam a store com a resposta; erros voltam como
  `WriteResult`, com o campo culpado quando há um (SKU ou nome repetido).
- **Movimentações** não ficam na store: o histórico pagina e filtra no servidor,
  o Painel lê as seis mais recentes e a série de saldo. Cada registro sobe uma
  versão que faz essas telas relerem, e marca a linha nova para piscar uma vez.

`lib/estoca/adapters.ts` converte o snake_case da API para os tipos das telas;
o preço vira número só para exibição, e os totais somam em centavos inteiros
(`lib/estoca/selectors.ts`). `lib/estoca/use-api-query.ts` é a leitura de uma
tela: carrega, mantém o dado anterior enquanto relê e oferece a nova tentativa.

**Telas** ficam em `components/estoca/<área>/`. O shell
(`components/estoca/shell/`) tem a barra de status, o rail (que vira menu
lateral no celular), o campo de leitura e os atalhos `M` e `/`. Ações que o
perfil não pode executar continuam visíveis e travadas
(`components/estoca/locked-button.tsx`); o clique explica o motivo e oferece
trocar para Administrador (`components/estoca/overlays.tsx`, que também abre o
modal de movimentação de qualquer área).

**Modais.** Todo formulário de escrita abre em `components/ui/dialog.tsx`, sobre
o Radix. A prop `busy` trava Esc, clique fora e X durante o envio; o foco volta
a quem abriu o modal (o Radix só faria isso com um `DialogTrigger`); cada
abertura cria um formulário novo, e um envio bem-sucedido mantém o formulário
travado durante a animação de saída. No celular o modal é uma folha inferior
com o corpo rolável.

**Gráfico.** A série de saldo (`components/estoca/painel/balance-timeline.tsx`,
Recharts) é desenhada em **degrau**: o saldo muda no evento e se mantém até o
próximo, e interpolar afirmaria uma variação contínua que não aconteceu. A linha
é grafite; a cor da operação fica só no marcador, que também muda de forma
(▲ entrada, ▼ saída, ◆ ajuste). Movimentações no mesmo instante — o estoque
inicial do seed — viram um só ponto, e a mesma série existe como tabela.

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
        varchar description
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
        int previous_quantity
        int resulting_quantity
        varchar note
        timestamptz created_at
    }
```

Toda FK para `sessions.id` é `CASCADE`. `products.category_id` é `RESTRICT` (bloqueia exclusão de categoria com produto vinculado). `stock_movements.performed_by_user_id` é `SET NULL`.

- **`sessions`**: `id`, `created_at`, `last_activity_at` (índices nos dois — usados pela query de limpeza).
- **`demo_users`**: `id`, `session_id`, `email`, `password_hash`, `role` (`admin`/`operador`), `full_name`. `UNIQUE(session_id, email)`.
- **`categories`**: `id`, `session_id`, `name`, `description` (nullable, até 120 caracteres — migration `0002`), `created_at`, `updated_at`. `UNIQUE(session_id, name)`.
- **`products`**: `id`, `session_id`, `category_id` (FK RESTRICT), `name`, `sku`, `price` (numeric 10,2), `quantity` (default 0), `low_stock_threshold` (default 5 — já na migration inicial, é usado só no sprint 2 mas evita segunda migration), `created_at`, `updated_at`. `UNIQUE(session_id, sku)`.
- **`stock_movements`**: `id`, `session_id`, `product_id` (FK CASCADE), `type` (`entrada`/`saida`/`ajuste`), `quantity`, `previous_quantity` (saldo do produto antes de aplicar — migration `0003`, que preencheu as linhas existentes pelo delta em entrada/saída e pelo `LAG` no ajuste), `resulting_quantity`, `note` (nullable), `performed_by_user_id` (FK → demo_users, `SET NULL`), `created_at`. Índice composto `(session_id, product_id, created_at)`.

Enums nativos do Postgres via `sa.Enum(...)`. Rascunhar todos os models antes do primeiro `alembic revision --autogenerate`, para sair com uma migration inicial única (`0001_initial_schema.py`).

## Endpoints

Prefixo `/api/v1`; limpeza interna em `/internal` (`include_in_schema=False`).

**Sessão** (sem JWT — cookie `estoca_session` ou header `X-Session-Id`)
- `POST /sessions/bootstrap` — cria sessão + seed se ausente/expirada; senão só atualiza `last_activity_at`. Seta cookie e retorna `session_id` no corpo.
- `GET /sessions/me` — info da sessão: `created_at`, `last_activity_at`, `expires_at`, TTL restante, e a regra de expiração (`inactivity_seconds` e `max_expires_at`), para o cliente renovar a contagem regressiva a cada resposta sem repetir a configuração.
- `POST /sessions/me/reset` — reset da sessão atual (ver AGENTS.md). **Admin only.** Exposto na aba Administração.

**Auth**
- `POST /auth/login` — `{email, password}` contra `demo_users` da sessão atual → `{access_token, user}`. JWT: `{sub: user_id, session_id, role, exp: +2h}`.

**Categorias / Produtos / Movimentações** (JWT obrigatório)
- Categorias: `GET/POST /categories`, `GET/PUT/DELETE /categories/{id}` — mutação **admin only**; `description` é opcional (vazio vira `null`) e o `PUT` substitui o recurso inteiro, então omiti-la apaga a descrição; delete bloqueia (422) se houver produtos vinculados.
- Produtos: `GET/POST /products` (filtros `category_id`, `search`, `low_stock`; teto de 50/sessão; sku único por sessão), `GET/PUT/DELETE /products/{id}` — mutação **admin only**.
- Movimentações: `GET /stock-movements/balance-timeline` devolve o saldo total da sessão após cada evento — cada ponto traz `at`, `movement_id`, `type`, `product_id`, `delta` (`resulting_quantity - previous_quantity` da própria linha) e `total_quantity` (soma corrente dos deltas), em uma consulta só. O delta não depende da ordem de `created_at`, então o último ponto sempre fecha com o catálogo. É o único agregado servido pelo backend, e não conflita com a regra do dashboard: são dados de outra natureza, não os números do fechamento.
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
inicial: um depósito de material de construção com 4 categorias (Ferramentas
manuais, Elétrica, Hidráulica e Fixação), 16 produtos, 2 usuários demo e 39
movimentações — o estoque inicial de cada produto mais 23 entradas, saídas e
ajustes do dia a dia. O histórico começa à meia-noite de 14 dias atrás, no
horário de Brasília: o estoque inicial de todos os produtos é um só instante, a
abertura do histórico, e cada movimentação tem dia e hora fixos, a última na
véspera. A série de saldo desenha o estoque inicial como um único ponto de
partida. O
seed inteiro roda em uma transação e `created_at` usa
`server_default=func.now()` — que no Postgres é o horário da *transação* —,
então sem essa retrodatação explícita as movimentações nasceriam com o mesmo
carimbo: a linha do tempo some e o filtro por período fica sem o que filtrar.
A rota pública continua recusando `created_at` vindo do cliente; quem fabrica a
data aqui é o servidor montando a sandbox. A expiração de sessão não é afetada
— ela olha `sessions`. Os ajustes são registrados pelo admin; entradas e saídas,
pelo operador. Cinco produtos terminam no limite mínimo ou abaixo dele, um de
cada urgência da fila de reposição (zerado, crítico e baixo).

O seed não escreve `product.quantity` diretamente. Primeiro cria os produtos e
usuários, depois registra o estoque inicial e o histórico adicional por
`StockMovementService`. Assim, a mesma regra responsável pelas movimentações
reais mantém saldo e `resulting_quantity` coerentes. Uma segunda chamada de
bootstrap na mesma sessão não duplica nenhum item.

## Testes

**Backend** (pytest + `httpx.AsyncClient` contra Postgres real de teste) — 5 fluxos obrigatórios, todos com teste dedicado:
1. **Isolamento entre sessões** — dois clientes com cookie jars distintos não veem dados um do outro. Prova a premissa central do produto.
2. **Seed correto** — bootstrap cria 4 categorias, 16 produtos, 39
   movimentações e 2 usuários demo; segunda chamada com o mesmo cookie não
   recria.
3. **Expiração** (com `freezegun`) — 2h inatividade OU 24h de vida; `cleanup/expired` remove só as vencidas; `wipe-all` remove tudo.
4. **Regras de estoque** — entrada soma, saída bloqueia se insuficiente (422), ajuste calcula delta absoluto, teto de 500, `resulting_quantity` correto.
5. **RBAC** — operador bloqueado em mutação de produto/categoria (403) mas liberado em movimentações; reset só admin; JWT de uma sessão não funciona em outra.

**Frontend**: `npm run build` no CI cobre erros de TypeScript e a validação dos
checkpoints permanece manual. `npm run screenshots`
(`frontend/scripts/capture-screenshots.mjs`) percorre as telas principais com os
dois perfis e grava as 16 imagens de `docs/screenshots/` (com os modais de
produto, categoria e movimentação, o bloqueio explicado ao operador e a edição
no celular); roda contra uma
sandbox nova, então as imagens sempre mostram o mesmo catálogo inicial, e apaga
as imagens numeradas anteriores antes de gravar. `npm run demos`
(`capture-demos.mjs`) grava os 6 GIFs de `docs/demos/` — Playwright registra a
interação em vídeo e o `ffmpeg` converte, cortando a abertura da sessão pelo
instante que cada roteiro marca; `npm run demos -- <nome>` grava só os GIFs
indicados. Como o modal é renderizado num portal no fim do DOM, os seletores dos
roteiros dentro dele são escopados a `[data-slot="dialog-content"]`: um `label`
ou `input` solto acha primeiro o filtro que está por trás. Há um teste E2E
direcionado em Playwright/WebKit para o risco cross-domain principal: com
cookies removidos, ele confirma que bootstrap após recarga, login e movimentação
preservam a sandbox por `X-Session-Id` — contra a produção por padrão, ou contra
o ambiente local com `PLAYWRIGHT_BASE_URL` e `PLAYWRIGHT_API_URL`. A suíte não
roda na CI para evitar o download do navegador em todos os pushes.

Todos os formulários de escrita — cadastro, edição e exclusão de produto e de
categoria, e o registro de movimentação — abrem em modal
(`components/ui/dialog.tsx`, sobre o Radix). Cada tela tem uma suíte própria em
Chromium desktop, `tests/e2e/product-modal.spec.ts`, `category-modal.spec.ts` e
`movement-modal.spec.ts`, que rodam contra o frontend local:
`PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:modais`. Os
seletores são por papel, rótulo e id de campo, não por classe. Cobrem fechar por
X, Esc, clique fora e Cancelar (rascunho descartado e foco devolvido), duplo
clique, cliques repetidos — inclusive durante a animação de saída — e envios
simultâneos ao salvar, cadastrar, excluir e registrar (uma única requisição; no
caso da movimentação, o saldo final confirma que nada foi somado duas vezes),
bloqueio de fechamento durante a operação, o erro da API dentro do modal, a
tecla `M`, a exclusão que exige confirmação e a categoria com produtos, que não
oferece exclusão. Login, atraso de rede e seleção em select compartilhados
ficam em `tests/e2e/support/modal-helpers.ts`.

A suíte atual do backend possui 41 testes. O seed populado, o reset e os
limites de produtos e movimentações são cobertos contra PostgreSQL real. Um
teste chama a app ASGI diretamente e confere, no instante em que o corpo da
resposta do bootstrap sai, que a sessão já está no banco — a garantia de que o
commit vem antes da resposta.
