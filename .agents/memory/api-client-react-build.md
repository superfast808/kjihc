---
name: api-client-react dist build
description: How to rebuild lib/api-client-react/dist after orval codegen
---

# api-client-react dist build

## The Rule
`lib/api-client-react/tsconfig.json` must have `"noEmitOnError": false` to produce dist declaration files.

**Why:** `messaging.ts` imports from `'react'` but the package has no `@types/react` devDependency. The base tsconfig has `"noEmitOnError": true`, which blocks all output when this pre-existing error is present. Overriding to `false` allows declaration emit to proceed despite the single missing-type error.

**How to apply:** After orval codegen, run:
```
cd lib/api-client-react && npx tsc --project tsconfig.json
```
The one `messaging.ts` react error is expected and harmless. The dist/generated/ files will be produced.
