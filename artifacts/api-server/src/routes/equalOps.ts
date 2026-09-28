import { Router } from "express";
import { db, equalOpsResponsesTable } from "@workspace/db";
import { requireStaff } from "../middlewares/auth";

const router = Router();

// Lightweight in-memory rate limit for the anonymous form. IPs are only held
// in memory for the window and never persisted or logged with responses.
const submitCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 30;
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = submitCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    submitCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (submitCounts.size > 5000) {
      for (const [k, v] of submitCounts) if (v.resetAt < now) submitCounts.delete(k);
    }
    return false;
  }
  entry.count++;
  return entry.count > RATE_MAX;
}

const GENDERS = ["male", "female", "other", "prefer_not"] as const;
const ANSWERS = ["yes", "no", "prefer_not"] as const;

const CATEGORY_FIELDS = [
  "minorityEthnic",
  "disabledChild",
  "threeOrMoreChildren",
  "childUnderOne",
  "motherUnder25",
  "youngCarer",
  "careExperienced",
] as const;

// Public, anonymous submission. No auth, no identifying data stored.
router.post("/equal-ops", async (req, res) => {
  try {
    if (rateLimited(req.ip ?? "unknown")) {
      return res.status(429).json({ error: "Too many submissions, please try later" });
    }
    const body = req.body ?? {};
    const gender = body.gender;
    if (!GENDERS.includes(gender)) {
      return res.status(400).json({ error: "Invalid gender value" });
    }
    const values: Record<string, string> = { gender };
    for (const field of CATEGORY_FIELDS) {
      const v = body[field];
      if (!ANSWERS.includes(v)) {
        return res.status(400).json({ error: `Invalid value for ${field}` });
      }
      values[field] = v;
    }
    values.submittedMonth = new Date().toISOString().slice(0, 7);
    await db.insert(equalOpsResponsesTable).values(values as any);
    return res.status(201).json({ ok: true });
  } catch (err) {
    req.log?.error?.(err, "equal-ops submit failed");
    return res.status(500).json({ error: "Failed to save response" });
  }
});

// Staff-only aggregate report. Returns counts per category broken down by gender.
router.get("/equal-ops/report", requireStaff, async (_req, res) => {
  try {
    const rows = await db.select().from(equalOpsResponsesTable);
    const genderTotals: Record<string, number> = {
      male: 0,
      female: 0,
      other: 0,
      prefer_not: 0,
    };
    const categories = CATEGORY_FIELDS.map((field) => ({
      field,
      male: 0,
      female: 0,
      other: 0,
      prefer_not_gender: 0,
      no: 0,
      prefer_not: 0,
    }));
    for (const row of rows) {
      genderTotals[row.gender] = (genderTotals[row.gender] ?? 0) + 1;
      for (const cat of categories) {
        const answer = (row as any)[cat.field] as string;
        if (answer === "yes") {
          if (row.gender === "male") cat.male++;
          else if (row.gender === "female") cat.female++;
          else if (row.gender === "other") cat.other++;
          else cat.prefer_not_gender++;
        } else if (answer === "no") cat.no++;
        else cat.prefer_not++;
      }
    }
    return res.json({
      totalResponses: rows.length,
      genderTotals,
      categories,
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to build report" });
  }
});

export default router;
