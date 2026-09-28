import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, eventsTable, eventPaymentsTable, membersTable, parentTokensTable, staffTable } from "@workspace/db";
import { eq, and, gt, asc, sql } from "drizzle-orm";
import { parseStaffRoles, normAgeGroup } from "../middlewares/auth";

const router = Router();

// Handling fee added when a parent pays an event cost by card (pence)
export const EVENT_PAYMENT_HANDLING_PENCE = 10;

function parseId(raw: string | string[]): number {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(s, 10);
}

function extractParentToken(req: import("express").Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

async function resolveParentEmail(token: string): Promise<string | null> {
  const now = new Date();
  const [row] = await db.select().from(parentTokensTable)
    .where(and(eq(parentTokensTable.token, token), gt(parentTokensTable.expiresAt, now)));
  return row?.email ?? null;
}

async function resolveStaff(req: import("express").Request): Promise<typeof staffTable.$inferSelect | null> {
  const clerkAuth = getAuth(req);
  if (!clerkAuth?.userId) return null;
  const [byClerk] = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, clerkAuth.userId));
  return byClerk ?? null;
}

// Child is eligible to pay only if the event is club-wide or matches one of
// their age groups (primary or additional training groups)
function childEligibleForEvent(event: { ageGroups: string }, child: { ageGroup: string | null; addAgeGroup?: string | null }): boolean {
  if (!event.ageGroups || event.ageGroups === "") return true;
  const eventGroups = event.ageGroups.split(",").map(g => normAgeGroup(g));
  const childGroups = [child.ageGroup, ...(child.addAgeGroup ? child.addAgeGroup.split(",") : [])]
    .filter((g): g is string => !!g)
    .map(g => normAgeGroup(g));
  return childGroups.some(g => eventGroups.includes(g));
}

// Only allow Stripe to redirect back to our own web app or API pay-return.
export function isAllowedReturnUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    const allowedHosts = new Set<string>(["join.kjihc.org", "localhost", "127.0.0.1"]);
    if (process.env.REPLIT_DEV_DOMAIN) allowedHosts.add(process.env.REPLIT_DEV_DOMAIN.toLowerCase());
    for (const d of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
      if (d.trim()) allowedHosts.add(d.trim().toLowerCase());
    }
    return allowedHosts.has(host);
  } catch {
    return false;
  }
}

// Resolves who is paying: a parent token, or a signed-in staff member acting
// as a parent (their staff email must match the child's parent email).
async function resolvePayerEmail(req: import("express").Request): Promise<string | null> {
  const token = extractParentToken(req);
  if (token) {
    const email = await resolveParentEmail(token);
    if (email) return email;
  }
  const staffMember = await resolveStaff(req);
  return staffMember?.staffEmail ?? null;
}

// Verifies the parent owns this child (case-insensitive email match)
async function parentOwnsChild(email: string, memberId: number) {
  const [child] = await db.select().from(membersTable)
    .where(and(eq(membersTable.id, memberId), sql`lower(${membersTable.playerEmail}) = lower(${email})`));
  return child ?? null;
}

