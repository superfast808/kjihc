---
name: KJIHC Mobile App
description: Durable architectural decisions and non-obvious constraints for the Expo companion app
---

## Staff API auth — register token getter before queries mount

Call `setAuthTokenGetter(() => getToken())` synchronously in the component body of the staff layout (not only in `useEffect`). Child screen query hooks mount and fire on the same render pass as the layout, so an effect-only registration arrives too late and initial requests go out without a bearer token.

**Why:** On Expo there is no browser cookie jar; every request needs an explicit Bearer token attached via the registered getter.

## Production build must forward Clerk key to Metro

`scripts/build.js` env block must include `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY`. The dev script injects it at shell level but the production Metro spawn does not inherit it automatically.

**Why:** Without this, staff sign-in silently initializes Clerk with an empty key and fails in production builds.

## Parent tokens — use SecureStore on native

Parent magic-link tokens grant access to contact and medical data. Store with `expo-secure-store` on iOS/Android (encrypted keychain/keystore). AsyncStorage is only acceptable on web where no secure keychain exists.

## Canonical age-group DB values

`Novice`, `LTP`, `u10`, `u12`, `u14`, `u16`, `u19`, `lightning`. Source of truth: `artifacts/kjihc/src/lib/ageGroups.ts`. Wrong case in filters returns zero results.
