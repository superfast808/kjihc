import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db, eventsTable, eventRosterTable, eventRsvpTable, membersTable, parentTokensTable, parentDevicesTable, staffTable, signinsTable } from "@workspace/db";
import { eq, and, gt, inArray, asc, sql, ne, isNotNull } from "drizzle-orm";
import { requireStaff, parseStaffRoles , normAgeGroup } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { sendExpoPushNotifications } from "../lib/expoPush";
import { sendWebPushToEmail } from "../lib/webPush";

const router = Router();

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

async function getRsvpCounts(eventId: number) {
  const rows = await db.select().from(eventRsvpTable).where(eq(eventRsvpTable.eventId, eventId));
  return {
    yes:   rows.filter(r => r.status === "yes").length,
    no:    rows.filter(r => r.status === "no").length,
    maybe: rows.filter(r => r.status === "maybe").length,
  };
}

async function resolveParentToken(token: string): Promise<string | null> {
  const now = new Date();
  const [row] = await db.select().from(parentTokensTable)
    .where(and(eq(parentTokensTable.token, token), gt(parentTokensTable.expiresAt, now)));
  return row?.email ?? null;
}

// Resolves the staff record for a Clerk-authenticated caller, mirroring the
// two-step lookup in requireStaff (clerkUserId → email fallback → link).
async function resolveStaffFromClerk(userId: string): Promise<typeof staffTable.$inferSelect | null> {
  // Fast path: already linked
  let rows = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, userId));
  if (rows[0]) return rows[0];

  // Slow path: resolve via Clerk email and link for next time
  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    if (!email) return null;

    rows = await db.select().from(staffTable).where(eq(staffTable.staffEmail, email));
    const staff = rows[0] ?? null;
    if (staff) {
      await db.update(staffTable).set({ clerkUserId: userId }).where(eq(staffTable.id, staff.id));
    }
    return staff;
  } catch {
    return null;
  }
}

// Reads the parent token from Authorization: Bearer <token> header first,
// then falls back to query string or body for backward compatibility.
function extractParentToken(req: import("express").Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const t = auth.slice(7);
    // Clerk JWTs start with eyJ — they are not parent magic-link tokens; ignore them.
    if (t.startsWith("eyJ")) return null;
    return t;
  }
  const fromQuery = typeof req.query.token === "string" ? req.query.token : null;
  const fromBody = typeof req.body?.token === "string" ? req.body.token : null;
  return fromQuery ?? fromBody ?? null;
}

// ─── Age-group access helper ──────────────────────────────────────────────────
// Returns the coach's permitted age groups when the caller is a restricted
// coach, or null when the caller is unrestricted (superuser / treasurer /
// registrations) or not a staff member.
async function getCoachAgeGroups(req: import("express").Request): Promise<string[] | null> {
  const clerkAuth = getAuth(req);
  if (!clerkAuth?.userId) return null;
  const staff = await resolveStaffFromClerk(clerkAuth.userId);
  if (!staff) return null;
  const { isSuperUser, isTreasurer, isRegistrations, ageGroups } = parseStaffRoles(staff);
  if (!isSuperUser && !isTreasurer && !isRegistrations && ageGroups.length > 0) {
    return ageGroups;
  }
  return null;
}

// Returns true when the event is visible to the given coach age groups.
// Club-wide events (no ageGroups set) are always visible.
function coachCanAccessEvent(
  event: { ageGroups: string | null },
  coachAgeGroups: string[],
): boolean {
  if (!event.ageGroups || event.ageGroups === "") return true;
  const eventGroups = event.ageGroups.split(",").map((g) => normAgeGroup(g));
  return coachAgeGroups.some((g) => eventGroups.includes(normAgeGroup(g)));
}

// ─── GET /events (public — lists events with RSVP counts) ────────────────────

