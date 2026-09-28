import { Router } from "express";
import crypto from "crypto";
import { db, membersTable, parentTokensTable } from "@workspace/db";
import { lt, or, isNull, and, gt } from "drizzle-orm";
import { requireStaff, requireSuperUser } from "../middlewares/auth";
import { sendCodeOfConductReminder } from "../lib/email";
import { getAppBaseUrl } from "../lib/appUrl";

const router = Router();

// One year in milliseconds
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
// Token valid for 7 days for conduct reminder links
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function oneYearAgo() {
  return new Date(Date.now() - ONE_YEAR_MS);
}

// ── GET /conduct-reminder/stats ───────────────────────────────────────────────
// Returns a breakdown of which members need re-signing

router.get("/conduct-reminder/stats", requireStaff, async (_req, res): Promise<void> => {
  try {
    const members = await db.select({
      id: membersTable.id,
      playerEmail: membersTable.playerEmail,
      codeSignedAt: membersTable.codeSignedAt,
      readCode: membersTable.readCode,
    }).from(membersTable);

    const cutoff = oneYearAgo();

    let neverSigned = 0;
    let needsRenewal = 0;
    let upToDate = 0;

    for (const m of members) {
      if (!m.playerEmail) continue;
      if (!m.codeSignedAt) {
        neverSigned++;
      } else if (new Date(m.codeSignedAt) < cutoff) {
        needsRenewal++;
      } else {
        upToDate++;
      }
    }

    // Count unique parent emails that need a reminder
    const needsReminder = new Set<string>();
    for (const m of members) {
      if (!m.playerEmail) continue;
      if (!m.codeSignedAt || new Date(m.codeSignedAt) < cutoff) {
        needsReminder.add(m.playerEmail.toLowerCase());
      }
    }

    res.json({
      neverSigned,
      needsRenewal,
      upToDate,
      total: members.filter(m => m.playerEmail).length,
      uniqueParentsToNotify: needsReminder.size,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /conduct-reminder/send ───────────────────────────────────────────────
// Sends annual reminder emails to all parents whose signature is missing/expired

router.post("/conduct-reminder/send", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const members = await db.select({
      id: membersTable.id,
      playerName: membersTable.playerName,
      ageGroup: membersTable.ageGroup,
      playerEmail: membersTable.playerEmail,
      playerParent: membersTable.playerParent,
      codeSignedAt: membersTable.codeSignedAt,
    }).from(membersTable);

    const cutoff = oneYearAgo();
    const baseUrl = getAppBaseUrl();

    // Group children by parent email
    const byEmail = new Map<string, { parentName: string; children: { name: string; ageGroup: string }[] }>();
    for (const m of members) {
      if (!m.playerEmail) continue;
      const needsReminder = !m.codeSignedAt || new Date(m.codeSignedAt) < cutoff;
      if (!needsReminder) continue;

      const email = m.playerEmail.toLowerCase();
      const existing = byEmail.get(email);
      if (existing) {
        existing.children.push({ name: m.playerName, ageGroup: m.ageGroup });
      } else {
        byEmail.set(email, {
          parentName: m.playerParent || "Parent/Guardian",
          children: [{ name: m.playerName, ageGroup: m.ageGroup }],
        });
      }
    }

    let sent = 0;
    let failed = 0;

    for (const [email, { parentName, children }] of byEmail) {
      try {
        // Generate a 7-day token so they can go straight to signing
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
        await db.insert(parentTokensTable).values({ email, token, expiresAt });

        const portalUrl = `${baseUrl}/kjihc/parent?token=${token}`;

        await sendCodeOfConductReminder({ to: email, parentName, children, portalUrl });
        sent++;
      } catch {
        failed++;
      }
    }

    res.json({ sent, failed, skipped: 0 });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
