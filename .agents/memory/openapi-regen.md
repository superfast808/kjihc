---
name: OpenAPI regen workflow
description: How to add API fields safely in the KJIHC monorepo
---
Rule: add fields to lib/api-spec/openapi.yaml, then `npx orval --config ./orval.config.ts` in lib/api-spec, then delete the `export * from './generated/types';` line orval re-adds to lib/api-zod/src/index.ts (TS2308 conflict), then `npx tsc -b` in api-zod and api-client-react (messaging.ts react error is pre-existing; noEmitOnError:false).
**Why:** orval cleans output folders — any hand-patched field in generated files (e.g. playerPhoto) silently disappears on regen and breaks the web build.
**How to apply:** whenever a member/API field is added or a regen is run, grep the web app for fields used from generated types and confirm they exist in openapi.yaml.
