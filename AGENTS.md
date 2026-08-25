# Estoca — guia para agentes

Mini ERP de estoque de portfólio: qualquer visitante recebe uma sessão isolada (sandbox) para mexer em produtos/categorias/movimentações; a sessão expira e é limpa automaticamente, então o próximo visitante sempre vê uma demo zerada. Stack: FastAPI + SQLAlchemy async + Alembic (backend), Next.js + TypeScript (frontend), PostgreSQL, Docker. Monorepo (`backend/`, `frontend/`).

## O invariante que não pode quebrar

Isolamento por sessão é a premissa inteira do produto. Toda tabela de negócio (`categories`, `products`, `stock_movements`, `demo_users`) carrega uma coluna `session_id` (FK → `sessions.id`, `ON DELETE CASCADE`), e toda query passa por esse filtro — nunca ler/escrever dado de negócio sem passar pela sessão resolvida em `get_current_session`/`get_current_user` (`backend/app/core/deps.py`). Uma mudança que faz dado vazar entre sessões está errada, não importa o que mais ela resolva.

## Arquitetura

Backend em camadas pragmáticas — `routers` → `services` (regra de negócio) → `repositories` (acesso a dados) → `schemas`/`models`. Não é Clean Architecture completa (sem camada de domínio isolada de framework, sem ports/interfaces): escolha deliberada de projeto solo de 2 semanas part-time, onde boilerplate de interfaces custaria tempo de feature. Regra de negócio mora nos `services`, nunca nos `routers`.

## Gotchas que sustentam o sistema

- **`stock_movement_service` é o único lugar que escreve `product.quantity`** — todo o resto só lê. É o que mantém saldo e histórico de movimentações coerentes entre si.
- **Semântica de `quantity` em movimentações**: `entrada`/`saida` é delta (sempre positivo; `saida` valida contra o saldo atual, 422 se insuficiente). `ajuste` é a quantidade **absoluta final** — o service calcula o delta internamente. Toda movimentação grava `resulting_quantity` (saldo após aplicar).
- **Cookie de sessão precisa de fallback por header.** Frontend (Vercel) e backend (Render) ficam em domínios públicos diferentes — `SameSite=None` é instável entre navegadores nesse cenário. `POST /sessions/bootstrap` retorna `session_id` no corpo também; o frontend guarda em `sessionStorage` e manda como header `X-Session-Id`; a dependency de sessão aceita cookie OU header.
- **Reset manual de sessão não desloga o admin** — apaga `stock_movements` → `products` → `categories` e reseeda o catálogo, mas preserva `demo_users` e o `session_id`.
- **Limpeza de sessões expiradas é via cascade**: o endpoint de limpeza só faz `DELETE FROM sessions WHERE ...`; o Postgres cuida do resto via FK cascade. Nunca escrever DELETE manual tabela por tabela.
- **PKs são UUID em tudo**, dinheiro é `Numeric(10,2)` (nunca float), `created_at` de movimentação é sempre gerado no servidor (nunca aceito do cliente).
- **Erros de domínio** sobem pela hierarquia `DomainError` (`backend/app/core/errors.py`) com um exception handler global — services levantam a exceção certa, routers ficam limpos.

## Hospedagem

Alvo fixo: **$0/mês, sem cartão de crédito em nenhuma plataforma** — Vercel (frontend), Render free (backend, Docker, aceita cold start), Neon (Postgres free), GitHub Actions (cron de limpeza + CI). Isso já descartou Fly.io (sem free tier desde out/2024) e Google Cloud Run (grátis, mas exige cartão cadastrado). Não trocar de provedor sem reabrir essa decisão com o usuário.

## Onde encontrar mais

- `docs/ARCHITECTURE.md` — modelo de dados, lista de endpoints, `docker-compose.yml`, workflows do GitHub Actions, estratégia de testes. Documento de design-alvo: uma vez que o código exista, o código manda — trate divergência como o doc ficou desatualizado (atualize) ou como desvio não intencional (corrija o código).
- `docs/ROADMAP.md` — cronograma dia a dia das 2 semanas, critérios de conclusão de cada checkpoint, e o progresso atual.

## Como trabalhar neste repo

- Sem `Co-Authored-By: Claude` em commits.
- Sessões avançam em incrementos pequenos dentro de cada dia do roadmap. Depois de cada incremento: relatar o que foi feito, o estado atual, e propor o próximo passo — não implementar o dia inteiro de uma vez.
