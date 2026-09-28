---
name: Stripe return-URL pattern
description: How checkout return URLs are validated and how mobile returns to the app after payment
---
- All Stripe checkout endpoints (event payments + club fees) validate successUrl/cancelUrl via `isAllowedReturnUrl` in eventPayments.ts (allowed hosts: join.kjihc.org, REPLIT_DEV_DOMAIN/REPLIT_DOMAINS, localhost). Any new checkout endpoint must reuse it.
**Why:** caller-supplied return URLs are an open-redirect vector on a paid checkout.
- Mobile flow: successUrl = `<base>/api/pay-return?status=success`, which 302s to `kjihc-mobile://paid?...`; app opens checkout with `WebBrowser.openAuthSessionAsync(url, 'kjihc-mobile://paid')` and shows a thank-you Alert.
- Webhook records the payment asynchronously — clients must poll their payment refetch (~0/2/5/10s) after a success return; a single immediate refetch often still shows unpaid.
- Parent photo uploads bind minted object paths via kjihc_upload_grants; confirm requires an unconsumed, unexpired grant for that parent email. Reuse for any new parent-facing upload.
- Staff paying as a parent: event-payment POSTs accept Clerk staff whose staffEmail matches the child's playerEmail (resolvePayerEmail).
