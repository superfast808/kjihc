---
name: Age-group casing normalization
description: kjihc_members.age_group has mixed casing (u14 vs U14); all comparisons must use normAgeGroup()
---

Prod data contains mixed-case age groups ("U14" from the public join form vs "u14" in the roster, plus "LTP", "lightning", "novice"). Case-sensitive comparisons made joined players invisible to coaches and broke channel/RSVP/notification targeting.

**Rule:** never compare `age_group` values with `===`/`eq()`/`includes()` directly. Use `normAgeGroup()` from `middlewares/auth.ts` in JS, or `lower(...)` on both sides in SQL. `parseStaffRoles` already lowercases staff age groups — so any raw comparison against them is a bug.

**Why:** join form saved "U14" while staff levels used "u14"; new member didn't appear on the roster for coaches (Aug 2026).

Also: fee/SIHA flags route is per-field authorized — treasurer→feesOverdue, registrations→sihaRegistered, superuser→both. Coaches get 403 by design.
