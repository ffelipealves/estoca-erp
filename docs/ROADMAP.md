# Estoca — Roadmap

Cronograma de 14 dias, part-time, a partir de 2026-08-25. Cada dia deste roadmap é implementado em vários incrementos pequenos dentro da mesma sessão ou entre sessões (ver "Como trabalhar" em `AGENTS.md`) — a lista abaixo é o que precisa estar pronto até o *fim* do dia, não o tamanho de um único incremento.

## Status atual

**Dias 1 a 7 — concluídos.** Checkpoint da semana 1 alcançado: base FastAPI/PostgreSQL em Docker, dependências reproduzíveis com Poetry, sessões isoladas com seed/reset, login bcrypt/JWT, RBAC e CRUDs completos de categorias e produtos. Produtos têm filtros, SKU único por sessão, teto de 50 e estoque inicial registrado como movimentação; edição rejeita alterações diretas de saldo e exclusão remove seu histórico por cascade. Próximo incremento: iniciar as regras completas de movimentação do Dia 8.

## Dias

| Dia | Foco | Critério de conclusão |
|---|---|---|
| 1 | `git init`, `.gitignore`, `README.md` mínimo, primeiro commit. `docker-compose.yml` (postgres+backend), FastAPI "hello world" + Dockerfile. Repo público no GitHub, push. | `docker compose up` sobe backend+postgres; `curl localhost:8000/healthz` responde 200; repo no GitHub com o primeiro commit. |
| 2 | Models SQLAlchemy completos (session, demo_user, category, product, stock_movement — ver `docs/ARCHITECTURE.md`). `alembic init` + migration `0001_initial_schema`. | `alembic upgrade head` roda limpo local; tabelas conferidas via `psql`. |
| 3 | `core/config.py`, `core/database.py`, `core/security.py` (bcrypt+JWT), `core/errors.py`. Setup pytest+httpx contra Postgres real, banco `estoca_test`. | `pytest` roda (mesmo que sem testes de negócio ainda) contra o banco de teste real. |
| 4 | Sessão completa (repository+service+router), `seed_service`, cookie + fallback header (`X-Session-Id`). | `POST /sessions/bootstrap` cria sessão+seed; teste de isolamento entre sessões passa. |
| 5 | Auth: `auth_service`, `POST /auth/login`, `get_current_user`/`require_role`. | Login funciona pros dois usuários demo; teste de RBAC básico passa. |
| 6 | Buffer + CRUD de Categorias completo. | Testes de categoria passam, incl. bloqueio de delete com produtos vinculados. |
| 7 | CRUD de Produtos completo (teto de 50, sku único, `initial_quantity`). | **Checkpoint semana 1**: sessão+seed+auth+categorias+produtos funcionando via `/docs`, testes cobrindo o core. |
| 8 | Movimentações: regras entrada/saída/ajuste, atualização atômica de `quantity`, teto de 500. | Os 4 casos de movimentação testados (entrada, saída insuficiente, ajuste, teto) passam. |
| 9 | Endpoint de limpeza interna + testes. Dockerfile final do backend validado. | `docker build` do backend funciona; testes de limpeza (secret errado/certo, expiração) passam. |
| 10 | CI (`ci.yml`) verde no GitHub Actions. Deploy: Neon + Render. | Backend respondendo em produção (`/healthz` 200 no domínio do Render); CI verde no Actions. |
| 11 | `create-next-app`, `lib/api.ts`, `SessionProvider` (bootstrap + loading de cold start), tela de login. | Login funciona local contra o backend (local ou já em produção). |
| 12 | Frontend: lista/form de produtos, form de categoria (mutação só visível pra admin). | CRUD de produto/categoria funciona ponta a ponta no navegador. |
| 13 | Frontend: form/lista de movimentações. Deploy na Vercel. Teste manual em produção (Chrome + Safari/iOS) validando o fallback cookie/header. | **Checkpoint "núcleo pronto"**: fluxo completo (bootstrap → login → CRUD → movimentação) funcionando em produção nos dois domínios; crons ativados e validados via `workflow_dispatch`. |
| 14 | Se sobrou tempo: sprint 2 timeboxed (cards de resumo + lista de estoque baixo + gráfico com recharts). Reservar o fim do dia pro `README.md` final (arquitetura, decisões, como rodar local, próximos passos). | README cobre arquitetura + como rodar local; sprint 2 implementado até onde o tempo permitiu, sem deixar nada pela metade visível na UI. |

Se atrasar: cortar primeiro o gráfico do dashboard, depois o dashboard inteiro — manter o badge de estoque baixo se der (barato, bom impacto visual). Núcleo (dias 1-13) não é negociável; sprint 2 (dia 14) é.

## Próximos passos fora do escopo das 2 semanas

Registrar no README final: fornecedores, clientes, multi-depósito, refresh token, rate limit de criação de sessão, testes E2E com Playwright.
