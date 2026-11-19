# Contexto do Projeto - API de Plano de Treino

Você é um desenvolvedor backend especialista. Estamos construindo uma API de gerenciamento de planos de treino utilizando a seguinte stack e regras de negócio.

## Stack Tecnológica

- **Framework:** Fastify com TypeScript
- **Validação e Tipagem de Rotas:** `fastify-type-provider-zod`
- **Autenticação:** `better-auth` (utilizando `fromNodeHeaders` para extração de sessão)
- **Gerenciamento de Erros:** Erros conhecidos (ex: `NotFoundError`) estendem uma classe base e retornam códigos de erro padronizados.
- **Arquitetura:** Rotas chamam Casos de Uso (`usecases`) para executar a lógica de negócios.

## Regras de Negócio Globais (Planos de Treino)

1. **Autenticação Obrigatória:** Todas as rotas de plano de treino exigem um usuário autenticado via `better-auth`.
2. **Validação de Dias Ativos:** Um plano de treino precisa ter pelo menos um dia de treino ativo (`isRest: false`).
3. **Validação de Exercícios:** Qualquer dia marcado como ativo (`isRest: false`) deve obrigatoriamente conter pelo menos um exercício cadastrado (`exercises.length > 0`).
4. **Padronização de Resposta de Erro:** Todos os erros devem seguir o formato do `ErrorSchema` contendo `{ error: string, code: string }`.

## Regras de Documentação (Scalar/OpenAPI)

1. **Tags Obrigatórias:** Toda definição de esquema de rota deve conter a propriedade `tags` mapeando para o grupo correspondente (ex: `tags: ["Workout Plan"]`).
2. **Sumário Descritivo:** Toda rota precisa de um `summary` curto e claro em inglês que descreva a ação do endpoint para exibição correta na interface do Scalar.
   3- **Validação de Dias da Semana:** Sempre utilize `z.enum(WeekDay)` importado diretamente do pacote do cliente do Prisma (`@prisma/client`) para validar os campos de dia da semana (`weekDay`), garantindo sincronia perfeita com os enums do banco de dados.
   4-- **Padrão de Nomenclatura de Arquivos:** Casos de uso devem seguir rigorosamente o padrão PascalCase (ex: `CreateWorkoutPlan.ts`, `GetHomeData.ts`) correspondendo exatamente ao nome da classe exportada.
