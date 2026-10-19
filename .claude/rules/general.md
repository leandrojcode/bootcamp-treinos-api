# Regras Gerais e Comandos

## Comandos do Projeto

- Desenvolvimento: `pnpm dev`
- Banco de Dados (Migrate): `pnpm prisma migrate dev`
- Banco de Dados (Generate): `pnpm prisma generate`
- Banco de Dados (Format): `pnpm prisma format`

## Banco de Dados

PostgreSQL 16 via Docker. Prisma client inicializado em `src/lib/db.ts`. Tipos gerados em `src/generated/prisma/` (gitignored). Schema em `prisma/schema.prisma` com suporte a fuso horario correto usando `@db.Timestamptz()`.

## Convenções de Rede e Ambiente

- **CORS** permite `http://localhost:3000` com credentials
- Variaveis de ambiente: `PORT`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
