# Estoca Frontend

Frontend do Estoca em Next.js 16, React 19, TypeScript, App Router e Tailwind CSS.

## Estado atual

O frontend possui bootstrap da sessão sandbox, login com restauração durante a
aba, shell responsivo e CRUD de produtos e categorias. Administradores veem as
ações de mutação; operadores consultam o catálogo sem receber esses controles.

A aplicação ainda não está hospedada. O build roda na CI do GitHub, e o deploy
na Vercel está planejado para o Dia 13 junto da interface de movimentações.

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
```
