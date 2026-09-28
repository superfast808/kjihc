import { Router } from "express";
import { eq, sql, inArray } from "drizzle-orm";
import { db, membersTable, settingsTable } from "@workspace/db";
import { requireStaff, parseStaffRoles } from "../middlewares/auth";

const router = Router();

// Only superusers or staff with the registrations role can use SIHA tools.
function requireRegistrations(req: any, res: any, next: any) {
  const staff = req.staffMember;
  const { isSuperUser, roles } = parseStaffRoles(staff);
  if (isSuperUser || roles.includes("registrations")) return next();
  return res.status(403).json({ error: "Registrations role required" });
}

async function getSetting(key: string): Promise<string> {
  const rows = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  return rows[0]?.value?.trim() ?? "";
}

// Season starts 1 July: Jul-Dec -> current year, Jan-Jun -> previous year.
function seasonStartDate(now = new Date()): Date {
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return new Date(Date.UTC(year, 6, 1));
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getGraphToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Microsoft sign-in failed (${res.status})`);
  }
  return data.access_token;
}

// Scan the secretary mailbox for SIHA emails this season and match against
// players not yet marked as SIHA-registered. Read-only: changes nothing.
router.post("/siha/scan", requireStaff, requireRegistrations, async (req, res) => {
  try {
    const [tenantId, clientId, clientSecret, mailbox, senderFilterRaw] = await Promise.all([
      getSetting("ms_tenant_id"),
      getSetting("ms_client_id"),
      getSetting("ms_client_secret"),
      getSetting("siha_mailbox"),
      getSetting("siha_sender_filter"),
    ]);
    if (!tenantId || !clientId || !clientSecret || !mailbox) {
      return res.status(400).json({
        error:
          "Mailbox connection not configured. Fill in the Microsoft 365 details on the Settings page first.",
      });
    }
    const senderFilter = (senderFilterRaw || "siha").toLowerCase();

    const token = await getGraphToken(tenantId, clientId, clientSecret);
    const since = seasonStartDate().toISOString();

    type Msg = { subject: string; bodyPreview: string; receivedDateTime: string; from?: any };
    const messages: Msg[] = [];
    let url =
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages` +
      `?$filter=receivedDateTime ge ${since}` +
      `&$select=subject,bodyPreview,receivedDateTime,from&$orderby=receivedDateTime desc&$top=100`;
    let truncated = false;
    for (let page = 0; url; page++) {
      if (page >= 50) { truncated = true; break; }
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error?.message || `Mailbox read failed (${r.status})`);
      }
      messages.push(...(data.value ?? []));
      url = data["@odata.nextLink"] ?? "";
    }

    // Keep messages that look like they come from / are about SIHA.
    const sihaMessages = messages.filter((m) => {
      const from = (m.from?.emailAddress?.address ?? "").toLowerCase();
      const fromName = (m.from?.emailAddress?.name ?? "").toLowerCase();
      const subject = (m.subject ?? "").toLowerCase();
      return (
        from.includes(senderFilter) || fromName.includes(senderFilter) || subject.includes(senderFilter)
      );
    });

    const members = await db
      .select({
        id: membersTable.id,
        playerName: membersTable.playerName,
        ageGroup: membersTable.ageGroup,
        sihaRegistered: membersTable.sihaRegistered,
        sihaNumber: membersTable.sihaNumber,
      })
      .from(membersTable);
    const unregistered = members.filter((m) => m.sihaRegistered !== 1);
    // Registered players missing a registration number — we can still fill those in.
    const missingNumber = members.filter((m) => m.sihaRegistered === 1 && !m.sihaNumber);

    // Try to pull a registration number out of the email text, e.g.
    // "Registration number: SIHA-12345" / "Reg no 987654" / "Membership #A1234".
    const extractSihaNumber = (text: string): string | null => {
      const m = text.match(
        /(?:licence|license|lic\.?|registration|reg\.?|membership|member)\s*(?:number|no\.?|num|#|id)?\s*[:#-]?\s*([A-Z]{0,5}-?\d{1,10})/i,
      );
      return m ? m[1].toUpperCase() : null;
    };

    const candidates: {
      memberId: number;
      playerName: string;
      ageGroup: string;
      matchedSubject: string;
      receivedAt: string;
      sihaNumber: string | null;
    }[] = [];
    for (const m of unregistered) {
      const name = normName(m.playerName ?? "");
      if (name.length < 5 || !name.includes(" ")) continue; // avoid weak matches
      const hit = sihaMessages.find((msg) =>
        (normName(`${msg.subject ?? ""} ${msg.bodyPreview ?? ""}`)).includes(name),
      );
      if (hit) {
        candidates.push({
          memberId: m.id,
          playerName: m.playerName,
          ageGroup: m.ageGroup,
          matchedSubject: hit.subject ?? "",
          receivedAt: hit.receivedDateTime,
          sihaNumber: extractSihaNumber(`${hit.subject ?? ""} ${hit.bodyPreview ?? ""}`),
        });
      }
    }

    // Second pass: find registration numbers for already-registered players.
    const numberUpdates: {
      memberId: number;
      playerName: string;
      ageGroup: string;
      sihaNumber: string;
      matchedSubject: string;
      receivedAt: string;
    }[] = [];
    for (const m of missingNumber) {
      const name = normName(m.playerName ?? "");
      if (name.length < 5 || !name.includes(" ")) continue;
      const hit = sihaMessages.find((msg) =>
        (normName(`${msg.subject ?? ""} ${msg.bodyPreview ?? ""}`)).includes(name),
      );
      if (!hit) continue;
      const num = extractSihaNumber(`${hit.subject ?? ""} ${hit.bodyPreview ?? ""}`);
      if (!num) continue;
      numberUpdates.push({
        memberId: m.id,
        playerName: m.playerName,
        ageGroup: m.ageGroup,
        sihaNumber: num,
        matchedSubject: hit.subject ?? "",
        receivedAt: hit.receivedDateTime,
      });
    }

    return res.json({
      truncated,
      numberUpdates,
      seasonSince: since.slice(0, 10),
      emailsScanned: messages.length,
      sihaEmails: sihaMessages.length,
      alreadyRegistered: members.length - unregistered.length,
      candidates,
    });
  } catch (err: any) {
    req.log?.error?.(err, "siha scan failed");
    return res.status(502).json({ error: err?.message || "SIHA mailbox check failed" });
  }
});

