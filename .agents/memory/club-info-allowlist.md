---
name: Public club-info settings allowlist
description: Security boundary for the kjihc_settings table
---
GET /api/join/club-info is public and previously returned every kjihc_settings row (would have leaked smtp_pass, stripe_secret_key, ms_client_secret). It now returns only keys matching bank_*/heja*/club_* plus stripe_publishable_key (settings.ts isPublicKey).
**Why:** settings table mixes public join-page info with credentials; masking exists only on the staff GET /settings route.
**How to apply:** any new secret stored in kjihc_settings must be added to the staff-route mask list and must NOT match the public allowlist prefixes.
