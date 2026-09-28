#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Build DB package so TypeScript project references stay current
pnpm --filter @workspace/db exec tsc -p tsconfig.json
# Push schema changes non-interactively (additive only in normal flow; --force auto-approves any prompts)
pnpm --filter @workspace/db run push-force
