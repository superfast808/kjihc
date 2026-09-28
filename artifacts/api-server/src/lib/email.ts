import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function getSmtpSettings() {
  // DB settings take priority over env vars — allows admin to configure via UI
  let dbSettings: Record<string, string> = {};
  try {
    const rows = await db.execute(sql`SELECT key, value FROM kjihc_settings WHERE key LIKE 'smtp_%'`);
    for (const row of rows.rows as any[]) {
      if (row.value) dbSettings[row.key] = row.value;
    }
  } catch { /* fall back to env vars if DB unavailable */ }

  const host = dbSettings["smtp_host"] || process.env["SMTP_HOST"];
  const port = parseInt(dbSettings["smtp_port"] || process.env["SMTP_PORT"] || "587", 10);
  const user = dbSettings["smtp_user"] || process.env["SMTP_USER"];
  const pass = dbSettings["smtp_pass"] || process.env["SMTP_PASS"];
  const from = dbSettings["smtp_from"] || process.env["SMTP_FROM"] || "KJIHC <noreply@kjihc.org>";

  if (!host || !user || !pass) {
    throw new Error("SMTP not configured. Set SMTP settings in Club Settings or as environment variables.");
  }

  return { host, port, user, pass, from };
}

async function createTransport() {
  const { host, port, user, pass, from } = await getSmtpSettings();
  return {
    transport: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    }),
    from,
  };
}

import { getAppBaseUrl } from "./appUrl";
export { getAppBaseUrl };

const PARENT_PORTAL_URL = "https://join.kjihc.org/parent-login";

export { getSmtpSettings };

// ── Staff invite email ────────────────────────────────────────────────────────

const STAFF_PORTAL_URL = "https://join.kjihc.org";

