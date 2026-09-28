import { Router } from "express";
import { db, membersTable, signinsTable } from "@workspace/db";
import { count, sql, desc } from "drizzle-orm";
import { requireStaff, parseStaffRoles, normAgeGroup } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/dashboard/stats", requireStaff, async (req, res): Promise<void> => {
  try {
    const staff = (req as any).staffMember;
    const { isSuperUser, isTreasurer, isRegistrations, ageGroups } = parseStaffRoles(staff);
    const hasAllMembersAccess = isSuperUser || isTreasurer || isRegistrations;

    const allMembers = await db.select().from(membersTable);

    let members = allMembers;
    if (!hasAllMembersAccess && ageGroups.length > 0) {
      members = allMembers.filter((m) =>
        ageGroups.includes(normAgeGroup(m.ageGroup)) ||
        (m.addAgeGroup && m.addAgeGroup.split(",").map(g => normAgeGroup(g)).some(g => ageGroups.includes(g)))
      );
    }

    const totalMembers = members.length;
    const membersWithMedical = members.filter((m) => m.playerMedicalnotes && m.playerMedicalnotes.trim()).length;

    const ageGroupCounts: Record<string, number> = {};
    for (const m of members) {
      const g = m.ageGroup || "Unknown";
      ageGroupCounts[g] = (ageGroupCounts[g] || 0) + 1;
    }

    // Sessions this month
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const monthStr = firstOfMonth.toISOString().split("T")[0];

    const sessionsResult = await db.execute(
      sql`SELECT COUNT(DISTINCT session) as cnt FROM kjihc_signins WHERE session_date >= ${monthStr}`
    );
    const sessionsThisMonth = Number((sessionsResult.rows[0] as any)?.cnt ?? 0);

    res.json({
      totalMembers,
      activeMembers: totalMembers,
      sessionsThisMonth,
      membersWithMedical,
      ageGroupCounts,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching dashboard stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/attendance-trend", requireStaff, async (req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT
        to_char(date_trunc('week', session_date::date), 'YYYY-MM-DD') as week,
        COUNT(*) as count
      FROM kjihc_signins
      WHERE miss_reason IS NULL
        AND session_date >= (CURRENT_DATE - INTERVAL '8 weeks')::date
      GROUP BY week
      ORDER BY week ASC
    `);
    res.json(result.rows.map((r: any) => ({ week: r.week, count: Number(r.count) })));
  } catch (err) {
    req.log.error({ err }, "Error fetching attendance trend");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/age-group-breakdown", requireStaff, async (req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT age_group, COUNT(*) as count FROM kjihc_members GROUP BY age_group ORDER BY age_group
    `);
    res.json(result.rows.map((r: any) => ({ ageGroup: r.age_group, count: Number(r.count) })));
  } catch (err) {
    req.log.error({ err }, "Error fetching age group breakdown");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-signins", requireStaff, async (req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT s.id, s.member_id, m.player_name, s.session, s.session_date, s.miss_reason
      FROM kjihc_signins s
      JOIN kjihc_members m ON s.member_id = m.id
      ORDER BY s.created_at DESC
      LIMIT 20
    `);
    res.json(result.rows.map((r: any) => ({
      id: r.id,
      memberName: r.player_name,
      session: r.session,
      date: r.session_date,
      missReason: r.miss_reason ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Error fetching recent signins");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
