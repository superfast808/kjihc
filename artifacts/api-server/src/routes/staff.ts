import { Router } from "express";
import { db, staffTable, channelsTable, channelMembersTable, staffWebSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { vapidPublicKey } from "../lib/webPush";
import { requireStaff, requireSuperUser, parseStaffRoles } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import { sendStaffInviteEmail, getAppBaseUrl } from "../lib/email";
import {
  CreateStaffBody,
  UpdateStaffParams,
  UpdateStaffBody,
  DeleteStaffParams,
} from "@workspace/api-zod";

// Derive a human-readable role description from DB fields
function buildRoleDescription(staffLevel: string, staffRoles: string): string {
  if (staffLevel === "1") return "Superuser — full access to all club data and settings";
  const roles = (staffRoles ?? "").split(",").map(r => r.trim()).filter(Boolean);
  const groups = staffLevel.split(",").map(g => g.trim()).filter(Boolean);
  const roleLabels: Record<string, string> = {
    coach: "Coach / Manager",
    treasurer: "Treasurer",
    registrations: "Registrations",
  };
  const parts: string[] = [];
  if (roles.includes("coach") && groups.length > 0) {
    const groupNames: Record<string, string> = {
      LTP: "Learn to Play", u10: "Under 10", u12: "Under 12",
      u14: "Under 14", u16: "Under 16", u19: "Under 19", lightning: "Lightning (Girls)",
    };
    parts.push(`Coach / Manager — ${groups.map(g => groupNames[g] ?? g).join(", ")}`);
  }
  for (const r of roles.filter(r => r !== "coach")) {
    if (roleLabels[r]) parts.push(roleLabels[r]);
  }
  return parts.join(" · ") || "Staff";
}

const router = Router();

router.get("/staff", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const staff = await db.select({
      id: staffTable.id,
      staffName: staffTable.staffName,
      staffEmail: staffTable.staffEmail,
      staffLevel: staffTable.staffLevel,
      staffRoles: staffTable.staffRoles,
    }).from(staffTable);
    res.json(staff);
  } catch (err) {
    req.log.error({ err }, "Error listing staff");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/me", requireStaff, async (req, res): Promise<void> => {
  try {
    const staff = (req as any).staffMember;
    const { isSuperUser, isCoach, isTreasurer, isRegistrations, ageGroups, roles } = parseStaffRoles(staff);
    res.json({
      id: staff.id,
      staffName: staff.staffName,
      staffEmail: staff.staffEmail,
      staffLevel: staff.staffLevel,
      staffRoles: staff.staffRoles ?? "",
      isSuperUser,
      isCoach,
      isTreasurer,
      isRegistrations,
      allowedGroups: ageGroups,
      roles,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting staff profile");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const parsed = CreateStaffBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [created] = await db.insert(staffTable).values({
      staffName: parsed.data.staffName,
      staffEmail: parsed.data.staffEmail,
      staffLevel: parsed.data.staffLevel,
      staffRoles: parsed.data.staffRoles ?? "",
    }).returning();

    // Fire invite email — don't block the response if it fails
    sendStaffInviteEmail({
      to: created.staffEmail,
      staffName: created.staffName,
      roleDescription: buildRoleDescription(created.staffLevel, created.staffRoles ?? ""),
      loginUrl: `${getAppBaseUrl()}/kjihc`,
    }).catch(err => req.log.warn({ err }, "Failed to send staff invite email"));

    // Auto-join the new staff member into all existing staff channels
    const staffChannels = await db.select({ id: channelsTable.id }).from(channelsTable).where(eq(channelsTable.type, "staff"));
    for (const ch of staffChannels) {
      await db.insert(channelMembersTable).values({
        channelId: ch.id, memberId: String(created.id), memberType: "staff",
      }).onConflictDoNothing();
    }

    logAudit(req, "staff.create", {
      entityType: "staff", entityId: created.id, entityName: created.staffName,
      details: { staffEmail: created.staffEmail, staffLevel: created.staffLevel, staffRoles: created.staffRoles },
    });

    res.status(201).json({
      id: created.id,
      staffName: created.staffName,
      staffEmail: created.staffEmail,
      staffLevel: created.staffLevel,
      staffRoles: created.staffRoles ?? "",
    });
  } catch (err) {
    req.log.error({ err }, "Error creating staff");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /staff/:id/send-invite ───────────────────────────────────────────────
// Resend (or send) a portal invite to an existing staff member

router.post("/staff/:id/send-invite", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [member] = await db.select().from(staffTable).where(eq(staffTable.id, id));
    if (!member) { res.status(404).json({ error: "Staff not found" }); return; }

    await sendStaffInviteEmail({
      to: member.staffEmail,
      staffName: member.staffName,
      roleDescription: buildRoleDescription(member.staffLevel, member.staffRoles ?? ""),
      loginUrl: `${getAppBaseUrl()}/kjihc`,
    });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error sending staff invite");
    res.status(500).json({ error: "Failed to send invite email — check SMTP settings." });
  }
});

router.patch("/staff/:id", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const parsed = UpdateStaffBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [updated] = await db.update(staffTable).set(parsed.data).where(eq(staffTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Staff not found" }); return; }

    logAudit(req, "staff.edit", {
      entityType: "staff", entityId: updated.id, entityName: updated.staffName,
      details: parsed.data as Record<string, unknown>,
    });

    res.json({
      id: updated.id,
      staffName: updated.staffName,
      staffEmail: updated.staffEmail,
      staffLevel: updated.staffLevel,
      staffRoles: updated.staffRoles ?? "",
    });
  } catch (err) {
    req.log.error({ err }, "Error updating staff");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── VAPID public key (no auth) ────────────────────────────────────────────────
router.get("/staff/vapid-public-key", (_req, res): void => {
  res.json({ publicKey: vapidPublicKey });
});

// ── WEB PUSH: register staff subscription ────────────────────────────────────
router.post("/staff/web-push-subscribe", requireStaff, async (req, res): Promise<void> => {
  try {
    const staff = (req as any).staffMember;
    const staffId = staff ? String(staff.id) : undefined;
    if (!staffId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { endpoint, p256dh, auth } = req.body as { endpoint?: string; p256dh?: string; auth?: string };
    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: "endpoint, p256dh and auth are required" }); return;
    }

    await db
      .insert(staffWebSubscriptionsTable)
      .values({ staffId, endpoint, p256dh, auth, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: staffWebSubscriptionsTable.endpoint,
        set: { staffId, p256dh, auth, updatedAt: new Date() },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error registering staff web push subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── WEB PUSH: remove staff subscription ──────────────────────────────────────
router.delete("/staff/web-push-subscribe", requireStaff, async (req, res): Promise<void> => {
  try {
    const staff = (req as any).staffMember;
    const staffId = staff ? String(staff.id) : undefined;
    if (!staffId) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }

    await db.delete(staffWebSubscriptionsTable)
      .where(and(
        eq(staffWebSubscriptionsTable.endpoint, endpoint),
        eq(staffWebSubscriptionsTable.staffId, staffId),
      ));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error removing staff web push subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/staff/:id", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [dying] = await db.select({ staffName: staffTable.staffName, staffEmail: staffTable.staffEmail }).from(staffTable).where(eq(staffTable.id, id));
    await db.delete(staffTable).where(eq(staffTable.id, id));
    logAudit(req, "staff.delete", { entityType: "staff", entityId: id, entityName: dying?.staffName, details: { staffEmail: dying?.staffEmail } });
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err }, "Error deleting staff");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
