---
name: Parent OAuth login
description: Architecture of the Google/Apple OAuth sign-in flow for parents
---

# Parent OAuth login

## Architecture
- **Mobile**: `expo-auth-session/providers/google` for Google (PKCE flow, returns `authentication.idToken`); `expo-apple-authentication` for Apple (iOS-only native button, returns `credential.identityToken`). Apple button guarded by `Platform.OS === 'ios'`.
- **API route**: `POST /parent/oauth-login` in `artifacts/api-server/src/routes/parent.ts`. Accepts `{ provider: 'google' | 'apple', idToken: string }`.
- **Google verification**: `google-auth-library` `OAuth2Client.verifyIdToken()`; audience check only when `GOOGLE_CLIENT_ID` env var is set.
- **Apple verification**: `jose` `jwtVerify()` against `https://appleid.apple.com/auth/keys`; issuer `https://appleid.apple.com`; audience check only when `APPLE_APP_ID` env var is set.
- **Session**: issues a 30-day `parentTokensTable` token (vs 10-min for magic links); returns `{ email, token, children }`.

## Required env vars (not yet configured)
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID` — Android/web client ID (mobile)
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` — iOS client ID (mobile)
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` — Android client ID (mobile)
- `GOOGLE_CLIENT_ID` — server audience verification
- `APPLE_APP_ID` — server audience verification (optional)

**Why:** Without `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, `Google.useAuthRequest` returns `null` for the request and the button shows an error. The server still verifies token signatures without the env vars, just skips audience checking.
