import { Router } from "express";
import { db, membersTable, feesTable, hejaCodesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { SubmitJoinBody } from "@workspace/api-zod";
import { sendWelcomeEmail } from "../lib/email";
import { requireSuperUser } from "../middlewares/auth";

const router = Router();

router.post("/join", async (req, res): Promise<void> => {
  try {
    const parsed = SubmitJoinBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const data = parsed.data;
    const [created] = await db.insert(membersTable).values({
      playerName: data.playerName.trim(),
      playerDob: data.playerDob,
      // Normalize "U14" → "u14" so staff age-group filters match
      ageGroup: /^u\d+$/i.test(data.ageGroup.trim()) ? data.ageGroup.trim().toLowerCase() : data.ageGroup.trim(),
      playerAddress1: data.playerAddress1,
      playerAddress2: data.playerAddress2 ?? null,
      playerCity: data.playerCity,
      playerPost: data.playerPost,
      playerParent: data.playerParent,
      playerContactTel: data.playerContactTel,
      playerEmail: data.playerEmail,
      playerMedicalnotes: data.playerMedicalnotes ?? null,
      playerMedication: data.playerMedication ?? null,
      playerFee: data.playerFee,
      readCode: data.readCode,
      agreeFee: data.agreeFee,
      agreeGdpr: data.agreeGdpr,
      agreePhoto: data.agreePhoto,
    }).returning();

    // Send welcome email (non-blocking — failure won't break registration)
    sendWelcomeEmail({
      to: data.playerEmail,
      playerName: data.playerName,
      parentName: data.playerParent,
      ageGroup: data.ageGroup,
      hejaTeamCode: await getHejaCode(data.ageGroup),
      hejaMainCode: await getHejaCode("Main Club - All Members to Join"),
      bankAccountName: await getSetting("bank_account_name"),
      bankSortCode: await getSetting("bank_sort_code"),
      bankAccountNumber: await getSetting("bank_account_number"),
      bankReferenceHint: await getSetting("bank_reference_hint"),
    }).catch((err) => {
      req.log.error({ err }, "Welcome email failed — registration still saved");
    });

    res.status(201).json({
      id: created.id,
      message: "Registration successful! Welcome to KJIHC.",
    });
  } catch (err) {
    req.log.error({ err }, "Error submitting join");
    res.status(500).json({ error: "Internal server error" });
  }
});

async function getHejaCode(group: string): Promise<string | null> {
  try {
    const rows = await db.select().from(hejaCodesTable);
    return rows.find(r => r.codeGroup?.toLowerCase() === group.toLowerCase())?.codeCode ?? null;
  } catch { return null; }
}

async function getSetting(key: string): Promise<string> {
  try {
    const result = await db.execute(sql`SELECT value FROM kjihc_settings WHERE key = ${key}`);
    return (result.rows[0] as any)?.value ?? "";
  } catch { return ""; }
}

router.get("/join/fees", async (_req, res): Promise<void> => {
  try {
    const fees = await db.select().from(feesTable).orderBy(feesTable.id);
    res.json(fees.map((f) => ({ id: f.id, feeGroup: f.feeGroup, feeAmount: f.feeAmount })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Fee CRUD (superuser only) ──────────────────────────────────────────────

router.post("/join/fees", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const { feeGroup, feeAmount } = req.body as { feeGroup?: string; feeAmount?: string };
    if (!feeGroup?.trim() || !feeAmount?.trim()) {
      res.status(400).json({ error: "feeGroup and feeAmount are required" }); return;
    }
    const [created] = await db.insert(feesTable).values({
      feeGroup: feeGroup.trim(),
      feeAmount: feeAmount.trim(),
    }).returning();
    res.status(201).json({ id: created.id, feeGroup: created.feeGroup, feeAmount: created.feeAmount });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/join/fees/:id", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    const { feeGroup, feeAmount } = req.body as { feeGroup?: string; feeAmount?: string };
    if (!feeGroup?.trim() || !feeAmount?.trim()) {
      res.status(400).json({ error: "feeGroup and feeAmount are required" }); return;
    }
    const [updated] = await db.update(feesTable)
      .set({ feeGroup: feeGroup.trim(), feeAmount: feeAmount.trim() })
      .where(eq(feesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Fee not found" }); return; }
    res.json({ id: updated.id, feeGroup: updated.feeGroup, feeAmount: updated.feeAmount });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/join/fees/:id", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    await db.delete(feesTable).where(eq(feesTable.id, id));
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/join/heja-codes", async (_req, res): Promise<void> => {
  try {
    const codes = await db.select().from(hejaCodesTable).orderBy(hejaCodesTable.id);
    res.json(codes.map((c) => ({ id: c.id, codeGroup: c.codeGroup, codeCode: c.codeCode })));
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
