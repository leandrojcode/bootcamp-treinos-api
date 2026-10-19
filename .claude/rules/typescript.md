# Convenções de Código e TypeScript

## Padrões Estritos

- **TypeScript strict** com target ES2024 e module resolution `nodenext`.
- **ESLint** com typescript-eslint, integracao com prettier e `simple-import-sort` (imports devem ser ordenados de forma automática).
- **Zod 4** para validacao (usa padrao `z.interface()`, nao `z.object()`).