export async function sendStaffInviteEmail(opts: {
  to: string;
  staffName: string;
  roleDescription: string;
  loginUrl?: string;
}): Promise<void> {
  const { transport, from } = await createTransport();
  const loginUrl = opts.loginUrl ?? STAFF_PORTAL_URL;

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#222;font-weight:bold;">
      Hi ${opts.staffName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:${C.bodyText};line-height:1.6;">
      You've been added to the <strong>KJIHC Staff Portal</strong> as:
    </p>
    <div style="background:${C.goldLight};border:1px solid #f6d060;border-radius:8px;
                padding:14px 20px;margin:0 0 24px;">
      <p style="margin:0;font-size:15px;color:#7a6000;font-weight:bold;">${opts.roleDescription}</p>
    </div>
    <p style="margin:0 0 20px;font-size:15px;color:${C.bodyText};line-height:1.6;">
      Click the button below to open the portal. If this is your first time, you'll be prompted
      to create a password or sign in with Google — use the email address this message was sent to.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
      <tr>
        <td align="center" style="background:${C.navy};border-radius:6px;padding:14px 36px;
                                  border:2px solid ${C.gold};">
          <a href="${loginUrl}" target="_blank"
             style="font-size:16px;font-weight:bold;color:${C.gold};text-decoration:none;
                    font-family:Arial,sans-serif;letter-spacing:0.3px;">
            Open Staff Portal →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 12px;font-size:14px;color:${C.mutedText};line-height:1.5;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#4a7fc1;word-break:break-all;">
      <a href="${loginUrl}" style="color:#4a7fc1;">${loginUrl}</a>
    </p>
    <div style="background:${C.mutedBg};border:1px solid ${C.border};border-radius:6px;
                padding:14px 18px;margin-bottom:4px;">
      <p style="margin:0;font-size:13px;color:#666;line-height:1.5;">
        <strong>Sign-in tip:</strong> Use <strong>${opts.to}</strong> as your email address.
        Choose "Sign in with Google" if that account is a Google account, or create a password
        on your first visit.
      </p>
    </div>
  `;

  await transport.sendMail({
    from,
    to: opts.to,
    subject: "You've been added to the KJIHC Staff Portal",
    html: emailWrapper(
      clubHeader("Staff Portal Access"),
      body,
      "Sent by KJIHC club administrators — contact your club admin if you have questions."
    ),
  });
}

// ── Code of Conduct reminder email ────────────────────────────────────────────

export async function sendCodeOfConductReminder(opts: {
  to: string;
  parentName: string;
  children: { name: string; ageGroup: string }[];
  portalUrl: string;
}): Promise<void> {
  const { transport, from } = await createTransport();

  const childList = opts.children
    .map(c => `<li style="margin:4px 0;font-size:15px;color:#444;">${c.name} <span style="color:#888;font-size:13px;">(${c.ageGroup})</span></li>`)
    .join("");

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#222;font-weight:bold;">
      Dear ${opts.parentName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:${C.bodyText};line-height:1.6;">
      It's time for your annual KJIHC Code of Conduct re-sign. We ask all families to read and
      re-sign the Code of Conduct each season to ensure everyone is on the same page and our club
      remains a safe, respectful environment for all.
    </p>
    <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#555;">This reminder applies to:</p>
    <ul style="margin:0 0 20px;padding-left:20px;">
      ${childList}
    </ul>
    <p style="margin:0 0 20px;font-size:15px;color:${C.bodyText};line-height:1.6;">
      Please click below to open your Parent Portal, read the Code of Conduct, and add your
      digital signature. The whole process takes about two minutes.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
      <tr>
        <td align="center" style="background:${C.gold};border-radius:6px;padding:14px 32px;">
          <a href="${opts.portalUrl}" target="_blank"
             style="font-size:16px;font-weight:bold;color:${C.navy};text-decoration:none;
                    font-family:Arial,sans-serif;letter-spacing:0.3px;">
            Sign Code of Conduct →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 12px;font-size:14px;color:${C.mutedText};line-height:1.5;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#4a7fc1;word-break:break-all;">
      <a href="${opts.portalUrl}" style="color:#4a7fc1;">${opts.portalUrl}</a>
    </p>
    <div style="background:${C.goldLight};border:1px solid #f6d060;border-radius:6px;padding:14px 18px;margin-bottom:16px;">
      <p style="margin:0;font-size:13px;color:#7a6000;line-height:1.5;">
        <strong>Note:</strong> This link is valid for 7 days and logs you straight into the
        Parent Portal. If it has expired, simply visit
        <a href="${PARENT_PORTAL_URL}" style="color:#7a6000;">${PARENT_PORTAL_URL}</a> to
        request a fresh link.
      </p>
    </div>
    <p style="margin:0;font-size:14px;color:${C.mutedText};line-height:1.5;">
      Thank you for being part of the KJIHC family and for helping us maintain the high standards
      that make our club special.
    </p>
  `;

  await transport.sendMail({
    from,
    to: opts.to,
    subject: "KJIHC — Annual Code of Conduct: signature required",
    html: emailWrapper(clubHeader("Annual Code of Conduct"), body, "Sent by KJIHC club administrators — do not reply to this email."),
  });
}

// ── Parent portal invite email ────────────────────────────────────────────────

/** Escape HTML special characters in user-provided values before interpolating into email HTML. */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function sendParentPortalInvite(opts: {
  to: string;
  parentName: string;
  children: { name: string; ageGroup: string }[];
}): Promise<void> {
  const { transport, from } = await createTransport();
  const safeParent = escapeHtml(opts.parentName);
  const safeTo = escapeHtml(opts.to);

  const childList = opts.children
    .map(c => `<li style="margin:4px 0;font-size:15px;color:#444;">${escapeHtml(c.name)} <span style="color:#888;font-size:13px;">(${escapeHtml(c.ageGroup)})</span></li>`)
    .join("");

  const body = `
    <p style="margin:0 0 16px;font-size:16px;color:#222;font-weight:bold;">
      Dear ${opts.parentName},
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:${C.bodyText};line-height:1.6;">
      The <strong>KJIHC Parent Portal</strong> is ready for you! It's your one place to see
      upcoming sessions and games, RSVP to events, keep your child's medical details up to date,
      message coaches, and stay on top of club news.
    </p>
    <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#555;">Your portal covers:</p>
    <ul style="margin:0 0 20px;padding-left:20px;">
      ${childList}
    </ul>
    <p style="margin:0 0 20px;font-size:15px;color:${C.bodyText};line-height:1.6;">
      Signing in is easy — no password needed. Tap the button below, enter this email address
      (<strong>${opts.to}</strong>), and we'll send you a secure sign-in link.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
      <tr>
        <td align="center" style="background:${C.gold};border-radius:6px;padding:14px 32px;">
          <a href="${PARENT_PORTAL_URL}" target="_blank"
             style="font-size:16px;font-weight:bold;color:${C.navy};text-decoration:none;
                    font-family:Arial,sans-serif;letter-spacing:0.3px;">
            Open the Parent Portal →
          </a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 12px;font-size:14px;color:${C.mutedText};line-height:1.5;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#4a7fc1;word-break:break-all;">
      <a href="${PARENT_PORTAL_URL}" style="color:#4a7fc1;">${PARENT_PORTAL_URL}</a>
    </p>
    <p style="margin:0;font-size:14px;color:${C.mutedText};line-height:1.5;">
      We look forward to seeing you there — the KJIHC team.
    </p>
  `;

  await transport.sendMail({
    from,
    to: opts.to,
    subject: "Your KJIHC Parent Portal is ready — sign in today",
    html: emailWrapper(clubHeader("Parent Portal Invitation"), body, "Sent by KJIHC club administrators — do not reply to this email."),
  });
}

// ── Shared email layout helpers ───────────────────────────────────────────────

/** Navy/gold KJIHC colour palette */
const C = {
  navy: "#001f3d",
  gold: "#f6a800",
  goldLight: "#fff8e1",
  bg: "#f4f7fb",
  white: "#ffffff",
  bodyText: "#444444",
  mutedText: "#888888",
  border: "#e8ecf0",
  mutedBg: "#f4f7fb",
};

function emailWrapper(headerHtml: string, bodyHtml: string, footerNote = "Automated message — please do not reply."): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:40px 0;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0"
           style="background:${C.white};border-radius:8px;overflow:hidden;
                  box-shadow:0 2px 8px rgba(0,0,0,0.08);border-top:4px solid ${C.gold};
                  max-width:580px;">
      <!-- Header -->
      <tr>
        <td align="center" style="background:${C.navy};padding:28px 40px;">
          ${headerHtml}
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:36px 40px 28px;">
          ${bodyHtml}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:${C.mutedBg};padding:16px 40px;border-top:1px solid ${C.border};text-align:center;">
          <p style="margin:0;font-size:12px;color:${C.mutedText};">
            &copy; Kilmarnock Junior Ice Hockey Club &bull; ${footerNote}
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`.trim();
}

/** Standard KJIHC email header with no emoji — uses text logo mark */
function clubHeader(subtitle?: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td align="center" style="border:2px solid ${C.gold};border-radius:8px;
            padding:6px 16px;margin-bottom:8px;">
          <span style="font-size:13px;font-weight:900;letter-spacing:3px;
                       color:${C.gold};font-family:Arial,sans-serif;">KJIHC</span>
        </td>
      </tr>
    </table>
    <p style="margin:10px 0 0;color:${C.white};font-size:17px;font-weight:bold;
              letter-spacing:0.5px;text-align:center;">
      Kilmarnock Junior Ice Hockey Club
    </p>
    ${subtitle ? `<p style="margin:6px 0 0;color:#b3c8ef;font-size:13px;text-align:center;">${subtitle}</p>` : ""}
  `;
}

