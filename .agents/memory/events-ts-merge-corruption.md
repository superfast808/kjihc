---
name: events.ts merge corruption pattern
description: The GET /events handler in api-server/src/routes/events.ts is repeatedly broken by task-agent merges — always the same two lines.
---

# Recurring merge corruption: GET /events token block

## The rule
After ANY task-agent merge that touches `artifacts/api-server/src/routes/events.ts`, immediately verify these two lines exist inside `router.get("/events", ...)` before the `if (token)` block:

```typescript
const token = extractParentToken(req);
const requestedMemberId = memberIdStr ? parseInt(memberIdStr, 10) : null;
```

And verify the `if (token) {` block looks like:
```typescript
    if (token) {
      const email = await resolveParentToken(token);
      if (!email) { res.status(401).json({ error: "Invalid or expired token" }); return; }

      if (requestedMemberId) {
        const [child] = await db.select().from(membersTable)
          .where(and(eq(membersTable.id, requestedMemberId), eq(membersTable.playerEmail, email)));
        if (child) resolvedMemberId = requestedMemberId;
      } else {
        const [firstChild] = await db.select({ id: membersTable.id })
          .from(membersTable).where(eq(membersTable.playerEmail, email));
        if (firstChild) resolvedMemberId = firstChild.id;
      }
    }
```

## Why
Three separate task-agent merges in one session broke this same block. Symptoms:
- `ReferenceError: token is not defined` at runtime (token declaration line dropped)
- `Expected "finally" but found "const"` at build time (handler opening brace dropped)
- Both cause every events-related screen to go blank

## How to fix
Use Python (not Edit) because the file contains a Unicode em-dash in a comment that causes verbatim Edit to fail:
```python
python3 -c "
path = 'artifacts/api-server/src/routes/events.ts'
with open(path) as f: src = f.read()
# ... replace old with new ...
with open(path, 'w') as f: f.write(src)
"
```

## Corruption patterns seen
- `rawToken` substituted for `token`
- `staff.staffEmail` / `memberId` from a different route leaked in
- `const token = extractParentToken(req)` line silently dropped
- GET /events/:id/rsvp route body replaced with upsert logic from POST route
