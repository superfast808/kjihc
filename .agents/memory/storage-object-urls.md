---
name: Storage object URL double-slash bug
description: Why attachment images silently failed to load and how object paths must be joined into URLs
---
Attachment `objectPath` values are stored with a leading slash (`/objects/uploads/<uuid>`).

**Rule:** never build the fetch URL as `/api/storage/objects/${objectPath}` — the double slash triggers a 307 redirect that drops the Authorization header, so images 401/never render. Strip leading slashes first (`objectPath.replace(/^\/+/, '')`). The API route also normalizes both `objects/...` and bare `uploads/...` forms defensively.

**Why:** discovered Aug 2026 when a noticeboard announcement photo never displayed on any client despite the upload grant and attachment rows being correct in prod.

**How to apply:** any new client surface that renders `/api/storage/objects/*` attachments must strip leading slashes, and browser `<img>` tags cannot send the parent bearer token — fetch as blob + object URL instead (see `AuthImage` in parent web MessagesSection).