// ── Flag notification email ───────────────────────────────────────────────────

export async function sendFlagEmail(opts: {
  to: string;
  playerName: string;
  parentName: string;
  flag: "siha_registered" | "fees_overdue";
}): Promise<void> {
  const { transport, from } = await createTransport();

  const subjects: Record<string, string> = {
    siha_registered: `${opts.playerName} is now SIHA registered`,
    fees_overdue: `Action needed — fees overdue for ${opts.playerName}`,
  };

  const bodies: Record<string, string> = {
    siha_registered: `
      <p style="margin:0 0 16px;font-size:15px;color:${C.bodyText};line-height:1.6;">
        Great news! <strong>${opts.playerName}</strong> has been registered with the
        <strong>Scottish Ice Hockey Association (SIHA)</strong> for this season.
        No further action is needed from you — this is just a confirmation.
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:${C.bodyText};line-height:1.6;">
        If you have any questions about the SIHA registration, please speak to your team manager.
      </p>`,
    fees_overdue: `
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#fff3cd;border-left:4px solid ${C.gold};border-radius:4px;margin-bottom:24px;">
        <tr><td style="padding:14px 18px;font-size:14px;color:#7a5800;">
          <strong>Your monthly fees for ${opts.playerName} are overdue.</strong>
          Please arrange payment as soon as possible to avoid missing ice time.
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:15px;color:${C.bodyText};line-height:1.6;">
        Fees are due by the <strong>5th of each month</strong>. If you believe this is an error
        or have already paid, please contact your team manager directly.
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:${C.bodyText};line-height:1.6;">
        You can view your child's account details at any time via the
        <a href="${PARENT_PORTAL_URL}" style="color:${C.navy};font-weight:bold;">Parent Portal</a>.
      </p>`,
  };

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:16px;color:#1a1a2e;">Hi ${opts.parentName},</p>
    ${bodies[opts.flag]}
  `;

  await transport.sendMail({
    from,
    to: opts.to,
    subject: subjects[opts.flag],
    html: emailWrapper(clubHeader(), bodyHtml),
    text: subjects[opts.flag],
  });
}

// ── Welcome email ─────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(opts: {
  to: string;
  playerName: string;
  parentName: string;
  ageGroup: string;
  hejaTeamCode: string | null;
  hejaMainCode: string | null;
  bankAccountName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  bankReferenceHint: string;
}): Promise<void> {
  const { transport, from } = await createTransport();

  const isLTP = ["LTP", "ltp", "lightning", "u10"].includes(opts.ageGroup?.toLowerCase() ?? "");

  const kitListHtml = isLTP ? `
    <h3 style="margin:20px 0 10px;font-size:16px;color:${C.navy};">Starter Kit — What to bring</h3>
    <p style="margin:0 0 8px;font-size:14px;color:#555;">For LTP / beginners you'll need:</p>
    <ul style="margin:0 0 12px;padding-left:20px;font-size:14px;color:#333;line-height:1.9;">
      <li><strong>Helmet with full cage</strong> (mandatory — no open cage)</li>
      <li>Neck guard</li>
      <li>Shoulder pads</li>
      <li>Elbow pads</li>
      <li>Hockey gloves</li>
      <li>Shin pads with knee caps</li>
      <li>Skates (figure skates are fine to start)</li>
      <li>Junior hockey stick</li>
      <li>Comfortable sports clothing underneath</li>
    </ul>
    <p style="margin:0 0 16px;font-size:13px;color:#888;">Second-hand equipment is perfectly fine. Ask your coach if you're unsure about sizing.</p>
  ` : `
    <h3 style="margin:20px 0 10px;font-size:16px;color:${C.navy};">Kit List</h3>
    <ul style="margin:0 0 12px;padding-left:20px;font-size:14px;color:#333;line-height:1.9;">
      <li>Helmet with full cage</li>
      <li>Neck guard</li>
      <li>Shoulder pads</li>
      <li>Elbow pads</li>
      <li>Hockey gloves</li>
      <li>Shin pads</li>
      <li>Jock / girdle</li>
      <li>Skates</li>
      <li>Hockey stick</li>
    </ul>
    <p style="margin:0 0 16px;font-size:13px;color:#888;">Your KJIHC jersey will be confirmed by your coach.</p>
  `;

  const bankHtml = (opts.bankSortCode && opts.bankAccountNumber) ? `
    <h3 style="margin:20px 0 10px;font-size:16px;color:${C.navy};">Monthly Fees — Standing Order</h3>
    <p style="margin:0 0 8px;font-size:14px;color:#555;">Please set up a standing order to arrive by the <strong>5th of each month</strong>:</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#f8faff;border:1px solid #dde4f0;border-radius:6px;margin-bottom:16px;">
      <tr><td style="padding:10px 16px;font-size:13px;color:#555;border-bottom:1px solid #eef0f6;"><strong>Account Name</strong></td><td style="padding:10px 16px;font-size:13px;color:#333;">${opts.bankAccountName}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#555;border-bottom:1px solid #eef0f6;"><strong>Sort Code</strong></td><td style="padding:10px 16px;font-size:13px;color:#333;font-family:monospace;">${opts.bankSortCode}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#555;border-bottom:1px solid #eef0f6;"><strong>Account Number</strong></td><td style="padding:10px 16px;font-size:13px;color:#333;font-family:monospace;">${opts.bankAccountNumber}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13px;color:#555;"><strong>Reference</strong></td><td style="padding:10px 16px;font-size:13px;color:#333;">${opts.bankReferenceHint}</td></tr>
    </table>
  ` : `
    <h3 style="margin:20px 0 10px;font-size:16px;color:${C.navy};">Monthly Fees</h3>
    <p style="margin:0 0 16px;font-size:14px;color:#555;">Bank details for your standing order will be sent separately by your coach. Fees are due by the <strong>5th of each month</strong>.</p>
  `;

  const hejaHtml = (opts.hejaTeamCode || opts.hejaMainCode) ? `
    <h3 style="margin:20px 0 10px;font-size:16px;color:${C.navy};">Join the Team on Heja</h3>
    <p style="margin:0 0 10px;font-size:14px;color:#555;">Download the <strong>Heja</strong> app to stay up to date with sessions, announcements and team news:</p>
    <table cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
      <tr>
        <td style="padding-right:10px;">
          <a href="https://apps.apple.com/app/heja-team-sports-app/id1041817956"
             style="display:inline-block;background:#000;color:#fff;font-size:13px;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:6px;">App Store</a>
        </td>
        <td>
          <a href="https://play.google.com/store/apps/details?id=com.heja.android"
             style="display:inline-block;background:#01875f;color:#fff;font-size:13px;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:6px;">Google Play</a>
        </td>
      </tr>
    </table>
    ${opts.hejaTeamCode ? `<p style="margin:8px 0 4px;font-size:13px;color:#555;">Your team join code:</p><p style="margin:0 0 8px;font-size:22px;font-weight:900;font-family:monospace;letter-spacing:4px;color:${C.navy};">${opts.hejaTeamCode}</p>` : ""}
    ${opts.hejaMainCode ? `<p style="margin:4px 0 4px;font-size:13px;color:#555;">Main club group code (all members):</p><p style="margin:0 0 16px;font-size:22px;font-weight:900;font-family:monospace;letter-spacing:4px;color:${C.navy};">${opts.hejaMainCode}</p>` : ""}
  ` : "";

  const bodyHtml = `
    <p style="margin:0 0 12px;font-size:16px;color:#1a1a2e;line-height:1.6;">Hi ${opts.parentName},</p>
    <p style="margin:0 0 20px;font-size:15px;color:${C.bodyText};line-height:1.6;">
      <strong>${opts.playerName}</strong> is now registered with KJIHC — we're delighted to have them on the ice!
      Here's everything you need to get started.
    </p>
    ${hejaHtml}
    ${kitListHtml}
    ${bankHtml}
    <h3 style="margin:20px 0 10px;font-size:16px;color:${C.navy};">Parent Portal</h3>
    <p style="margin:0 0 12px;font-size:14px;color:#555;">
      View your child's schedule, RSVP to events, and stay up to date with the club any time:
    </p>
    <p style="margin:0 0 20px;">
      <a href="${PARENT_PORTAL_URL}" style="color:${C.navy};font-weight:bold;">${PARENT_PORTAL_URL}</a>
    </p>
    <h3 style="margin:20px 0 10px;font-size:16px;color:${C.navy};">Follow us on Facebook</h3>
    <p style="margin:0 0 8px;font-size:14px;color:#555;">Stay connected with club news, photos and results:</p>
    <a href="https://www.facebook.com/kjihcuk"
       style="display:inline-block;background:#1877f2;color:#fff;font-size:13px;font-weight:bold;
              text-decoration:none;padding:10px 20px;border-radius:6px;margin-bottom:20px;">
      Follow KJIHC on Facebook
    </a>
  `;

  await transport.sendMail({
    from,
    to: opts.to,
    subject: `Welcome to KJIHC, ${opts.playerName}! Your next steps`,
    html: emailWrapper(clubHeader("Welcome to the Club!"), bodyHtml),
    text: `Welcome to KJIHC! ${opts.playerName} is registered. Download Heja: https://heja.io — Team code: ${opts.hejaTeamCode ?? "see app"}.`,
  });
}

