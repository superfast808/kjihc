---
name: KJIHC App Architecture
description: Architecture, auth patterns, and key decisions for the Kilmarnock Junior Ice Hockey Club app.
---

## Stack
- Frontend: `artifacts/kjihc` — React + Vite + Wouter + TanStack Query + Clerk + Recharts
- API: `artifacts/api-server` — Express + Drizzle ORM + @clerk/express
- DB: Replit PostgreSQL, tables prefixed `kjihc_`
- Codegen: Orval from `lib/api-spec/openapi.yaml` → `lib/api-client-react` + `lib/api-zod`

## Auth
- Staff: Clerk (Microsoft SSO must be enabled in Clerk dashboard — user needs to do this manually via Clerk Auth pane)
- Parent portal: custom token-based magic links stored in `kjihc_parent_tokens`, no Clerk
- Staff access levels: `"1"` = superuser, comma-separated age group names = restricted access
- `requireStaff` middleware looks up staff by email from Clerk session claims

## Key Patterns
- OpenAPI spec: use `type: number` NOT `type: integer` (Zod v3 in use — `zod.int()` doesn't exist until v4)
- Orval params collision: avoid endpoints with both path params AND query params on the same operation; put token in request body instead
- Import hooks from `@workspace/api-client-react` never relative paths
- Clerk publishable key: `publishableKeyFromHost(hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)`

## DB Tables (all prefixed kjihc_)
members, staff, signins, fees, heja_codes, parent_tokens, ensign_entries

## Seeded Data
- Fee tiers: 4 tiers (Novice TBC, LTP £35, U10 £55, U12-U19 £75)
- Heja codes: LTP, U12s, U16s, U19s, Main Club, Lightning Girls
- Sample staff: admin@kjihc.org (superuser), tournaments@kjihc.org (superuser), marc.fowley@btinternet.com (restricted)
- 6 sample members + 2 sessions of sign-in data seeded

## Outstanding
- Microsoft SSO: user must add Microsoft as social provider in Clerk dashboard
- Parent magic link email: currently logged only — needs a real email provider (Resend/Mailgun)
- The join wizard success shows Heja code for selected age group
**Why:** Club uses Heja app for team comms — different groups have different codes