// ─── GET /events/:id/payments ────────────────────────────────────────────────
// Staff: full list of who has paid (names, method, when).
// Parents: only rows for their own children.
router.get("/events/:id/payments", async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }

    const staffMember = await resolveStaff(req);

    if (!staffMember) {
      const token = extractParentToken(req);
      const parentEmail = token ? await resolveParentEmail(token) : null;
      if (!parentEmail) { res.status(401).json({ error: "Unauthorized" }); return; }

      const rows = await db.select({
        memberId: eventPaymentsTable.memberId,
        method: eventPaymentsTable.method,
        amountPence: eventPaymentsTable.amountPence,
        createdAt: eventPaymentsTable.createdAt,
      }).from(eventPaymentsTable)
        .innerJoin(membersTable, eq(eventPaymentsTable.memberId, membersTable.id))
        .where(and(
          eq(eventPaymentsTable.eventId, id),
          sql`lower(${membersTable.playerEmail}) = lower(${parentEmail})`,
        ));
      res.json({ costPence: event.costPence ?? 0, payments: rows });
      return;
    }

    // Coaches limited to their own age groups (superuser/treasurer/registrations see all)
    const { isSuperUser, isTreasurer, isRegistrations, ageGroups } = parseStaffRoles(staffMember);
    if (!isSuperUser && !isTreasurer && !isRegistrations && ageGroups.length > 0 && event.ageGroups) {
      const eventGroups = event.ageGroups.split(",").map(g => normAgeGroup(g));
      if (!ageGroups.some(g => eventGroups.includes(normAgeGroup(g)))) {
        res.status(403).json({ error: "You do not have access to this event" });
        return;
      }
    }

    const rows = await db.select({
      memberId: eventPaymentsTable.memberId,
      playerName: membersTable.playerName,
      method: eventPaymentsTable.method,
      amountPence: eventPaymentsTable.amountPence,
      createdAt: eventPaymentsTable.createdAt,
    }).from(eventPaymentsTable)
      .innerJoin(membersTable, eq(eventPaymentsTable.memberId, membersTable.id))
      .where(eq(eventPaymentsTable.eventId, id))
      .orderBy(asc(membersTable.playerName));

    res.json({ costPence: event.costPence ?? 0, payments: rows });
  } catch (err) {
    req.log.error({ err }, "Error fetching event payments");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /events/:id/payments/mark-paid ─────────────────────────────────────
// Parent marks their child's event cost as paid by bank transfer.
router.post("/events/:id/payments/mark-paid", async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const parentEmail = await resolvePayerEmail(req);
    if (!parentEmail) { res.status(401).json({ error: "Unauthorized" }); return; }

    const memberId = parseInt(String(req.body?.memberId), 10);
    if (isNaN(memberId)) { res.status(400).json({ error: "memberId required" }); return; }

    const child = await parentOwnsChild(parentEmail, memberId);
    if (!child) { res.status(403).json({ error: "Not authorized" }); return; }

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    if (!event.costPence || event.costPence <= 0) {
      res.status(400).json({ error: "This event has no cost" }); return;
    }
    if (!childEligibleForEvent(event, child)) {
      res.status(403).json({ error: "This event is not for this player's age group" }); return;
    }

    await db.insert(eventPaymentsTable)
      .values({ eventId: id, memberId, method: "bank", amountPence: event.costPence })
      .onConflictDoNothing();

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error marking event payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /events/:id/payments/create-checkout ───────────────────────────────
// Stripe Checkout for the event cost + 10p handling fee.
router.post("/events/:id/payments/create-checkout", async (req, res): Promise<void> => {
  try {
    const id = parseId(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const parentEmail = await resolvePayerEmail(req);
    if (!parentEmail) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { memberId, successUrl, cancelUrl } = req.body as {
      memberId: number; successUrl: string; cancelUrl: string;
    };
    const childId = parseInt(String(memberId), 10);
    if (isNaN(childId) || !successUrl || !cancelUrl) {
      res.status(400).json({ error: "memberId, successUrl and cancelUrl required" }); return;
    }
    if (!isAllowedReturnUrl(successUrl) || !isAllowedReturnUrl(cancelUrl)) {
      res.status(400).json({ error: "Invalid return URL" }); return;
    }

    const child = await parentOwnsChild(parentEmail, childId);
    if (!child) { res.status(403).json({ error: "Not authorized" }); return; }

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
    if (!event) { res.status(404).json({ error: "Event not found" }); return; }
    if (!event.costPence || event.costPence <= 0) {
      res.status(400).json({ error: "This event has no cost" }); return;
    }
    if (!childEligibleForEvent(event, child)) {
      res.status(403).json({ error: "This event is not for this player's age group" }); return;
    }

    const [existing] = await db.select().from(eventPaymentsTable)
      .where(and(eq(eventPaymentsTable.eventId, id), eq(eventPaymentsTable.memberId, childId)));
    if (existing) { res.status(400).json({ error: "Already paid" }); return; }

    const settingRows = await db.execute(sql`SELECT value FROM kjihc_settings WHERE key = 'stripe_secret_key'`);
    const stripeSecretKey = (settingRows.rows[0] as any)?.value as string | undefined;
    if (!stripeSecretKey) {
      res.status(503).json({ error: "Online payments are not yet configured. Please contact the club." }); return;
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-06-30.basil" });

    const totalPence = event.costPence + EVENT_PAYMENT_HANDLING_PENCE;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "gbp",
          unit_amount: totalPence,
          product_data: { name: `${event.title} — ${child.playerName} (incl. 10p handling)` },
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: parentEmail,
      metadata: { eventPayment: "1", eventId: String(id), childId: String(childId), childName: child.playerName },
    });

    res.json({ checkoutUrl: session.url, totalPence });
  } catch (err) {
    req.log.error({ err }, "Error creating event payment checkout");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /pay-return redirects the browser back into the mobile app after a
// Stripe Checkout started in-app (success or cancel).
router.get("/pay-return", (req, res) => {
  const status = req.query.status === "success" ? "success" : "cancel";
  res.redirect(302, `kjihc-mobile://paid?status=${status}`);
});

export default router;