// ── Parent magic-link email ───────────────────────────────────────────────────

export async function sendParentMagicLink(
  email: string,
  token: string,
): Promise<void> {
  const { transport, from } = await createTransport();
  const baseUrl = getAppBaseUrl();

  // The CTA links to an HTTPS redirect page on the API server.
  // Email clients block non-http custom scheme URLs (kjihc-parents://) from being
  // clickable. The HTTPS redirect page is allowed by all email clients; it then
  // immediately tries the custom scheme in the mobile browser (which does allow it),
  // and falls back to the web portal after 2 s if the app isn't installed.
  const redirectUrl = `${baseUrl}/api/parent/link-redirect?token=${encodeURIComponent(token)}`;
  const webFallbackUrl = `${baseUrl}/parent?token=${encodeURIComponent(token)}`;

  // Split the token into 4-char groups for easier reading / copying
  const tokenDisplay = token.match(/.{1,8}/g)?.join(' ') ?? token;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:#1a1a2e;line-height:1.6;">Hi there,</p>
    <p style="margin:0 0 24px;font-size:15px;color:${C.bodyText};line-height:1.6;">
      You requested a login link for the <strong>KJIHC Parent Portal</strong>.
      Tap the button below — it will open the portal and sign you in automatically.
    </p>

    <!-- Primary CTA — links to HTTPS redirect page (works in all email clients) -->
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
      <tr>
        <td align="center" bgcolor="${C.navy}" style="border-radius:6px;">
          <a href="${redirectUrl}"
             style="display:inline-block;padding:15px 36px;color:${C.white};
                    font-size:16px;font-weight:bold;text-decoration:none;
                    letter-spacing:0.5px;">
            Open Parent App
          </a>
        </td>
      </tr>
    </table>

    <!-- One-time use notice -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:${C.goldLight};border-left:4px solid ${C.gold};
                  border-radius:4px;margin-bottom:28px;">
      <tr>
        <td style="padding:12px 16px;font-size:14px;color:#7a5800;">
          <strong>This link works once</strong> and expires in 10 minutes.
          Once you sign in, you will stay logged in for 30 days.
        </td>
      </tr>
    </table>

    <!-- Manual code fallback -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border:1px solid ${C.border};border-radius:8px;margin-bottom:24px;overflow:hidden;">
      <tr>
        <td style="background:${C.mutedBg};padding:12px 16px;border-bottom:1px solid ${C.border};">
          <p style="margin:0;font-size:12px;font-weight:bold;color:#555;
                    text-transform:uppercase;letter-spacing:0.8px;">
            Or enter this code manually in the app
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 16px;text-align:center;">
          <p style="margin:0 0 6px;font-size:11px;color:#888;">
            Open the Parent Portal, tap <em>Already have a code?</em> and paste:
          </p>
          <p style="margin:0;font-family:Courier New,Courier,monospace;
                    font-size:15px;font-weight:bold;color:${C.navy};
                    letter-spacing:2px;word-break:break-all;line-height:2;">
            ${tokenDisplay}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:${C.mutedText};line-height:1.6;">
      If you didn't request this, you can safely ignore it — no account has been accessed.<br/><br/>
      On a computer, or if the button doesn't open the app:<br/>
      <a href="${webFallbackUrl}" style="color:${C.navy};word-break:break-all;">${webFallbackUrl}</a>
    </p>
  `;

  await transport.sendMail({
    from,
    to: email,
    subject: "Your KJIHC Parent Portal login link",
    html: emailWrapper(clubHeader("Parent Portal"), bodyHtml),
    text: `KJIHC Parent Portal login link:\n\n${redirectUrl}\n\nThis link works once and expires in 10 minutes. After signing in you stay logged in for 30 days.\n\nWeb fallback: ${webFallbackUrl}`,
  });
}
