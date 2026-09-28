---
name: api-zod index.ts types conflict
description: How to fix the TS2308 ambiguity when regenerating lib/api-zod after orval codegen
---

# api-zod index.ts types conflict

## The Rule
`lib/api-zod/src/index.ts` must only export from `./generated/api` — never re-export from `./generated/types`.

**Why:** Orval v8 in split mode generates both a Zod schema const (`export const Foo = zod.object(...)`) in `generated/api.ts` AND a TypeScript type alias (`export type Foo = {...}`) in `generated/types/Foo.ts` with the **same name**. TypeScript 5 raises TS2308 ("already exported a member named X") when both are re-exported from the same barrel index, even with `export type *`. The types folder is not needed — consumers derive types via `z.infer<typeof FooSchema>`.

**How to apply:** After every `pnpm --filter @workspace/api-spec exec orval` run, orval overwrites `lib/api-zod/src/index.ts` with both exports. Immediately overwrite it with only the single line:
```ts
export * from "./generated/api";
```
