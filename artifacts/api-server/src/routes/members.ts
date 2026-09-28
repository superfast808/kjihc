import { Router } from "express";
import { db, membersTable, parentDevicesTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { eq, ilike, or, asc, sql, inArray } from "drizzle-orm";
import { sendWelcomeEmail, sendParentPortalInvite } from "../lib/email";
import { sendWebPushToEmail } from "../lib/webPush";
import { sendExpoPushNotifications } from "../lib/expoPush";
import { requireStaff, requireSuperUser, parseStaffRoles, normAgeGroup } from "../middlewares/auth";
import { logAudit } from "../lib/audit";
import {
  ListMembersQueryParams,
  GetMemberParams,
  UpdateMemberParams,
  UpdateMemberBody,
  DeleteMemberParams,
  UpdateMemberAgeGroupParams,
  UpdateMemberAgeGroupBody,
} from "@workspace/api-zod";

const router = Router();
const storage = new ObjectStorageService();

/**
 * GET /members/public-roster
 * Public endpoint — no auth required.
 * Returns all players with name, age group, and a signed photo URL (1-hour TTL) if they have one.
 * Intended for embedding on the club's main website.
 */
router.get("/members/public-roster", async (req, res): Promise<void> => {
  try {
    const rows = await db.select({
      id: membersTable.id,
      playerName: membersTable.playerName,
      ageGroup: membersTable.ageGroup,
      playerPhoto: membersTable.playerPhoto,
    }).from(membersTable).orderBy(asc(membersTable.ageGroup), asc(membersTable.playerName));

    const roster = await Promise.all(rows.map(async (m) => {
      let photoUrl: string | null = null;
      if (m.playerPhoto) {
        try {
          photoUrl = await storage.getObjectEntityDownloadURL(m.playerPhoto, 3600);
        } catch {
          // No photo available — leave null
        }
      }
      return { playerName: m.playerName, ageGroup: m.ageGroup, photoUrl };
    }));

    res.setHeader("Cache-Control", "public, max-age=300"); // 5-min CDN cache
    res.json(roster);
  } catch (err) {
    req.log.error({ err }, "Error fetching public roster");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/members", requireStaff, async (req, res): Promise<void> => {
  try {
    const params = ListMembersQueryParams.safeParse(req.query);
    const staff = (req as any).staffMember;
    const { isSuperUser, isTreasurer, isRegistrations, ageGroups } = parseStaffRoles(staff);
    const hasAllMembersAccess = isSuperUser || isTreasurer || isRegistrations;

    let members = await db.select({
      id: membersTable.id,
      playerName: membersTable.playerName,
      playerDob: membersTable.playerDob,
      ageGroup: membersTable.ageGroup,
      addAgeGroup: membersTable.addAgeGroup,
      playerParent: membersTable.playerParent,
      playerContactTel: membersTable.playerContactTel,
      playerEmail: membersTable.playerEmail,
      playerMedicalnotes: membersTable.playerMedicalnotes,
      playerMedication: membersTable.playerMedication,
      playerFee: membersTable.playerFee,
      agreeFee: membersTable.agreeFee,
      agreeGdpr: membersTable.agreeGdpr,
      agreePhoto: membersTable.agreePhoto,
      readCode: membersTable.readCode,
      sihaRegistered: membersTable.sihaRegistered,
      playerNumber: membersTable.playerNumber,
      sihaNumber: membersTable.sihaNumber,
      feesOverdue: membersTable.feesOverdue,
      feesBalance: membersTable.feesBalance,
      playerPhoto: membersTable.playerPhoto,
    }).from(membersTable).orderBy(asc(membersTable.playerName));

    if (!hasAllMembersAccess && ageGroups.length > 0) {
      members = members.filter((m) =>
        ageGroups.includes(normAgeGroup(m.ageGroup)) ||
        (m.addAgeGroup && m.addAgeGroup.split(",").map(g => normAgeGroup(g)).some(g => ageGroups.includes(g)))
      );
    }

    if (params.success && params.data.ageGroup) {
      members = members.filter(
        (m) =>
          normAgeGroup(m.ageGroup) === normAgeGroup(params.data.ageGroup) ||
          (m.addAgeGroup && m.addAgeGroup.split(",").map((g) => normAgeGroup(g)).includes(normAgeGroup(params.data.ageGroup))),
      );
    }

    if (params.success && params.data.search) {
      const s = params.data.search.toLowerCase();
      members = members.filter(
        (m) =>
          m.playerName.toLowerCase().includes(s) ||
          m.playerParent.toLowerCase().includes(s) ||
          m.playerEmail.toLowerCase().includes(s),
      );
    }

    if (params.success && params.data.flag) {
      const flag = params.data.flag;
      if (flag === "fees_overdue") {
        members = members.filter((m) => m.feesOverdue === 1);
      } else if (flag === "not_siha") {
        members = members.filter((m) => !m.sihaRegistered || m.sihaRegistered !== 1);
      } else if (flag === "no_photo") {
        members = members.filter((m) => m.agreePhoto === 0);
      }
    }

    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Error listing members");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/members/:id", requireStaff, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
    if (!member) { res.status(404).json({ error: "Member not found" }); return; }

    res.json({
      id: member.id,
      playerName: member.playerName,
      playerDob: member.playerDob,
      ageGroup: member.ageGroup,
      addAgeGroup: member.addAgeGroup,
      playerAddress1: member.playerAddress1,
      playerAddress2: member.playerAddress2,
      playerCity: member.playerCity,
      playerPost: member.playerPost,
      playerParent: member.playerParent,
      playerContactTel: member.playerContactTel,
      playerEmail: member.playerEmail,
      playerMedicalnotes: member.playerMedicalnotes,
      playerMedication: member.playerMedication,
      playerFee: member.playerFee,
      agreeFee: member.agreeFee,
      agreeGdpr: member.agreeGdpr,
      agreePhoto: member.agreePhoto,
      readCode: member.readCode,
      sihaRegistered: member.sihaRegistered,
      playerNumber: member.playerNumber,
      sihaNumber: member.sihaNumber,
      playerPhoto: member.playerPhoto,
      feesOverdue: member.feesOverdue,
      feesBalance: member.feesBalance != null ? parseFloat(member.feesBalance as string) : null,
      medicalUpdatedByParentAt: member.medicalUpdatedByParentAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting member");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/members/:id", requireStaff, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const parsed = UpdateMemberBody.safeParse(req.body);
    if (parsed.success && parsed.data.playerNumber != null) {
      const n = parsed.data.playerNumber;
      if (!Number.isInteger(n) || n < 0 || n > 99) {
        res.status(400).json({ error: "playerNumber must be a whole number between 0 and 99" });
        return;
      }
    }
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [updated] = await db.update(membersTable).set(parsed.data).where(eq(membersTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Member not found" }); return; }

    logAudit(req, "member.edit", {
      entityType: "member", entityId: updated.id, entityName: updated.playerName,
      details: parsed.data as Record<string, unknown>,
    });

    res.json({
      id: updated.id,
      playerName: updated.playerName,
      playerDob: updated.playerDob,
      ageGroup: updated.ageGroup,
      addAgeGroup: updated.addAgeGroup,
      playerAddress1: updated.playerAddress1,
      playerAddress2: updated.playerAddress2,
      playerCity: updated.playerCity,
      playerPost: updated.playerPost,
      playerParent: updated.playerParent,
      playerContactTel: updated.playerContactTel,
      playerEmail: updated.playerEmail,
      playerMedicalnotes: updated.playerMedicalnotes,
      playerMedication: updated.playerMedication,
      playerFee: updated.playerFee,
      agreeFee: updated.agreeFee,
      agreeGdpr: updated.agreeGdpr,
      agreePhoto: updated.agreePhoto,
      readCode: updated.readCode,
      sihaRegistered: updated.sihaRegistered,
      playerNumber: updated.playerNumber,
      sihaNumber: updated.sihaNumber,
      playerPhoto: updated.playerPhoto,
      feesOverdue: updated.feesOverdue,
      feesBalance: updated.feesBalance != null ? parseFloat(updated.feesBalance as string) : null,
      medicalUpdatedByParentAt: updated.medicalUpdatedByParentAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error updating member");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/members/:id", requireStaff, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [dying] = await db.select({ playerName: membersTable.playerName }).from(membersTable).where(eq(membersTable.id, id));
    await db.delete(membersTable).where(eq(membersTable.id, id));
    logAudit(req, "member.delete", { entityType: "member", entityId: id, entityName: dying?.playerName });
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err }, "Error deleting member");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/members/:id/fees-balance", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const staff = (req as any).staffMember;
    const { isSuperUser, isTreasurer } = parseStaffRoles(staff);
    if (!isSuperUser && !isTreasurer) {
      res.status(403).json({ error: "Treasurer or superuser access required" }); return;
    }

    const { feesBalance } = req.body as { feesBalance: number | null };
    const newBalance = feesBalance == null ? null : String(parseFloat(String(feesBalance)).toFixed(2));

    const [updated] = await db.update(membersTable)
      .set({ feesBalance: newBalance })
      .where(eq(membersTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Member not found" }); return; }

    logAudit(req, "member.fees_balance.update", {
      entityType: "member", entityId: updated.id, entityName: updated.playerName,
      details: { feesBalance: newBalance },
    });

    res.json({ feesBalance: updated.feesBalance != null ? parseFloat(updated.feesBalance as string) : null });
  } catch (err) {
    req.log.error({ err }, "Error updating fees balance");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/members/:id/flags", requireStaff, async (req, res): Promise<void> => {
  try {
    // Compliance flags: superusers may update both; treasurers may update the
    // fees flag; registrations staff may update the SIHA flag. Coaches may not.
    const { isSuperUser, isTreasurer, isRegistrations } = parseStaffRoles((req as any).staffMember);
    const body = req.body as { sihaRegistered?: number; feesOverdue?: number };
    if (!isSuperUser) {
      if (body.feesOverdue !== undefined && !isTreasurer) {
        res.status(403).json({ error: "Treasurer or admin access required to update fees status" });
        return;
      }
      if (body.sihaRegistered !== undefined && !isRegistrations) {
        res.status(403).json({ error: "Registrations or admin access required to update SIHA status" });
        return;
      }
      if (!isTreasurer && !isRegistrations) {
        res.status(403).json({ error: "Treasurer, registrations, or admin access required" });
        return;
      }
    }
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const { sihaRegistered, feesOverdue, sendEmail } = req.body as {
      sihaRegistered?: number; feesOverdue?: number; sendEmail?: boolean;
    };

    const updates: Record<string, any> = {};
    if (sihaRegistered !== undefined) updates.sihaRegistered = sihaRegistered;
    if (feesOverdue !== undefined) updates.feesOverdue = feesOverdue;

    if (Object.keys(updates).length) {
      await db.update(membersTable).set(updates).where(eq(membersTable.id, id));
    }

    // Fetch the member once for both email and push notifications
    const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));

    if (member) {
      // Audit — build a descriptive action per flag changed
      if (sihaRegistered !== undefined) {
        logAudit(req, sihaRegistered === 1 ? "member.flag.siha_registered.on" : "member.flag.siha_registered.off", {
          entityType: "member", entityId: id, entityName: member.playerName,
          details: { sihaRegistered },
        });
      }
      if (feesOverdue !== undefined) {
        logAudit(req, feesOverdue === 1 ? "member.flag.fees_overdue.on" : "member.flag.fees_overdue.off", {
          entityType: "member", entityId: id, entityName: member.playerName,
          details: { feesOverdue },
        });
      }

      if (sendEmail) {
        const { sendFlagEmail } = await import("../lib/email");
        const flag = sihaRegistered === 1 ? "siha_registered" : feesOverdue === 1 ? "fees_overdue" : null;
        if (flag) {
          sendFlagEmail({ to: member.playerEmail, playerName: member.playerName, parentName: member.playerParent, flag })
            .catch((err: any) => req.log.error({ err }, "Flag email failed"));
        }
      }

      // Push notification to parent whenever a compliance flag changes
      if (member.playerEmail) {
        let pushTitle: string | null = null;
        let pushBody: string | null = null;

        if (feesOverdue === 1) {
          pushTitle = "⚠️ Fees Overdue";
          pushBody  = `${member.playerName}'s club fees are now overdue — please contact KJIHC.`;
        } else if (feesOverdue === 0) {
          pushTitle = "✅ Fees Cleared";
          pushBody  = `${member.playerName}'s fees have been marked as settled. Thank you!`;
        } else if (sihaRegistered === 1) {
          pushTitle = "✅ SIHA Registration Confirmed";
          pushBody  = `${member.playerName} has been confirmed as registered with SIHA.`;
        } else if (sihaRegistered === 0) {
          pushTitle = "⚠️ SIHA Registration Needed";
          pushBody  = `${member.playerName}'s SIHA registration still needs to be completed.`;
        }

        if (pushTitle && pushBody) {
          // Web push
          sendWebPushToEmail(member.playerEmail.toLowerCase(), {
            title: pushTitle,
            body:  pushBody,
            tag:   `compliance-member-${member.id}`,
          }).catch(() => {});

          // Expo push
          db.select({ expoPushToken: parentDevicesTable.expoPushToken })
            .from(parentDevicesTable)
            .where(eq(parentDevicesTable.email, member.playerEmail.toLowerCase()))
            .then(devices => {
              if (devices.length > 0) {
                sendExpoPushNotifications(devices.map(d => ({
                  to:    d.expoPushToken,
                  title: pushTitle!,
                  body:  pushBody!,
                  data:  { type: "compliance", memberId: member.id },
                  sound: "default" as const,
                }))).catch(() => {});
              }
            })
            .catch(() => {});
        }
      }
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error updating member flags");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/members/:id/resend-welcome", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [member] = await db.select().from(membersTable).where(eq(membersTable.id, id));
    if (!member) { res.status(404).json({ error: "Member not found" }); return; }

    // Fetch heja codes + bank settings
    const hejaRows = await db.execute(sql`SELECT code_group, code_code FROM kjihc_heja_codes`);
    const hejaCodes = hejaRows.rows as { code_group: string; code_code: string }[];
    const hejaTeamCode = hejaCodes.find(r => r.code_group?.toLowerCase().includes(member.ageGroup?.toLowerCase() ?? ""))?.code_code ?? null;
    const hejaMainCode = hejaCodes.find(r => r.code_group?.toLowerCase().includes("main"))?.code_code ?? null;

    const settingsRows = await db.execute(sql`SELECT key, value FROM kjihc_settings WHERE key LIKE 'bank_%'`);
    const settings: Record<string, string> = {};
    for (const r of settingsRows.rows as any[]) settings[r.key] = r.value ?? "";

    await sendWelcomeEmail({
      to: member.playerEmail,
      playerName: member.playerName,
      parentName: member.playerParent,
      ageGroup: member.ageGroup,
      hejaTeamCode,
      hejaMainCode,
      bankAccountName: settings["bank_account_name"] ?? "",
      bankSortCode: settings["bank_sort_code"] ?? "",
      bankAccountNumber: settings["bank_account_number"] ?? "",
      bankReferenceHint: settings["bank_reference_hint"] ?? "",
    });

    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err }, "Error resending welcome email");
    res.status(500).json({ error: err?.message ?? "Failed to send email" });
  }
});

/**
 * POST /members/bulk-invite
 * Superuser — send parent portal invite emails for the selected players.
 * Dedupes by parent email: each parent receives ONE email listing all their
 * selected children. Players without an email address are skipped.
 * Body: { memberIds: number[] }
 */
router.post("/members/bulk-invite", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const memberIds = (req.body as { memberIds?: unknown })?.memberIds;
    if (!Array.isArray(memberIds) || memberIds.length === 0 || !memberIds.every(n => Number.isInteger(n))) {
      res.status(400).json({ error: "memberIds must be a non-empty array of integers" });
      return;
    }
    if (memberIds.length > 500) {
      res.status(400).json({ error: "Too many players — maximum 500 per batch" });
      return;
    }

    const rows = await db.select({
      id: membersTable.id,
      playerName: membersTable.playerName,
      playerParent: membersTable.playerParent,
      playerEmail: membersTable.playerEmail,
      ageGroup: membersTable.ageGroup,
    }).from(membersTable).where(inArray(membersTable.id, memberIds as number[]));

    // Group children by parent email (one invite per parent)
    const byEmail = new Map<string, { parentName: string; children: { name: string; ageGroup: string }[] }>();
    const skipped: string[] = [];
    for (const m of rows) {
      const email = m.playerEmail?.trim().toLowerCase();
      if (!email || !email.includes("@")) { skipped.push(m.playerName); continue; }
      const entry = byEmail.get(email) ?? { parentName: m.playerParent || "Parent", children: [] };
      entry.children.push({ name: m.playerName, ageGroup: m.ageGroup });
      byEmail.set(email, entry);
    }

    const sent: string[] = [];
    const failed: { email: string; error: string }[] = [];
    for (const [email, entry] of byEmail) {
      try {
        await sendParentPortalInvite({ to: email, parentName: entry.parentName, children: entry.children });
        sent.push(email);
      } catch (err: any) {
        failed.push({ email, error: err?.message ?? "Failed to send" });
      }
    }

    logAudit(req, "member.bulk_invite", {
      entityType: "member",
      details: { requested: memberIds.length, sent: sent.length, failed: failed.length, skippedNoEmail: skipped.length },
    });

    res.json({ sent, failed, skipped });
  } catch (err) {
    req.log.error({ err }, "Error sending bulk parent invites");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/members/:id/age-group", requireStaff, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const parsed = UpdateMemberAgeGroupBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [ageMember] = await db.select({ playerName: membersTable.playerName, ageGroup: membersTable.ageGroup }).from(membersTable).where(eq(membersTable.id, id));
    await db.update(membersTable).set({ ageGroup: parsed.data.ageGroup, addAgeGroup: parsed.data.addAgeGroup ?? null }).where(eq(membersTable.id, id));
    logAudit(req, "member.age_group.update", {
      entityType: "member", entityId: id, entityName: ageMember?.playerName,
      details: { from: ageMember?.ageGroup, to: parsed.data.ageGroup, addAgeGroup: parsed.data.addAgeGroup ?? null },
    });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error updating age group");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /members/:id/photo-url
 * Returns a short-lived signed GET URL for the member's photo (staff only).
 */
router.get("/members/:id/photo-url", requireStaff, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [member] = await db.select({ playerPhoto: membersTable.playerPhoto })
      .from(membersTable).where(eq(membersTable.id, id));
    if (!member) { res.status(404).json({ error: "Not found" }); return; }
    if (!member.playerPhoto) { res.status(404).json({ error: "No photo" }); return; }

    const url = await storage.getObjectEntityDownloadURL(member.playerPhoto);
    res.json({ url });
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "No photo" }); return;
    }
    req.log.error({ err }, "Error getting member photo URL");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
