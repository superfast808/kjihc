import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireStaff, requireSuperUser } from "../middlewares/auth";
import { getSmtpSettings } from "../lib/email";
import nodemailer from "nodemailer";

const router = Router();

// Public — club info needed for join wizard (bank details + heja codes)
router.get("/join/club-info", async (_req, res): Promise<void> => {
  try {
    const settings = await db.execute(sql`SELECT key, value FROM kjihc_settings ORDER BY key`);
    // Public allowlist ONLY — never expose SMTP, Stripe, or Microsoft credentials here.
    const isPublicKey = (key: string) =>
      key.startsWith("bank_") || key.startsWith("heja") || key.startsWith("club_") ||
      key === "stripe_publishable_key";
    const map: Record<string, string> = {};
    for (const row of settings.rows as any[]) {
      if (isPublicKey(String(row.key))) map[row.key] = row.value;
    }
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Staff — read all settings with labels (smtp_pass is masked)
router.get("/settings", requireStaff, async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(sql`SELECT key, value, label FROM kjihc_settings ORDER BY key`);
    const masked = (rows.rows as any[]).map(r => ({
      ...r,
      value: ["smtp_pass", "ms_client_secret"].includes(r.key) ? (r.value ? "__SET__" : "") : r.value,
    }));
    res.json(masked);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Superuser — test SMTP connection by sending a test email
router.post("/settings/smtp/test", requireSuperUser, async (req, res): Promise<void> => {
  const { to } = req.body as { to?: string };
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    res.status(400).json({ error: "Provide a valid 'to' email address for the test." });
    return;
  }

  let settings: Awaited<ReturnType<typeof getSmtpSettings>>;
  try {
    settings = await getSmtpSettings();
  } catch (err: any) {
    res.status(422).json({ error: err.message ?? "SMTP not configured." });
    return;
  }

  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.user, pass: settings.pass },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transport.verify();
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    let hint = "";

    if (msg.includes("535") || msg.includes("Authentication unsuccessful") || msg.includes("EAUTH")) {
      if (settings.host.includes("office365") || settings.host.includes("outlook")) {
        hint =
          "Microsoft 365 has disabled SMTP Basic Auth. Fix options: " +
          "(1) In the M365 Admin Centre go to Users → Active users → select the mailbox → Mail → Manage email apps and enable 'Authenticated SMTP'. " +
          "(2) If the account has MFA, generate an App Password and use that instead of the regular password. " +
          "(3) Switch to a transactional provider like Resend (smtp.resend.com, port 465, user 'resend', pass = API key) — no M365 restrictions.";
      } else {
        hint = "Authentication failed. Double-check the SMTP username and password. For Gmail, use an App Password, not your regular password.";
      }
    } else if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT")) {
      hint = `Could not reach ${settings.host}:${settings.port}. Check the host and port, and ensure outbound SMTP is not blocked by a firewall.`;
    }

    res.status(422).json({ error: msg, hint: hint || undefined });
    return;
  }

  try {
    await transport.sendMail({
      from: settings.from,
      to,
      subject: "KJIHC SMTP test — connection OK",
      text: `This is a test email from the KJIHC Club Management system.\n\nSMTP host: ${settings.host}:${settings.port}\nSending as: ${settings.from}\n\nIf you received this, your email delivery settings are working correctly.`,
      html: `<p>This is a test email from the <strong>KJIHC Club Management</strong> system.</p>
<p><strong>SMTP host:</strong> ${settings.host}:${settings.port}<br/>
<strong>Sending as:</strong> ${settings.from}</p>
<p style="color:green;font-weight:bold;">✓ If you received this, your email delivery settings are working correctly.</p>`,
    });
    res.json({ ok: true, message: `Test email sent to ${to}. Check your inbox.` });
  } catch (err: any) {
    res.status(422).json({ error: err?.message ?? String(err) });
  }
});

// Superuser — update a setting
router.put("/settings/:key", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const { key } = req.params;
    const { value } = req.body as { value: string };
    if (typeof value !== "string") { res.status(400).json({ error: "value must be a string" }); return; }
    // Don't overwrite smtp_pass if the client sent back the masked placeholder
    if (["smtp_pass", "ms_client_secret"].includes(String(key)) && value === "__SET__") { res.json({ ok: true }); return; }
    await db.execute(sql`
      INSERT INTO kjihc_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
