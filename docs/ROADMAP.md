# Estoca — Roadmap

Cronograma de 14 dias, part-time, a partir de 2026-08-25. Cada dia deste roadmap é implementado em vários incrementos pequenos dentro da mesma sessão ou entre sessões (ver "Como trabalhar" em `AGENTS.md`) — a lista abaixo é o que precisa estar pronto até o *fim* do dia, não o tamanho de um único incremento.

## Status atual

**Dias 1 a 14 — concluídos.** O núcleo do Estoca está publicado em `https://estoca-erp.vercel.app`, com a API em `https://estoca-api.onrender.com` e PostgreSQL no Neon. Bootstrap, login, catálogo e movimentações foram validados em produção; o fallback sem cookie passou no WebKit 26.5 em viewport de iPhone, e os dois workflows de limpeza passaram via `workflow_dispatch`. O Dia 14 adicionou o fechamento do estoque com valor armazenado, unidades, categorias ativas e fila de reposição, validado visualmente em desktop e mobile. O gráfico foi cortado dentro do timebox, sem deixar interface incompleta visível — e entregue depois, na sequência descrita em "Depois do roadmap". Em um incremento pós-roadmap, o seed foi ampliado para 16 produtos e 23 movimentações por sessão, e Render e Neon foram alinhados na região de Oregon. O README final registra arquitetura, decisões, execução local, verificações, hospedagem e próximos passos.

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
| 13 | Frontend: form/lista de movimentações. Deploy na Vercel. Teste manual em produção no Chrome e teste WebKit em viewport de iPhone, sem cookies, validando o fallback por header. | **Checkpoint "núcleo pronto"**: fluxo completo (bootstrap → login → CRUD → movimentação) funcionando em produção nos dois domínios; fallback `X-Session-Id` validado; crons ativados e validados via `workflow_dispatch`. |
| 14 | Se sobrou tempo: sprint 2 timeboxed (cards de resumo + lista de estoque baixo + gráfico com recharts). Reservar o fim do dia pro `README.md` final (arquitetura, decisões, como rodar local, próximos passos). | README cobre arquitetura + como rodar local; sprint 2 implementado até onde o tempo permitiu, sem deixar nada pela metade visível na UI. |

Se atrasar: cortar primeiro o gráfico do dashboard, depois o dashboard inteiro — manter o badge de estoque baixo se der (barato, bom impacto visual). Núcleo (dias 1-13) não é negociável; sprint 2 (dia 14) é.

## Depois do roadmap

Incrementos entregues após o Dia 14, cada um publicado e verificado em produção.

| # | Entrega | O que envolveu |
|---|---|---|
| 1 | Aba de administração | Expõe `POST /sessions/me/reset`, que já existia no backend testado mas nunca teve interface. Reúne identidade da sandbox com contagem regressiva, matriz de permissões e reset com confirmação. |
| 2 | Bloqueio visível para o operador | Os controles de mutação deixam de sumir e passam a aparecer apagados, com cadeado; o clique explica a restrição. Antes, quem entrava como operador não tinha como perceber que o sistema tem RBAC. |
| 3 | Ordenação e filtros no catálogo | Cabeçalhos ordenáveis e filtros por categoria e estoque mínimo, no cliente — o teto é de 50 produtos e a lista já está em memória. |
| 4 | Filtros de movimentação | `type` e o período `date_from`/`date_to` no backend, com testes. Instantes ISO 8601, com a conversão do dia civil no navegador, que é quem conhece o fuso. |
| 5a | Aba Painel | O fechamento do estoque ganha seção própria e vira a tela inicial; Produtos fica como catálogo puro, sem a rolagem longa antes da tabela. |
| 5b | Valor por categoria | Barra horizontal derivada de `GET /products`. A soma das barras fecha com o valor armazenado do card acima. |
| 5c | Evolução do saldo | `GET /stock-movements/balance-timeline` reconstrói o saldo total por evento com `LAG` + soma corrente. Exigiu antes espalhar os carimbos do seed, que nasciam todos iguais. |
| — | Faxina de interface | Remove marcadores do cronograma, pseudo-códigos que pareciam identificadores e jargão que escondia a ação dos botões; textos de ajuda passam a explicar o efeito, atrás de botões "?". |
| — | Capturas de tela | `npm run screenshots` gera as doze imagens de `docs/screenshots/` com Playwright, contra uma sandbox recém-criada. |

## Próximos passos fora do escopo das 2 semanas

Registrar no README final: fornecedores, clientes, multi-depósito, refresh token, rate limit de criação de sessão e expansão da cobertura E2E com Playwright.