// Mark the confirmed players as registered. Silent — no emails sent.
router.post("/siha/mark-registered", requireStaff, requireRegistrations, async (req, res) => {
  try {
    const memberIds: unknown = req.body?.memberIds ?? [];
    if (!Array.isArray(memberIds) || !memberIds.every((n) => Number.isInteger(n))) {
      return res.status(400).json({ error: "memberIds must be an array of ids" });
    }
    // Optional { "<memberId>": "SIHA-12345" } map of extracted registration numbers.
    const rawNumbers = req.body?.sihaNumbers;
    const sihaNumbers: Record<number, string> = {};
    if (rawNumbers && typeof rawNumbers === "object" && !Array.isArray(rawNumbers)) {
      for (const [k, v] of Object.entries(rawNumbers)) {
        const id = Number(k);
        if (Number.isInteger(id) && typeof v === "string" && v.trim() && v.trim().length <= 30) {
          sihaNumbers[id] = v.trim().toUpperCase();
        }
      }
    }
    const ids = memberIds as number[];
    if (ids.length === 0 && Object.keys(sihaNumbers).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }
    let registeredCount = 0;
    if (ids.length > 0) {
      const updated = await db
        .update(membersTable)
        .set({ sihaRegistered: 1 })
        .where(inArray(membersTable.id, ids))
        .returning({ id: membersTable.id });
      registeredCount = updated.length;
    }
    let numbersSaved = 0;
    for (const [idStr, num] of Object.entries(sihaNumbers)) {
      const id = Number(idStr);
      await db.update(membersTable).set({ sihaNumber: num }).where(eq(membersTable.id, id));
      numbersSaved++;
    }
    return res.json({ ok: true, updated: registeredCount, numbersSaved });
  } catch (err) {
    return res.status(500).json({ error: "Failed to mark players as registered" });
  }
});

export default router;
