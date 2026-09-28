---
name: Mobile prod Clerk config
description: How the Expo APK must authenticate staff against the production API (Replit-managed Clerk).
---

Replit-managed Clerk has separate dev and prod instances. The production API (join.kjihc.org) verifies sessions via `clerkMiddleware` with `publishableKeyFromHost(host, fallback)` — the live instance is proxied at `https://join.kjihc.org/api/__clerk` (proxy only active when NODE_ENV=production).

**Rule:** Any EAS build meant for live data must set in `eas.json` env:
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_live_Y2xlcmsuam9pbi5ramloYy5vcmck` (= base64 of `clerk.join.kjihc.org$`)
- `EXPO_PUBLIC_CLERK_PROXY_URL: https://join.kjihc.org/api/__clerk`

**Why:** With the dev `pk_test` key, staff sign-in "works" (dev user store — dev password) but every staff endpoint on prod returns 401, so screens render empty while public endpoints (GET /events) and token-based parent auth still work — looks like a data bug, is actually cross-instance auth.

**How to apply:** Symptom "APK shows events but no players/compliance/attendance" or "takes my dev password" → check the Clerk key/proxy in eas.json before debugging data. Compute the live key with `publishableKeyFromHost` from `@clerk/shared/keys` if the domain changes. Users must also exist in the *production* Clerk user store.