router.get("/events", async (req, res): Promise<void> => {
  try {
    const { ageGroup, type, upcoming, memberId: memberIdStr } = req.query as Record<string, string>;
    const token = extractParentToken(req);
    const requestedMemberId = memberIdStr ? parseInt(memberIdStr, 10) : null;

    // Determine if a coach is calling and, if so, which age groups they can see.
    // Superusers, treasurers, and registrations staff are never restricted.
    let coachAgeGroups: string[] | null = null;
    const clerkAuth = getAuth(req);
    if (clerkAuth?.userId) {
      const staff = await resolveStaffFromClerk(clerkAuth.userId);
      if (staff) {
        const { isSuperUser, isTreasurer, isRegistrations, ageGroups } = parseStaffRoles(staff);
        if (!isSuperUser && !isTreasurer && !isRegistrations && ageGroups.length > 0) {
          coachAgeGroups = ageGroups;
        }
      }
    }

    let allEvents = await db.select().from(eventsTable)
      .orderBy(asc(eventsTable.eventDate), asc(eventsTable.startTime));

    // Staff see active + suggested (so they can review); parents/public see only active
    const isStaffCaller = !!clerkAuth?.userId;
    allEvents = allEvents.filter(e => isStaffCaller ? e.status !== "dismissed" : e.status === "active");

    if (type) allEvents = allEvents.filter(e => e.eventType === type);

    if (coachAgeGroups && coachAgeGroups.length > 0) {
      // Coach is restricted to their assigned age groups.
      // If the caller also supplied an explicit ?ageGroup= param, honour it only when
      // it is within their permitted set — preventing cross-group bypass.
      if (ageGroup) {
        if (!coachAgeGroups.map(g => normAgeGroup(g)).includes(normAgeGroup(ageGroup))) {
          // Requested group is outside the coach's scope — reject explicitly.
          res.status(403).json({ error: "You do not have access to that age group" });
          return;
        }
        // Permitted — apply the single-group filter as normal.
        allEvents = allEvents.filter(e => {
          if (!e.ageGroups || e.ageGroups === "") return true;
          return e.ageGroups.split(",").map(g => normAgeGroup(g)).includes(normAgeGroup(ageGroup));
        });
      } else {
        // No explicit filter — restrict to all the coach's assigned groups.
        // Events with no age groups set are club-wide and remain visible.
        allEvents = allEvents.filter(e => {
          if (!e.ageGroups || e.ageGroups === "") return true;
          const eventGroups = e.ageGroups.split(",").map(g => normAgeGroup(g));
          return coachAgeGroups!.some(g => eventGroups.includes(normAgeGroup(g)));
        });
      }
    } else if (ageGroup) {
      // Unrestricted caller (or not a staff member) with an explicit filter.
      allEvents = allEvents.filter(e => {
        if (!e.ageGroups || e.ageGroups === "") return true;
        return e.ageGroups.split(",").map(g => normAgeGroup(g)).includes(normAgeGroup(ageGroup));
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (upcoming === "true")       allEvents = allEvents.filter(e => e.eventDate >= today);
    else if (upcoming === "false") allEvents = allEvents.filter(e => e.eventDate < today);

    // Resolve which single memberId to use for myRsvp (validated once, not per event)
    let resolvedMemberId: number | null = null;
    if (token) {
      const email = await resolveParentToken(token);
      if (!email) { res.status(401).json({ error: "Invalid or expired token" }); return; }

      if (requestedMemberId) {
        // Verify the requested child belongs to this parent
        const [child] = await db.select().from(membersTable)
          .where(and(eq(membersTable.id, requestedMemberId), sql`lower(${membersTable.playerEmail}) = lower(${email})`));
        if (child) resolvedMemberId = requestedMemberId;
      } else {
        // Backward-compat: no memberId — use the first child of the parent
        const [firstChild] = await db.select({ id: membersTable.id })
          .from(membersTable).where(sql`lower(${membersTable.playerEmail}) = lower(${email})`);
        if (firstChild) resolvedMemberId = firstChild.id;
      }
    }

    // Attach counts + the resolved child's RSVP status and absence reason (no other member PII)
    const result = await Promise.all(allEvents.map(async (e) => {
      const counts = await getRsvpCounts(e.id);
      let myRsvp: string | null = null;
      let myRsvpReason: string | null = null;
      if (resolvedMemberId) {
        const [rsvpRow] = await db.select({ status: eventRsvpTable.status, reason: eventRsvpTable.reason })
          .from(eventRsvpTable)
          .where(and(eq(eventRsvpTable.eventId, e.id), eq(eventRsvpTable.memberId, resolvedMemberId)));
        myRsvp = rsvpRow?.status ?? null;
        myRsvpReason = (myRsvp === "no" ? (rsvpRow?.reason ?? null) : null);
      }
      return { ...e, rsvpCounts: counts, myRsvp, myRsvpReason };
    }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error listing events");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET single event (public — counts + roster IDs, no PII names) ────────────
// Staff wanting full RSVP detail with names should use GET /events/:id/rsvp

router.get("/events/:id", async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    // Restrict coaches to their own age groups
    const coachAgeGroups = await getCoachAgeGroups(req);
    if (coachAgeGroups && !coachCanAccessEvent(event, coachAgeGroups)) {
      res.status(403).json({ error: "You do not have access to this event" });
      return;
    }

    const rsvpRows = await db.select().from(eventRsvpTable).where(eq(eventRsvpTable.eventId, id));
    const counts = {
      yes:   rsvpRows.filter(r => r.status === "yes").length,
      no:    rsvpRows.filter(r => r.status === "no").length,
      maybe: rsvpRows.filter(r => r.status === "maybe").length,
    };

    const rosterRows = await db.select({ memberId: eventRosterTable.memberId })
      .from(eventRosterTable).where(eq(eventRosterTable.eventId, id));
    const rosterMemberIds = rosterRows.map(r => r.memberId);

    // rsvpList is not returned here — use GET /events/:id/rsvp (staff-only) for names
    res.json({ ...event, rsvpCounts: counts, rosterMemberIds, rsvpList: [] });
  } catch (err) {
    req.log.error({ err }, "Error getting event");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Push notification helper (used by CREATE) ────────────────────────────────

/**
 * Shared audience-resolution + send core for event-related parent pushes.
 * Resolves parent emails from membersTable by the event's ageGroups
 * (club-wide events with no age groups target all members), then delivers
 * Expo pushes to their registered devices and web pushes per email.
 *
 * Exported so both the "new event" notifier and the reminder scheduler
 * reuse identical audience + delivery logic.
 */
export async function notifyEventParents(
  event: typeof eventsTable.$inferSelect,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  webPushOverrides?: { title?: string; tag?: string },
): Promise<void> {
  const targetGroups = event.ageGroups
    ? event.ageGroups.split(",").map((g) => g.trim()).filter(Boolean)
    : [];

  let parentEmails: string[];
  if (targetGroups.length === 0) {
    const rows = await db
      .selectDistinct({ email: membersTable.playerEmail })
      .from(membersTable)
      .where(sql`${membersTable.playerEmail} <> ''`);
    parentEmails = rows.map((r) => r.email.toLowerCase());
  } else {
    const rows = await db
      .selectDistinct({ email: membersTable.playerEmail })
      .from(membersTable)
      .where(and(
        sql`${membersTable.playerEmail} <> ''`,
        sql`lower(${membersTable.ageGroup}) IN (${sql.join(targetGroups.map(g => sql`${normAgeGroup(g)}`), sql`, `)})`,
      ));
    parentEmails = rows.map((r) => r.email.toLowerCase());
  }

  if (parentEmails.length === 0) return;

  const devices = await db
    .select({ expoPushToken: parentDevicesTable.expoPushToken })
    .from(parentDevicesTable)
    .where(inArray(parentDevicesTable.email, parentEmails));

  if (devices.length > 0) {
    const messages = devices.map((d) => ({
      to: d.expoPushToken,
      title,
      body,
      data: data ?? { eventId: event.id },
      sound: "default" as const,
    }));
    await sendExpoPushNotifications(messages);
  }

  // Web push to parents with browser subscriptions
  await Promise.allSettled(
    parentEmails.map(email =>
      sendWebPushToEmail(email, {
        title: webPushOverrides?.title ?? title,
        body,
        tag: webPushOverrides?.tag ?? `event-${event.id}`,
      })
    )
  );
}

async function notifyParentsNewEvent(event: typeof eventsTable.$inferSelect): Promise<void> {
  const typeLabel = event.eventType === "game" ? "Game" : "Training";
  await notifyEventParents(
    event,
    `New ${typeLabel} Added`,
    `${event.title} — ${event.eventDate}`,
    { eventId: event.id },
    { title: `📅 New ${typeLabel} Added`, tag: `event-${event.id}` },
  );
}

// ─── CREATE event (staff) ─────────────────────────────────────────────────────

router.post("/events", requireStaff, async (req, res): Promise<void> => {
  try {
    const staff = (req as any).staffMember;
    const {
      title, eventType, eventDate, startTime, endTime,
      locationName, locationLat, locationLng,
      meetOffsetMins, ageGroups, notes, isRosterRestricted, costPence,
    } = req.body;

    if (!title || !eventDate || !startTime) {
      res.status(400).json({ error: "title, eventDate and startTime are required" });
      return;
    }

    const [created] = await db.insert(eventsTable).values({
      title,
      eventType: eventType ?? "training",
      eventDate,
      startTime,
      endTime: endTime ?? null,
      locationName: locationName ?? "",
      locationLat: locationLat ?? null,
      locationLng: locationLng ?? null,
      meetOffsetMins: meetOffsetMins ?? 60,
      ageGroups: ageGroups ?? "",
      notes: notes ?? null,
      isRosterRestricted: isRosterRestricted ?? 0,
      costPence: costPence ?? null,
      createdByStaffId: staff.id,
    }).returning();

    // Fire-and-forget push notifications to parents
    notifyParentsNewEvent(created).catch(() => {});

    logAudit(req, "event.create", {
      entityType: "event", entityId: created.id, entityName: created.title,
      details: { eventType: created.eventType, eventDate: created.eventDate, ageGroups: created.ageGroups },
    });

    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Error creating event");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── UPDATE event (staff) ─────────────────────────────────────────────────────

router.patch("/events/:id", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const {
      title, eventType, eventDate, startTime, endTime,
      locationName, locationLat, locationLng,
      meetOffsetMins, ageGroups, notes, isRosterRestricted, costPence,
    } = req.body;

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title              !== undefined) updates.title              = title;
    if (eventType          !== undefined) updates.eventType          = eventType;
    if (eventDate          !== undefined) updates.eventDate          = eventDate;
    if (startTime          !== undefined) updates.startTime          = startTime;
    if (endTime            !== undefined) updates.endTime            = endTime;
    if (locationName       !== undefined) updates.locationName       = locationName;
    if (locationLat        !== undefined) updates.locationLat        = locationLat;
    if (locationLng        !== undefined) updates.locationLng        = locationLng;
    if (meetOffsetMins     !== undefined) updates.meetOffsetMins     = meetOffsetMins;
    if (ageGroups          !== undefined) updates.ageGroups          = ageGroups;
    if (notes              !== undefined) updates.notes              = notes;
    if (isRosterRestricted !== undefined) updates.isRosterRestricted = isRosterRestricted;
    if (costPence          !== undefined) updates.costPence          = costPence;

    const [updated] = await db.update(eventsTable).set(updates).where(eq(eventsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Event not found" }); return; }

    logAudit(req, "event.edit", {
      entityType: "event", entityId: updated.id, entityName: updated.title,
      details: Object.fromEntries(Object.entries(updates).filter(([k]) => k !== "updatedAt")) as Record<string, unknown>,
    });

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating event");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE event (staff) ─────────────────────────────────────────────────────

router.delete("/events/:id", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [dying] = await db.select({ title: eventsTable.title }).from(eventsTable).where(eq(eventsTable.id, id));
    await db.delete(eventsTable).where(eq(eventsTable.id, id));
    logAudit(req, "event.delete", { entityType: "event", entityId: id, entityName: dying?.title });
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err }, "Error deleting event");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── SYNC SNL fixtures from kjihc.org (staff) ────────────────────────────────

router.post("/events/sync-snl", requireStaff, async (req, res): Promise<void> => {
  try {
    const resp = await fetch("https://kjihc.org/api/feed/fixtures");
    if (!resp.ok) throw new Error(`kjihc.org returned ${resp.status}`);
    const { fixtures } = await resp.json() as { fixtures: any[] };

    // Find all snl_fixture_ids already in the database (any status, including dismissed)
    const existing = await db
      .select({ snlFixtureId: eventsTable.snlFixtureId })
      .from(eventsTable)
      .where(isNotNull(eventsTable.snlFixtureId));
    const existingIds = new Set(existing.map(e => e.snlFixtureId));

    // Only import upcoming fixtures we haven't seen before
    const toImport = (fixtures as any[]).filter(
      (f: any) => f.status === "Upcoming" && !existingIds.has(f.id)
    );

    for (const f of toImport) {
      const d = new Date(f.gameDate);
      const eventDate = d.toISOString().slice(0, 10);
      const startTime = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
      const homeAway = f.isHome ? "Home" : "Away";
      const title = `SNL ${homeAway}: Kilmarnock Thunder vs ${f.opponent}`;
      const notes = f.isHome
        ? `${f.competition} home game`
        : `${f.competition} away game at ${f.location}`;

      await db.insert(eventsTable).values({
        title,
        eventType: "game",
        eventDate,
        startTime,
        locationName: f.location ?? "",
        ageGroups: "",        // whole club
        notes,
        isRosterRestricted: 0,
        meetOffsetMins: 60,
        status: "suggested",
        snlFixtureId: f.id,
      });
    }

    res.json({ imported: toImport.length, total: fixtures.length });
  } catch (err) {
    req.log.error({ err }, "Error syncing SNL fixtures");
    res.status(500).json({ error: "Failed to sync fixtures from kjihc.org" });
  }
});

// ─── APPROVE suggested event → active (staff, no notifications) ───────────────

router.post("/events/:id/approve", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [updated] = await db
      .update(eventsTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(and(eq(eventsTable.id, id), ne(eventsTable.status, "active")))
      .returning();
    if (!updated) { res.status(404).json({ error: "Event not found or already active" }); return; }
    // Notify parents now that the event is live on the calendar
    notifyParentsNewEvent(updated).catch(() => {});
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error approving event");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DISMISS suggested event (staff) ─────────────────────────────────────────

router.post("/events/:id/dismiss", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const [updated] = await db
      .update(eventsTable)
      .set({ status: "dismissed", updatedAt: new Date() })
      .where(eq(eventsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Event not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error dismissing event");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── ROSTER: GET (staff only) ─────────────────────────────────────────────────

router.get("/events/:id/roster", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    // Restrict coaches to their own age groups
    const staffMember = (req as any).staffMember;
    const { isSuperUser, isTreasurer, isRegistrations, ageGroups } = parseStaffRoles(staffMember);
    if (!isSuperUser && !isTreasurer && !isRegistrations && ageGroups.length > 0) {
      const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
      if (!event) { res.status(404).json({ error: "Event not found" }); return; }
      if (!coachCanAccessEvent(event, ageGroups)) {
        res.status(403).json({ error: "You do not have access to this event" });
        return;
      }
    }

    const rows = await db.select({
      memberId: eventRsvpTable.memberId,
      status: eventRsvpTable.status,
      playerName: membersTable.playerName,
      playerParent: membersTable.playerParent,
    }).from(eventRsvpTable)
      .innerJoin(membersTable, eq(eventRsvpTable.memberId, membersTable.id))
      .where(eq(eventRsvpTable.eventId, id))
      .orderBy(asc(membersTable.playerName));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error getting roster");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── ROSTER: PUT — atomic replace with validation (staff only) ────────────────

router.put("/events/:id/roster", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));

    const rsvpRows = await db.select().from(eventRsvpTable).where(eq(eventRsvpTable.eventId, id));
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const { memberIds } = req.body as { memberIds: number[] };
    if (!Array.isArray(memberIds)) { res.status(400).json({ error: "memberIds must be an array" }); return; }

    const uniqueIds = [...new Set(memberIds.filter(n => typeof n === "number" && Number.isFinite(n)))];

    // Validate all submitted IDs are real members
    if (uniqueIds.length > 0) {
      const found = await db.select({ id: membersTable.id })
        .from(membersTable).where(inArray(membersTable.id, uniqueIds));
      if (found.length !== uniqueIds.length) {
        res.status(400).json({ error: "One or more member IDs do not exist" }); return;
      }
    }

    // Atomic replace inside a transaction
    await db.transaction(async (tx) => {
      await tx.delete(eventRosterTable).where(eq(eventRosterTable.eventId, id));
      if (uniqueIds.length > 0) {
        await tx.insert(eventRosterTable).values(uniqueIds.map(mid => ({ eventId: id, memberId: mid })));
      }
    });

    res.json({ ok: true, count: uniqueIds.length });
  } catch (err) {
    req.log.error({ err }, "Error updating roster");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Staff-as-parent: children lookup ────────────────────────────────────────
// Returns the members whose playerEmail matches the authenticated staff member's
// email address, so the web app can offer RSVP buttons to staff who are parents.

router.get("/staff/me/children", requireStaff, async (req, res): Promise<void> => {
  try {
    const staff = (req as any).staffMember;
    const children = await db.select({
      id: membersTable.id,
      playerName: membersTable.playerName,
      ageGroup: membersTable.ageGroup,
      addAgeGroup: membersTable.addAgeGroup,
    }).from(membersTable).where(sql`lower(${membersTable.playerEmail}) = lower(${staff.staffEmail})`);
    res.json(children);
  } catch (err) {
    req.log.error({ err }, "Error fetching staff children");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Staff-as-parent: RSVP status map ────────────────────────────────────────
// Returns { [eventId]: status } for all events where any of the staff member's
// children have submitted an RSVP.  Used to show the current status on event
// cards without an extra per-event request.

router.get("/staff/me/rsvps", requireStaff, async (req, res): Promise<void> => {
  try {
    const staff = (req as any).staffMember;
    const children = await db.select({ id: membersTable.id })
      .from(membersTable).where(sql`lower(${membersTable.playerEmail}) = lower(${staff.staffEmail})`);

    if (children.length === 0) { res.json({}); return; }

    const childIds = children.map(c => c.id);
    const rsvpRows = await db.select({
      eventId: eventRsvpTable.eventId,
      memberId: eventRsvpTable.memberId,
      status:   eventRsvpTable.status,
    }).from(eventRsvpTable).where(inArray(eventRsvpTable.memberId, childIds));

    // Collapse to { [eventId]: status } — first child hit wins when there are
    // multiple children (edge case; families with one child is the common case).
    const map: Record<number, string> = {};
    for (const row of rsvpRows) {
      if (!(row.eventId in map)) map[row.eventId] = row.status;
    }
    res.json(map);
  } catch (err) {
    req.log.error({ err }, "Error fetching staff RSVP map");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── RSVP: GET summary — staff only (contains names/PII) ─────────────────────

router.get("/events/:id/rsvp", async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    // Dual auth: Clerk staff get the full summary; parents with a valid
    // magic-link token get a sanitized list (names + status only, no PII).
    let staffMember: typeof staffTable.$inferSelect | null = null;
    const clerkAuth = getAuth(req);
    if (clerkAuth?.userId) staffMember = await resolveStaffFromClerk(clerkAuth.userId);

    if (!staffMember) {
      const token = extractParentToken(req);
      const parentEmail = token ? await resolveParentToken(token) : null;
      if (!parentEmail) { res.status(401).json({ error: "Unauthorized" }); return; }

      // Only expose responses for events the parent can already see in their
      // own event list: active events that are club-wide or match one of
      // their children's age groups.
      const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
      if (!event || event.status !== "active") { res.status(404).json({ error: "Event not found" }); return; }
      if (event.ageGroups && event.ageGroups !== "") {
        const children = await db.select({ ageGroup: membersTable.ageGroup })
          .from(membersTable).where(sql`lower(${membersTable.playerEmail}) = lower(${parentEmail})`);
        const eventGroups = event.ageGroups.split(",").map(g => normAgeGroup(g));
        const allowed = children.some(c => c.ageGroup && eventGroups.includes(normAgeGroup(c.ageGroup)));
        if (!allowed) { res.status(403).json({ error: "You do not have access to this event" }); return; }
      }

      const rows = await db.select({
        status:   eventRsvpTable.status,
        playerName: membersTable.playerName,
      }).from(eventRsvpTable)
        .innerJoin(membersTable, eq(eventRsvpTable.memberId, membersTable.id))
        .where(eq(eventRsvpTable.eventId, id))
        .orderBy(asc(membersTable.playerName));

      const counts = {
        yes:   rows.filter(r => r.status === "yes").length,
        no:    rows.filter(r => r.status === "no").length,
        maybe: rows.filter(r => r.status === "maybe").length,
      };
      res.json({ counts, responses: rows });
      return;
    }

    const { isSuperUser, isTreasurer, isRegistrations, ageGroups } = parseStaffRoles(staffMember);
    if (!isSuperUser && !isTreasurer && !isRegistrations && ageGroups.length > 0) {
      const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
      if (!event) { res.status(404).json({ error: "Event not found" }); return; }
      if (!coachCanAccessEvent(event, ageGroups)) {
        res.status(403).json({ error: "You do not have access to this event" });
        return;
      }
    }

    const rows = await db.select({
      memberId: eventRsvpTable.memberId,
      status:   eventRsvpTable.status,
      reason:   eventRsvpTable.reason,
      playerName:    membersTable.playerName,
      playerParent:  membersTable.playerParent,
      feesOverdue:   membersTable.feesOverdue,
      sihaRegistered: membersTable.sihaRegistered,
    }).from(eventRsvpTable)
      .innerJoin(membersTable, eq(eventRsvpTable.memberId, membersTable.id))
      .where(eq(eventRsvpTable.eventId, id))
      .orderBy(asc(membersTable.playerName));

    const counts = {
      yes:   rows.filter(r => r.status === "yes").length,
      no:    rows.filter(r => r.status === "no").length,
      maybe: rows.filter(r => r.status === "maybe").length,
    };

    res.json({ counts, responses: rows });
  } catch (err) {
    req.log.error({ err }, "Error getting RSVPs");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── RSVP: POST — staff-as-parent (Clerk auth) ───────────────────────────────
// Lets a staff member who is also a registered parent RSVP for their child
// without needing a separate parent magic-link session.

router.post("/events/:id/staff-rsvp", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { memberId, status, reason } = req.body as { memberId: number; status: string; reason?: string };
    if (!memberId || !status) {
      res.status(400).json({ error: "memberId and status are required" }); return;
    }
    if (!["yes", "no", "maybe"].includes(status)) {
      res.status(400).json({ error: "status must be yes, no or maybe" }); return;
    }

    await db.insert(eventRsvpTable)
      .values({ eventId: id, memberId, status, reason: reason ?? null })
      .onConflictDoUpdate({
        target: [eventRsvpTable.eventId, eventRsvpTable.memberId],
        set: { status, reason: reason ?? null },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error saving staff RSVP");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── RSVP: POST — parent token auth with eligibility check ───────────────────

router.post("/events/:id/rsvp", async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const rawToken = extractParentToken(req);
    const { memberId, status } = req.body as { memberId: number; status: string };
    if (!rawToken || !memberId || !status) {
      res.status(400).json({ error: "token (via Authorization header), memberId and status are required" }); return;
    }
    if (!["yes", "no", "maybe"].includes(status)) {
      res.status(400).json({ error: "status must be yes, no or maybe" }); return;
    }

    // 1. Verify token
    const email = await resolveParentToken(rawToken);
    if (!email) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    // 2. Verify child belongs to this parent
    const [child] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, memberId), sql`lower(${membersTable.playerEmail}) = lower(${email})`));
    if (!child) { res.status(403).json({ error: "Member not found or does not belong to this parent account" }); return; }

    // Verify event exists
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));

    const rsvpRows = await db.select().from(eventRsvpTable).where(eq(eventRsvpTable.eventId, id));
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    // Enforce eligibility
    if (event.isRosterRestricted === 1) {
      const [rosterEntry] = await db.select().from(eventRosterTable)
        .where(and(eq(eventRosterTable.eventId, id), eq(eventRosterTable.memberId, memberId)));
      if (!rosterEntry) {
        res.status(403).json({ error: "This player is not on the selected roster for this event" }); return;
      }
    } else if (event.ageGroups) {
      const allowed = event.ageGroups.split(",").map(g => normAgeGroup(g)).filter(Boolean);
      if (allowed.length > 0) {
        const childGroups = [child.ageGroup, ...(child.addAgeGroup ? child.addAgeGroup.split(",").map(g => g.trim()) : [])].map(g => normAgeGroup(g));
        if (!childGroups.some(g => allowed.includes(g))) {
          res.status(403).json({ error: "This event is not open to this player's age group" }); return;
        }
      }
    }

    await db.execute(sql`
      INSERT INTO kjihc_event_rsvp (event_id, member_id, status, updated_at)
      VALUES (${id}, ${memberId}, ${status}, NOW())
      ON CONFLICT (event_id, member_id)
      DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
    `);

    res.json({ ok: true, status });
  } catch (err) {
    req.log.error({ err }, "Error setting staff RSVP");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /events/:id/attendance ────────────────────────────────────────────────
// Returns the sign-in register rows linked to this event

router.get("/events/:id/attendance", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const rows = await db
      .select({
        memberId:   signinsTable.memberId,
        missReason: signinsTable.missReason,
        playerName: membersTable.playerName,
        ageGroup:   membersTable.ageGroup,
      })
      .from(signinsTable)
      .innerJoin(membersTable, eq(signinsTable.memberId, membersTable.id))
      .where(eq(signinsTable.eventId, id))
      .orderBy(asc(membersTable.playerName));

    const present = rows.filter(r => r.missReason === null);
    const absent  = rows.filter(r => r.missReason !== null);

    res.json({
      present,
      absent,
      presentCount: present.length,
      total: rows.length,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting event attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
