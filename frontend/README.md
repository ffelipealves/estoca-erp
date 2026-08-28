# Estoca Frontend

Frontend do Estoca em Next.js, TypeScript, App Router e Tailwind CSS.

## Desenvolvimento

Copie a configuração de exemplo e inicie o servidor:

```bash
cp .env.example .env.local
npm install
npm run dev
```

A aplicação fica em `http://localhost:3000`. Por padrão, o exemplo aponta para
a API publicada no Render; altere `NEXT_PUBLIC_API_URL` para
`http://localhost:8000` quando quiser usar o backend local.

## Verificações

```bash
npm run lint
npm run build
```
