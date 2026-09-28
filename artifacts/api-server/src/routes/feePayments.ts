import { Router } from "express";
import { db, feePaymentsTable } from "@workspace/db";
import { requireStaff } from "../middlewares/auth";
import { parseStaffRoles } from "../middlewares/auth";
import { desc, eq, and, gte, lte, count, sql } from "drizzle-orm";

const router = Router();

// Shared role guard — treasurer or superuser only
function requireTreasurer(req: any, res: any, next: any) {
  const { isSuperUser, isTreasurer } = parseStaffRoles(req.staffMember);
  if (!isSuperUser && !isTreasurer) {
    res.status(403).json({ error: "Treasurer or superuser access required" }); return;
  }
  next();
}

/**
 * GET /admin/fee-payments
 * Paginated list of all Stripe fee payments. Treasurer + superuser only.
 * Query params: page, limit, memberId, from, to
 */
router.get("/admin/fee-payments", requireStaff, requireTreasurer, async (req, res): Promise<void> => {
  try {
    const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const offset = (page - 1) * limit;

    const { memberId, from, to } = req.query as Record<string, string | undefined>;

    const conditions: any[] = [];
    if (memberId) conditions.push(eq(feePaymentsTable.memberId, parseInt(memberId, 10)));
    if (from)     conditions.push(gte(feePaymentsTable.createdAt, new Date(from)));
    if (to)       conditions.push(lte(feePaymentsTable.createdAt, new Date(to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(feePaymentsTable).where(where);
    const [{ totalAmount }] = await db
      .select({ totalAmount: sql<string>`COALESCE(SUM(${feePaymentsTable.amountPounds}), 0)` })
      .from(feePaymentsTable)
      .where(where);

    const entries = await db
      .select()
      .from(feePaymentsTable)
      .where(where)
      .orderBy(desc(feePaymentsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ total, totalAmount: parseFloat(totalAmount), page, limit, entries });
  } catch (err) {
    req.log.error({ err }, "Error fetching fee payments");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /members/:id/fee-payments
 * All payments for a specific member. Treasurer + superuser only.
 */
router.get("/members/:id/fee-payments", requireStaff, requireTreasurer, async (req, res): Promise<void> => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const entries = await db
      .select()
      .from(feePaymentsTable)
      .where(eq(feePaymentsTable.memberId, id))
      .orderBy(desc(feePaymentsTable.createdAt));

    const totalPaid = entries.reduce((sum, e) => sum + parseFloat(e.amountPounds as string), 0);
    res.json({ entries, totalPaid });
  } catch (err) {
    req.log.error({ err }, "Error fetching member fee payments");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
