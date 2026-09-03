# Estoca Frontend

Frontend do Estoca em Next.js 16, React 19, TypeScript, App Router e Tailwind CSS.

## Estado atual

O frontend possui bootstrap da sessão sandbox, login com restauração durante a
aba, shell responsivo, CRUD de produtos e categorias e histórico paginado de
movimentações. Administradores controlam o catálogo; ambos os perfis registram
entrada, saída e ajuste de estoque pelo formulário operacional.

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
`PLAYWRIGHT_BASE_URL` para apontá-lo a outro frontend.
