---
name: express.raw on /api breaks all JSON bodies
description: Why POST/PATCH routes silently no-op'd (flags, fees balance) — raw body parser mounted too broadly
---
Mounting `express.raw({ type: "application/json" })` on a broad prefix (e.g. `/api`) consumes every JSON request body as a Buffer; `express.json()` registered later cannot re-parse it, so `req.body` fields are all `undefined`. Handlers that build partial updates from body fields then update nothing and still return 200 — writes silently no-op, and side effects (emails, notifications) never fire.

**Why:** The Stripe webhook needs the raw body for signature verification and was mounted as `app.use("/api", express.raw(...), stripeWebhookRouter)`, breaking every other JSON mutation in the API.

**How to apply:** Scope raw parsers to the exact webhook path (`app.use("/api/webhooks/stripe", express.raw(...))`). When mutations return 200 but nothing persists and no DB shows the write, suspect body parsing before caching/DB theories. Also note: dev API can point at a different DB via DATABASE_OVERRIDE_URL — check which DB the server actually uses before interpreting SQL checks. To test staff-authed endpoints yourself, Clerk dev instances allow scripted login: backend API sign_in_token → FAPI ticket sign-in → short-lived (~60s) session JWT as Bearer.
