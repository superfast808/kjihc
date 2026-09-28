import { Router } from "express";
import { db, auditLogTable } from "@workspace/db";
import { requireSuperUser } from "../middlewares/auth";
import { desc, eq, and, gte, lte, sql, count } from "drizzle-orm";

const router = Router();

/**
 * GET /admin/audit-log
 * Superuser-only. Returns paginated audit log with optional filters.
 *
 * Query params:
 *   page       (default 1)
 *   limit      (default 50, max 200)
 *   staffEmail (filter by exact email)
 *   action     (filter by action prefix, e.g. "member")
 *   entityType (filter: "member" | "event" | "staff")
 *   from       (ISO date string)
 *   to         (ISO date string)
 */
router.get("/admin/audit-log", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"),  10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const offset = (page - 1) * limit;

    const { staffEmail, action, entityType, from, to } = req.query as Record<string, string | undefined>;

    const conditions = [];
    if (staffEmail) conditions.push(eq(auditLogTable.staffEmail, staffEmail));
    if (entityType) conditions.push(eq(auditLogTable.entityType as any, entityType));
    if (action)     conditions.push(sql`${auditLogTable.action} like ${action + "%"}`);
    if (from)       conditions.push(gte(auditLogTable.createdAt, new Date(from)));
    if (to)         conditions.push(lte(auditLogTable.createdAt, new Date(to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(auditLogTable)
      .where(where);

    const entries = await db
      .select()
      .from(auditLogTable)
      .where(where)
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ total, page, limit, entries });
  } catch (err) {
    req.log.error({ err }, "Error fetching audit log");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /admin/audit-log/staff-list
 * Returns distinct staff emails that appear in the audit log — for the filter dropdown.
 */
router.get("/admin/audit-log/staff-list", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const rows = await db
      .selectDistinct({ staffEmail: auditLogTable.staffEmail, staffName: auditLogTable.staffName })
      .from(auditLogTable)
      .orderBy(auditLogTable.staffEmail);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error fetching audit staff list");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
