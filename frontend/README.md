# Estoca Frontend

Frontend do Estoca em Next.js 16, React 19, TypeScript, App Router, Tailwind CSS
e componentes do shadcn/ui sobre Radix, com o sistema visual "Coletor" descrito
em [`docs/DESIGN.md`](../docs/DESIGN.md).

## Estado atual

O boot acorda a API, abre a sandbox e lê o prazo; o login restaura durante a
aba, e a troca de perfil acontece na mesma sandbox. Cada área tem sua rota
(`/painel`, `/produtos`, `/categorias`, `/movimentacoes`, `/administracao`),
dentro de um shell com barra de status, rail, campo de leitura (`/`) e a tecla
de registrar movimentação (`M`). Administradores controlam o catálogo; os dois
perfis registram entrada, saída e ajuste pelo modal de movimentação. O Painel
resume valor armazenado, unidades, categorias ativas, a fila de estoque baixo,
o valor por categoria e o saldo total no tempo.

A estrutura:

```text
src/app/                 rotas: /entrar e o grupo (app) com as cinco áreas
src/lib/api.ts           contratos HTTP, sessão, X-Session-Id e Bearer token
src/lib/estoca/          store, adaptadores da API, regras, seletores e formatos
src/components/estoca/   shell, modais e telas de cada área
src/components/ui/       componentes do shadcn/ui customizados
```

A aplicação está publicada em `https://estoca-erp.vercel.app`, com deploy
automático da branch `main` pela Vercel. O build também roda na CI do GitHub.

## Desenvolvimento

Copie a configuração de exemplo e inicie o servidor:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

A aplicação fica em `http://localhost:3000`. Por padrão, o exemplo aponta para
a API publicada no Render; altere `NEXT_PUBLIC_API_URL` para
`http://localhost:8000` quando quiser usar o backend local.

O cliente guarda o `session_id` e a autenticação em `sessionStorage`. Todas as
requisições autenticadas enviam `X-Session-Id` e Bearer token; o header de sessão
é o fallback necessário quando frontend e API estão em domínios públicos distintos.

## Verificações

```bash
npm run lint
npm run build
npx playwright install webkit
npm run test:e2e:webkit
```

O teste WebKit roda contra a aplicação publicada por padrão e força o cenário
sem cookie para verificar o fallback por `X-Session-Id`. Use
`PLAYWRIGHT_BASE_URL` para apontá-lo a outro frontend e `PLAYWRIGHT_API_URL` para
a API correspondente.

Os modais têm suítes próprias em Chromium, contra o frontend local:

```bash
npx playwright install chromium
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e:modais
```
