import { Router } from "express";
import { db, ensignEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireStaff, requireSuperUser } from "../middlewares/auth";
import {
  ListEnsignEntriesQueryParams,
  CreateEnsignEntryBody,
  UpdateEnsignPaymentParams,
  UpdateEnsignPaymentBody,
} from "@workspace/api-zod";

const router = Router();

const toResponse = (e: typeof ensignEntriesTable.$inferSelect) => ({
  id: e.id,
  ageGroup: e.ageGroup,
  clubName: e.clubName,
  teamName: e.teamName,
  shirtColourHome: e.shirtColourHome,
  shirtColourAway: e.shirtColourAway,
  numCoachesOfficials: e.numCoachesOfficials,
  seniorContactName: e.seniorContactName,
  seniorContactPhoneEmail: e.seniorContactPhoneEmail,
  bookingContactName: e.bookingContactName,
  bookingContactPhone: e.bookingContactPhone,
  bookingContactEmail: e.bookingContactEmail,
  managerName: e.managerName,
  managerPhone: e.managerPhone,
  managerEmail: e.managerEmail,
  remarks: e.remarks ?? null,
  paymentStatus: e.paymentStatus,
  signature: e.signature,
  printName: e.printName,
  positionInClub: e.positionInClub,
  dateSigned: e.dateSigned,
  createdAt: e.createdAt.toISOString(),
});

router.get("/ensign", requireStaff, async (req, res): Promise<void> => {
  try {
    const params = ListEnsignEntriesQueryParams.safeParse(req.query);
    let entries = await db.select().from(ensignEntriesTable).orderBy(ensignEntriesTable.createdAt);

    if (params.success && params.data.ageGroup) {
      entries = entries.filter((e) => e.ageGroup === params.data.ageGroup);
    }

    res.json(entries.map(toResponse));
  } catch (err) {
    req.log.error({ err }, "Error listing ensign entries");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/ensign", async (req, res): Promise<void> => {
  try {
    const parsed = CreateEnsignEntryBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const [created] = await db.insert(ensignEntriesTable).values({
      ageGroup: parsed.data.ageGroup,
      clubName: parsed.data.clubName,
      teamName: parsed.data.teamName,
      shirtColourHome: parsed.data.shirtColourHome,
      shirtColourAway: parsed.data.shirtColourAway,
      numCoachesOfficials: parsed.data.numCoachesOfficials,
      seniorContactName: parsed.data.seniorContactName,
      seniorContactPhoneEmail: parsed.data.seniorContactPhoneEmail,
      bookingContactName: parsed.data.bookingContactName,
      bookingContactPhone: parsed.data.bookingContactPhone,
      bookingContactEmail: parsed.data.bookingContactEmail,
      managerName: parsed.data.managerName,
      managerPhone: parsed.data.managerPhone,
      managerEmail: parsed.data.managerEmail,
      remarks: parsed.data.remarks ?? null,
      signature: parsed.data.signature,
      printName: parsed.data.printName,
      positionInClub: parsed.data.positionInClub,
      dateSigned: parsed.data.dateSigned,
      paymentStatus: 0,
    }).returning();

    res.status(201).json(toResponse(created));
  } catch (err) {
    req.log.error({ err }, "Error creating ensign entry");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/ensign/:id/payment", requireStaff, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const parsed = UpdateEnsignPaymentBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    await db.update(ensignEntriesTable).set({ paymentStatus: parsed.data.paymentStatus }).where(eq(ensignEntriesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error updating ensign payment");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
