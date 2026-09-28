---
name: KJIHC RBAC design
description: Role-based access control system — how roles are stored, parsed, and enforced across backend, web app, and mobile.
---

# KJIHC Staff RBAC

## Role storage

Two fields on `kjihc_staff`:
- `staff_level` — carries the superuser flag (`"1"`) and the coach's allowed age groups (e.g. `"u12,u14"`)
- `staff_roles` — comma-separated role keywords: `"coach"`, `"treasurer"`, `"registrations"` (new column, empty = no explicit role)

Backward compat: if `staffRoles` is empty but `staffLevel` contains age groups → `parseStaffRoles` infers `"coach"`. This preserves all staff set up before the roles column existed.

## parseStaffRoles()

Exported from `artifacts/api-server/src/middlewares/auth.ts`. Takes `{ staffLevel, staffRoles? }`, returns:

```typescript
{
  isSuperUser: boolean        // staffLevel === "1"
  isCoach: boolean            // isSuperUser OR roles includes "coach"
  isTreasurer: boolean        // isSuperUser OR roles includes "treasurer"
  isRegistrations: boolean    // isSuperUser OR roles includes "registrations"
  ageGroups: string[]         // coach's allowed age groups from staffLevel
  roles: string[]             // parsed staffRoles array
}
```

**Why:** All access-control decisions flow through this one function so the logic stays in one place.

## Access matrix

| Feature | Superuser | Coach | Treasurer | Registrations |
|---------|-----------|-------|-----------|---------------|
| All members | ✅ | Age groups + up/down | ✅ | ✅ |
| Fees/compliance filter | ✅ | ❌ | ✅ | ❌ |
| SIHA filter | ✅ | ❌ | ❌ | ✅ |
| Fees resend button | ✅ | ❌ | ✅ | ❌ |
| Dashboard / sign-in / attendance nav | ✅ | ✅ | ❌ | ❌ |
| Manage Staff nav | ✅ | ❌ | ❌ | ❌ |
| Housekeeping nav | ✅ | ❌ | ❌ | ❌ |

## Coach age group filtering

Members visible to coaches = their members WHERE `ageGroup IN allowedGroups` OR `addAgeGroup` (play-up/down column) contains any of `allowedGroups`. Implemented in `routes/members.ts` and `routes/dashboard.ts`.

## GET /staff/me response

Returns `staffRoles`, `isCoach`, `isTreasurer`, `isRegistrations`, `roles[]` in addition to the existing fields. Frontend reads these to drive UI visibility.

## Web app

- **StaffManage.tsx**: Redesigned form — superuser radio OR restricted radio with role checkboxes (Coach/Manager · Treasurer · Registrations). Coach checkbox reveals age-group multi-select. List view shows role badges.
- **Layout.tsx**: Fetches `useGetMyStaffProfile()` and hides nav items with `requiredRole: "coach"` or `"superuser"` from unauthorized users.
- **Players.tsx**: Derives `isTreasurer`, `isRegistrations` from profile; hides "Fees Overdue" filter from non-treasurers and "Not SIHA" from non-registrations.
</content>
</invoke>
<invoke name="Edit">
<parameter name="file_path">.agents/memory/MEMORY.md