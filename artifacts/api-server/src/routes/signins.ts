import { Router } from "express";
import { db, signinsTable, membersTable } from "@workspace/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireStaff, parseStaffRoles , normAgeGroup } from "../middlewares/auth";
import {
  ListSigninsQueryParams,
  SubmitSigninsBody,
  GetAttendanceSummaryQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/signins", requireStaff, async (req, res): Promise<void> => {
  try {
    const params = ListSigninsQueryParams.safeParse(req.query);
    const filters: any[] = [];
    if (params.success && params.data.date) {
      filters.push(eq(signinsTable.sessionDate, params.data.date));
    }
    if (params.success && params.data.session) {
      filters.push(eq(signinsTable.session, params.data.session));
    }
    if (params.success && params.data.memberId) {
      filters.push(eq(signinsTable.memberId, params.data.memberId));
    }

    const result = await db.execute(sql`
      SELECT s.id, s.member_id, m.player_name, m.age_group, s.session, s.session_date, s.miss_reason, s.created_at, s.event_id, e.title as event_title
      FROM kjihc_signins s
      JOIN kjihc_members m ON s.member_id = m.id
      LEFT JOIN kjihc_events e ON s.event_id = e.id
      ORDER BY s.session_date DESC, s.created_at DESC
      LIMIT 500
    `);

    let rows = result.rows as any[];

    if (params.success) {
      if (params.data.date) rows = rows.filter((r) => r.session_date === params.data.date);
      if (params.data.session) rows = rows.filter((r) => r.session === params.data.session);
      if (params.data.memberId) rows = rows.filter((r) => r.member_id === params.data.memberId);
      if (params.data.ageGroup) rows = rows.filter((r) => r.age_group === params.data.ageGroup);
    }

    res.json(rows.map((r) => ({
      id: r.id,
      memberId: r.member_id,
      memberName: r.player_name,
      session: r.session,
      date: r.session_date,
      missReason: r.miss_reason ?? null,
      createdAt: r.created_at,
      eventId: r.event_id ?? null,
      eventTitle: r.event_title ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing signins");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/signins", requireStaff, async (req, res): Promise<void> => {
  try {
    const parsed = SubmitSigninsBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const { session, date, entries, eventId } = parsed.data;
    let saved = 0;

    for (const entry of entries) {
      if (entry.status === "na") continue; // skip n/a entries

      const missReason = entry.status === "no" ? (entry.missReason ?? "(no reason given)") : null;

      await db.insert(signinsTable).values({
        memberId: entry.memberId,
        session,
        sessionDate: date,
        missReason,
        ...(eventId != null ? { eventId } : {}),
      });
      saved++;
    }

    res.status(201).json({ saved });
  } catch (err) {
    req.log.error({ err }, "Error submitting signins");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/signins/sessions", requireStaff, async (req, res): Promise<void> => {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT session FROM kjihc_signins ORDER BY session
    `);
    res.json(result.rows.map((r: any) => r.session));
  } catch (err) {
    req.log.error({ err }, "Error listing sessions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/signins/attendance-summary", requireStaff, async (req, res): Promise<void> => {
  try {
    const params = GetAttendanceSummaryQueryParams.safeParse(req.query);

    // Build WHERE clause using Drizzle sql template so params are properly bound
    const conditions: ReturnType<typeof sql>[] = [];
    if (params.success && params.data.from)
      conditions.push(sql`s.session_date >= ${params.data.from}`);
    if (params.success && params.data.to)
      conditions.push(sql`s.session_date <= ${params.data.to}`);
    if (params.success && params.data.session)
      conditions.push(sql`s.session = ${params.data.session}`);
    if (params.success && params.data.ageGroup)
      conditions.push(sql`lower(m.age_group) = lower(${params.data.ageGroup})`);
    if (params.success && params.data.eventId)
      conditions.push(sql`s.event_id = ${params.data.eventId}`);

    // Enforce age-group scope for non-superusers
    const staffMember = (req as any).staffMember;
    const { isSuperUser, ageGroups } = parseStaffRoles(staffMember);
    if (!isSuperUser && ageGroups.length > 0) {
      const requestedGroup = params.success ? params.data.ageGroup : undefined;
      if (requestedGroup && !ageGroups.includes(normAgeGroup(requestedGroup))) {
        res.status(403).json({ error: "Access denied for this age group" });
        return;
      }
      if (!requestedGroup) {
        // Auto-restrict to their groups when no specific group is requested
        conditions.push(sql`lower(m.age_group) IN (${sql.join(ageGroups.map(g => sql`${g}`), sql`, `)})`);
      }
    }

    const whereClause = conditions.length > 0
      ? conditions.reduce((acc, c) => sql`${acc} AND ${c}`)
      : sql`1=1`;

    const result = await db.execute(sql`
      SELECT
        m.id as member_id,
        m.player_name,
        m.age_group,
        COUNT(CASE WHEN s.id IS NOT NULL AND s.miss_reason IS NULL THEN 1 END) as attended,
        COUNT(s.id) as total,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'date', s.session_date,
              'session', s.session,
              'reason', s.miss_reason,
              'eventTitle', e.title
            ) ORDER BY s.session_date DESC
          ) FILTER (WHERE s.miss_reason IS NOT NULL),
          '[]'::json
        ) as absences
      FROM kjihc_members m
      LEFT JOIN kjihc_signins s ON m.id = s.member_id
      LEFT JOIN kjihc_events e ON s.event_id = e.id
      WHERE ${whereClause}
      GROUP BY m.id, m.player_name, m.age_group
      ORDER BY m.player_name
    `);

    res.json(result.rows.map((r: any) => ({
      memberId: r.member_id,
      memberName: r.player_name,
      ageGroup: r.age_group,
      attended: Number(r.attended),
      total: Number(r.total),
      rate: r.total > 0 ? Math.round((Number(r.attended) / Number(r.total)) * 100) / 100 : 0,
      absences: r.absences ?? [],
    })));
  } catch (err) {
    req.log.error({ err }, "Error getting attendance summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
