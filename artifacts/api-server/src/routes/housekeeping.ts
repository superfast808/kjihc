import { Router } from "express";
import { db, membersTable, signinsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireStaff } from "../middlewares/auth";

const router = Router();

// Find likely duplicates: same name (case-insensitive) + same DOB, or same name + same email
router.get("/housekeeping/duplicates", requireStaff, async (req, res): Promise<void> => {
  try {
    // Group by normalised name + dob
    const byNameDob = await db.execute(sql`
      SELECT
        LOWER(TRIM(player_name)) AS norm_name,
        TRIM(player_dob) AS dob,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', id,
            'playerName', player_name,
            'playerDob', player_dob,
            'ageGroup', age_group,
            'addAgeGroup', add_age_group,
            'playerEmail', player_email,
            'playerParent', player_parent,
            'playerFee', player_fee,
            'createdAt', created_at
          ) ORDER BY id
        ) AS members
      FROM kjihc_members
      WHERE player_dob IS NOT NULL AND player_dob != ''
      GROUP BY LOWER(TRIM(player_name)), TRIM(player_dob)
      HAVING COUNT(*) > 1
      ORDER BY norm_name
    `);

    // Group by same email + same normalised name (catches slightly different name spellings missed above)
    const byNameEmail = await db.execute(sql`
      SELECT
        LOWER(TRIM(player_name)) AS norm_name,
        LOWER(TRIM(player_email)) AS email,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', id,
            'playerName', player_name,
            'playerDob', player_dob,
            'ageGroup', age_group,
            'addAgeGroup', add_age_group,
            'playerEmail', player_email,
            'playerParent', player_parent,
            'playerFee', player_fee,
            'createdAt', created_at
          ) ORDER BY id
        ) AS members
      FROM kjihc_members
      WHERE player_email IS NOT NULL AND player_email != ''
      GROUP BY LOWER(TRIM(player_name)), LOWER(TRIM(player_email))
      HAVING COUNT(*) > 1
      ORDER BY norm_name
    `);

    // Merge and deduplicate groups (a pair might appear in both queries)
    const seen = new Set<string>();
    const groups: any[] = [];

    const addGroup = (members: any[], reason: string) => {
      const key = members.map((m: any) => m.id).sort().join(",");
      if (!seen.has(key)) {
        seen.add(key);
        groups.push({ reason, members });
      }
    };

    for (const row of byNameDob.rows as any[]) {
      addGroup(row.members, "Same name and date of birth");
    }
    for (const row of byNameEmail.rows as any[]) {
      addGroup(row.members, "Same name and email address");
    }

    res.json(groups);
  } catch (err) {
    req.log.error({ err }, "Error finding duplicates");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Find inactive players: no sign-ins, or last sign-in older than threshold
router.get("/housekeeping/inactive", requireStaff, async (req, res): Promise<void> => {
  try {
    const monthsParam = parseInt((req.query.months as string) ?? "3", 10);
    const months = isNaN(monthsParam) ? 3 : monthsParam;

    const result = await db.execute(sql`
      SELECT
        m.id,
        m.player_name AS "playerName",
        m.player_dob AS "playerDob",
        m.age_group AS "ageGroup",
        m.add_age_group AS "addAgeGroup",
        m.player_email AS "playerEmail",
        m.player_parent AS "playerParent",
        m.player_fee AS "playerFee",
        m.created_at AS "createdAt",
        MAX(s.session_date) AS "lastSignin",
        COUNT(s.id) AS "totalSignins"
      FROM kjihc_members m
      LEFT JOIN kjihc_signins s ON s.member_id = m.id
      GROUP BY m.id
      HAVING
        COUNT(s.id) = 0
        OR MAX(s.session_date) < (CURRENT_DATE - (${months} || ' months')::INTERVAL)::date
      ORDER BY "lastSignin" ASC NULLS FIRST, m.player_name ASC
    `);

    res.json(result.rows.map((r: any) => ({
      id: r.id,
      playerName: r.playerName,
      playerDob: r.playerDob,
      ageGroup: r.ageGroup,
      addAgeGroup: r.addAgeGroup,
      playerEmail: r.playerEmail,
      playerParent: r.playerParent,
      playerFee: r.playerFee,
      createdAt: r.createdAt,
      lastSignin: r.lastSignin ?? null,
      totalSignins: Number(r.totalSignins),
    })));
  } catch (err) {
    req.log.error({ err }, "Error finding inactive players");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
