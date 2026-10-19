# Arquitetura do Projeto

## Padrao em camadas: Routes -> Use Cases -> Prisma

- **Routes** (`src/routes/`) - Handlers de rotas Fastify. Registram schemas Zod para validacao de request/response via `fastify-type-provider-zod`. Extraem sessao de autenticacao e definem status HTTP.
- **Use Cases** (`src/usecases/`) - Classes de logica de negocio. Recebem DTOs, usam transacoes Prisma para atomicidade (ex: desativar planos ativos antes de criar novos). Uma classe por caso de uso.
- **Schemas** (`src/schemas/`) - Schemas Zod compartilhados entre rotas e OpenAPI docs. Definem tanto validacao de entrada quanto formato de resposta.
- **Errors** (`src/errors/`) - Classes de erro customizadas (ex: `NotFoundError`) usadas nos use cases e tratadas nas rotas.

## Fastify: Rotas de API

- **SEMPRE** siga os princípios do REST para criar rotas. Exemplo: `GET /workout-plans`, `GET /workout-plans/:id/days`.
- **SEMPRE** crie os arquivos das rotas em `src/routes/`.
- **SEMPRE** use `fastify-type-provider-zod` para definir os schemas de request e response de uma rota.
- **SEMPRE** use Zod v4, **NUNCA** use o Zod v3.
- **SEMPRE** crie os schemas das operações de criação e atualização dentro de `src/schemas/`.
- **SEMPRE** use o `src/schemas/index.ts` para tipar respostas de erro.
- Uma rota **NUNCA** deve conter regras de negócio, apenas validações de dados (com o Zod) e de autenticação (se necessário).
- Quando uma rota precisar ser protegida (acessível apenas por usuários autenticados), **SEMPRE** use o `auth.api.getSession` (`src/lib/auth.ts`) para recuperar a sessão do usuário.
- Uma rota deve **SEMPRE** instanciar e chamar um use case.
- **SEMPRE** trate os erros lançados pelo use case.

### Exemplo:

```ts
import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
```
