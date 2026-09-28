import { Router } from "express";
import { isAllowedReturnUrl } from "./eventPayments";
import { getAppBaseUrl } from "../lib/appUrl";
import { db, membersTable, parentTokensTable, signinsTable, parentDevicesTable, parentWebSubscriptionsTable, uploadGrantsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { eq, and, gt, gte, lte, sql, isNull } from "drizzle-orm";
import { isValidExpoPushToken } from "../lib/expoPush";
import { vapidPublicKey } from "../lib/webPush";
import { randomBytes } from "crypto";
import { sendParentMagicLink } from "../lib/email";
import { getAuth, clerkClient } from "@clerk/express";
import {
  RequestParentLinkBody,
  VerifyParentTokenBody,
  GetParentChildrenQueryParams,
  ParentPatchChildParams,
  ParentPatchChildBody,
  ParentOauthLoginBody,
} from "@workspace/api-zod";
import { OAuth2Client } from "google-auth-library";
import { createRemoteJWKSet, jwtVerify } from "jose";

const router = Router();
const storage = new ObjectStorageService();

// ─── Token extraction ─────────────────────────────────────────────────────────
// Reads the parent session token from Authorization: Bearer <token> header first,
// then falls back to the query string or request body for backward compatibility
// with the existing web portal flow.

function extractParentToken(req: import("express").Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) return auth.slice(7);
  const fromQuery = typeof req.query.token === "string" ? req.query.token : null;
  const fromBody = typeof req.body?.token === "string" ? req.body.token : null;
  return fromQuery ?? fromBody ?? null;
}

const memberToDetail = (m: typeof membersTable.$inferSelect) => ({
  id: m.id,
  playerName: m.playerName,
  playerDob: m.playerDob,
  ageGroup: m.ageGroup,
  addAgeGroup: m.addAgeGroup,
  playerAddress1: m.playerAddress1,
  playerAddress2: m.playerAddress2,
  playerCity: m.playerCity,
  playerPost: m.playerPost,
  playerParent: m.playerParent,
  playerContactTel: m.playerContactTel,
  playerEmail: m.playerEmail,
  playerMedicalnotes: m.playerMedicalnotes,
  playerMedication: m.playerMedication,
  playerFee: m.playerFee,
  agreeFee: m.agreeFee,
  agreeGdpr: m.agreeGdpr,
  agreePhoto: m.agreePhoto,
  readCode: m.readCode,
  codeSignedAt: m.codeSignedAt?.toISOString() ?? null,
  medicalUpdatedByParentAt: m.medicalUpdatedByParentAt?.toISOString() ?? null,
  playerPhoto: m.playerPhoto ?? null,
  sihaRegistered: m.sihaRegistered ?? 0,
  feesOverdue: m.feesOverdue ?? 0,
  feesBalance: m.feesBalance != null ? parseFloat(m.feesBalance as string) : null,
});

/**
 * POST /parent/staff-parent-access
 *
 * Allows an authenticated staff member who is also a registered parent to
 * obtain a parent session token without going through the magic-link email
 * flow. Requires a valid Clerk session; no request body needed.
 *
 * Returns: { email, token, children } — same shape as verify-token so the
 * caller can redirect to /parent?token=<token> and use the portal normally.
 */
router.post("/parent/staff-parent-access", async (req, res): Promise<void> => {
  try {
    const { userId } = getAuth(req);
    if (!userId) { res.status(401).json({ error: "Staff sign-in required" }); return; }

    // Fetch the Clerk user to get their verified email addresses
    const clerkUser = await clerkClient.users.getUser(userId);
    const emails = clerkUser.emailAddresses.map(e => e.emailAddress.toLowerCase());

    // Find which (if any) of their emails is a registered parent email
    let parentEmail: string | null = null;
    for (const email of emails) {
      const rows = await db.select({ id: membersTable.id })
        .from(membersTable)
        .where(sql`lower(${membersTable.playerEmail}) = lower(${email})`)
        .limit(1);
      if (rows.length > 0) { parentEmail = email; break; }
    }

    if (!parentEmail) {
      res.status(404).json({
        error: "No players are linked to your staff account. Ask your club administrator if your parent email differs from your staff login.",
      });
      return;
    }

    // Issue a parent session token valid for 30 days (matches the OAuth and
    // magic-link session length so parents stay signed in on their devices)
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(parentTokensTable).values({ email: parentEmail, token, expiresAt });

    const children = await db.select().from(membersTable)
      .where(sql`lower(${membersTable.playerEmail}) = lower(${parentEmail})`);

    res.json({ email: parentEmail, token, children: children.map(memberToDetail) });
  } catch (err) {
    req.log.error({ err }, "Error in staff-parent-access");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── MAGIC-LINK REDIRECT ──────────────────────────────────────────────────────
// GET /parent/link-redirect?token=<token>
//
// Serves a small HTML redirect page that is safe to link from emails (email
// clients block non-http custom-scheme URLs). The page immediately tries the
// kjihc-parents:// custom scheme (works in standalone dev builds and production)
// and, in non-production environments, also tries the exp:// Expo Go scheme so
// developers can test the flow without needing an EAS build.
// After 2 s it falls back to the web parent portal as a safety net.

router.get("/parent/link-redirect", (req, res): void => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!token) {
    res.status(400).send("Missing token");
    return;
  }

  const encodedToken = encodeURIComponent(token);
  const baseUrl = getAppBaseUrl();

  // kjihc-mobile is the primary app (unified staff + parent).
  // kjihc-parents:// is kept as a secondary fallback for anyone still on the old standalone app.
  const customSchemeUrl  = `kjihc-mobile://(parent)?token=${encodedToken}`;
  const legacySchemeUrl  = `kjihc-parents://login?token=${encodedToken}`;

  // In non-production, also emit the Expo Go deep-link so testers running inside
  // Expo Go (which uses the exp:// scheme, not the app's custom scheme) can tap
  // the email button without needing a standalone dev build.
  //
  // Expo Go must connect to the Metro bundler, whose host is REPLIT_EXPO_DEV_DOMAIN
  // (the *.expo.riker.replit.dev domain), NOT the API server host.  These are
  // separate workflows/ports/domains in Replit.
  // Format: exp://<REPLIT_EXPO_DEV_DOMAIN>/--/(parent)?token=<token>
  const expoDevDomain = process.env["REPLIT_EXPO_DEV_DOMAIN"];
  const isDev = process.env["NODE_ENV"] !== "production";
  const expoGoUrl = (isDev && expoDevDomain)
    ? `exp://${expoDevDomain}/--/(parent)?token=${encodedToken}`
    : null;

  // Web fallback: in dev point straight at the kjihc-mobile Expo web preview so
  // the token is auto-verified there. In production fall back to the web portal.
  const webFallbackUrl = (isDev && expoDevDomain)
    ? `https://${expoDevDomain}/(parent)?token=${encodedToken}`
    : `${baseUrl}/parent?token=${encodedToken}`;

  // The JS tries kjihc-mobile:// first, then kjihc-parents:// (legacy), then Expo Go in dev.
  const expoGoScript = expoGoUrl
    ? `
      // Dev only — try Expo Go scheme (kjihc-mobile path)
      setTimeout(function () { window.location.href = ${JSON.stringify(expoGoUrl)}; }, 400);`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Opening KJIHC Parent App…</title>
  <style>
    body { margin: 0; font-family: Arial, Helvetica, sans-serif;
           background: #001f3d; color: #fff;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; text-align: center; padding: 24px; box-sizing: border-box; }
    .card { background: #fff; color: #001f3d; border-radius: 12px;
            padding: 36px 28px; max-width: 380px; width: 100%; }
    h1 { margin: 0 0 12px; font-size: 20px; }
    p { margin: 0 0 16px; font-size: 14px; color: #555; line-height: 1.5; }
    .spinner { width: 36px; height: 36px; border: 4px solid #e0e0e0;
               border-top-color: #001f3d; border-radius: 50%;
               animation: spin 0.8s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    a { color: #001f3d; font-weight: bold; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Opening Parent App…</h1>
    <p>If the app doesn't open automatically, use the link below to sign in via your browser.</p>
    <p><a href="${webFallbackUrl}">Open web portal instead</a></p>
  </div>
  <script>
    // Attempt 1: kjihc-mobile:// (unified app — installed dev build or production)
    window.location.href = ${JSON.stringify(customSchemeUrl)};
    // Attempt 2: kjihc-parents:// (legacy standalone app)
    setTimeout(function () { window.location.href = ${JSON.stringify(legacySchemeUrl)}; }, 300);
    ${expoGoScript}
    // Final fallback: web (auto-verifies token in kjihc-mobile web, or legacy portal in prod)
    setTimeout(function () { window.location.href = ${JSON.stringify(webFallbackUrl)}; }, 2200);
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // No-cache: every visit must get a fresh page with the correct token
  res.setHeader("Cache-Control", "no-store");
  res.send(html);
});

// ─── OAuth helpers ────────────────────────────────────────────────────────────

const googleClient = new OAuth2Client();

// Apple JWK set — fetched once and cached in-memory by jose
const appleJWKS = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

async function verifyGoogleIdToken(idToken: string): Promise<string> {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    // Audience verification: use GOOGLE_CLIENT_ID if configured; without it
    // google-auth-library still verifies the signature + expiry but skips
    // audience check, which is acceptable for this server-gated flow.
    ...(process.env["GOOGLE_CLIENT_ID"] && { audience: process.env["GOOGLE_CLIENT_ID"] }),
  });
  const payload = ticket.getPayload();
  const email = payload?.email;
  if (!email) throw new Error("Google token has no email claim");
  if (!payload?.email_verified) throw new Error("Google email is not verified");
  return email.toLowerCase();
}

async function verifyAppleIdToken(idToken: string): Promise<string> {
  const { payload } = await jwtVerify(idToken, appleJWKS, {
    issuer: "https://appleid.apple.com",
    // Audience (Service ID / bundle ID) check — use env var if configured
    ...(process.env["APPLE_APP_ID"] && { audience: process.env["APPLE_APP_ID"] }),
  });
  const email = payload["email"] as string | undefined;
  if (!email) throw new Error("Apple token has no email claim");
  return email.toLowerCase();
}

// ─── OAUTH LOGIN ──────────────────────────────────────────────────────────────
// POST /parent/oauth-login
// Body: { provider: "google" | "apple", idToken: string }
//
// Verifies the provider-issued ID token, extracts the email, checks it against
// registered parent records (same email-match logic as magic links), and issues
// a parent session token.

router.post("/parent/oauth-login", async (req, res): Promise<void> => {
  try {
    const parsed = ParentOauthLoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { provider, idToken } = parsed.data;

    let email: string;
    try {
      if (provider === "google") {
        email = await verifyGoogleIdToken(idToken);
      } else {
        email = await verifyAppleIdToken(idToken);
      }
    } catch (verifyErr) {
      req.log.warn({ verifyErr, provider }, "OAuth ID token verification failed");
      res.status(400).json({ error: "Invalid or unverifiable ID token" });
      return;
    }

    // Check the email is registered with the club (same logic as magic link)
    const children = await db.select().from(membersTable).where(sql`lower(${membersTable.playerEmail}) = lower(${email})`);
    if (children.length === 0) {
      res.status(401).json({
        error: "Your email isn't registered with the club — contact your coach to get access.",
      });
      return;
    }

    // Issue a parent session token (30-day expiry for OAuth — no link to expire)
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await db.insert(parentTokensTable).values({ email, token, expiresAt });

    req.log.info({ email, provider }, "Parent OAuth login successful");

    res.json({ email, token, children: children.map(memberToDetail) });
  } catch (err) {
    req.log.error({ err }, "Error in parent oauth-login");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/parent/request-link", async (req, res): Promise<void> => {
  try {
    const parsed = RequestParentLinkBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const email = parsed.data.email.toLowerCase().trim();

    // Check the parent has children registered
    const children = await db.select().from(membersTable).where(sql`lower(${membersTable.playerEmail}) = lower(${email})`);
    if (children.length === 0) {
      // Still return success to avoid email enumeration
      res.json({ message: "If we have your email on record, you will receive a login link shortly." });
      return;
    }

    // Create token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await db.insert(parentTokensTable).values({ email, token, expiresAt });

    // Send magic link email; log token as fallback if send fails
    try {
      await sendParentMagicLink(email, token);
      req.log.info({ email }, "Parent magic link email sent");
    } catch (emailErr) {
      req.log.error({ emailErr, email }, "Failed to send parent magic link email — token logged for recovery");
      req.log.info({ email, token, loginUrl: `/parent?token=${token}` }, "Parent login link (email failed)");
    }

    res.json({ message: "Login link sent! Check your email. The link expires in 10 minutes." });
  } catch (err) {
    req.log.error({ err }, "Error requesting parent link");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/parent/verify-token", async (req, res): Promise<void> => {
  try {
    const parsed = VerifyParentTokenBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    const { token } = parsed.data;
    const now = new Date();

    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, token), gt(parentTokensTable.expiresAt, now)));

    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    // Promote the short-lived magic-link token into a 30-day session so parents
    // stay signed in — the mobile/web clients keep using this same token.
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (tokenRow.expiresAt < sessionExpiry) {
      await db.update(parentTokensTable)
        .set({ expiresAt: sessionExpiry })
        .where(eq(parentTokensTable.id, tokenRow.id));
    }

    const children = await db.select().from(membersTable).where(sql`lower(${membersTable.playerEmail}) = lower(${tokenRow.email})`);

    res.json({
      email: tokenRow.email,
      children: children.map(memberToDetail),
    });
  } catch (err) {
    req.log.error({ err }, "Error verifying parent token");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/parent/children", async (req, res): Promise<void> => {
  try {
    const rawToken = extractParentToken(req);
    if (!rawToken) { res.status(401).json({ error: "Token required" }); return; }

    const now = new Date();
    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));

    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const children = await db.select().from(membersTable).where(sql`lower(${membersTable.playerEmail}) = lower(${tokenRow.email})`);
    res.json(children.map(memberToDetail));
  } catch (err) {
    req.log.error({ err }, "Error getting parent children");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/parent/children/:id/attendance", async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const rawToken = extractParentToken(req);
    if (!rawToken) { res.status(401).json({ error: "Token required" }); return; }

    const now = new Date();
    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));
    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const [child] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, id), sql`lower(${membersTable.playerEmail}) = lower(${tokenRow.email})`));
    if (!child) { res.status(403).json({ error: "Not authorized" }); return; }

    // Current season: Sep 1 – Aug 31
    const currentMonth = now.getMonth() + 1;
    const seasonStartYear = currentMonth >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    const seasonStart = `${seasonStartYear}-09-01`;
    const seasonEnd = `${seasonStartYear + 1}-08-31`;
    const season = `${seasonStartYear}/${String(seasonStartYear + 1).slice(-2)}`;

    const records = await db.select().from(signinsTable)
      .where(and(
        eq(signinsTable.memberId, id),
        gte(signinsTable.sessionDate, seasonStart),
        lte(signinsTable.sessionDate, seasonEnd),
      ));

    // missReason === null means the player attended; non-null means they missed with a reason.
    // There are no 'na' sentinel records — absent = missReason is set, present = missReason is null.
    const attended = records.filter(r => r.missReason === null).length;
    const total = records.length;

    res.json({ memberId: id, playerName: child.playerName, attended, total, currentSeason: season });
  } catch (err) {
    req.log.error({ err }, "Error getting child attendance");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DEVICE TOKEN: register / refresh Expo push token ────────────────────────
// POST /parent/device-token   { token: <expo-push-token> }
// Requires a valid parent session token in Authorization: Bearer header.

router.post("/parent/device-token", async (req, res): Promise<void> => {
  try {
    const rawToken = extractParentToken(req);
    if (!rawToken) { res.status(401).json({ error: "Token required" }); return; }
    const now = new Date();
    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));
    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const { expoPushToken } = req.body as { expoPushToken?: string };
    if (!expoPushToken || !isValidExpoPushToken(expoPushToken)) {
      res.status(400).json({ error: "Invalid expoPushToken" }); return;
    }

    // Upsert: one row per device token, update email if token already known
    await db
      .insert(parentDevicesTable)
      .values({ email: tokenRow.email, expoPushToken, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: parentDevicesTable.expoPushToken,
        set: { email: tokenRow.email, updatedAt: new Date() },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error registering device token");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DEVICE TOKEN: remove push token on sign-out ─────────────────────────────
// DELETE /parent/device-token   { expoPushToken: <token> }
// Only removes the token when it belongs to the authenticated parent.

router.delete("/parent/device-token", async (req, res): Promise<void> => {
  try {
    const rawToken = extractParentToken(req);
    if (!rawToken) { res.status(401).json({ error: "Token required" }); return; }
    const now = new Date();
    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));
    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const { expoPushToken } = req.body as { expoPushToken?: string };
    if (!expoPushToken) { res.status(400).json({ error: "expoPushToken required" }); return; }

    // Only delete the token when it belongs to this authenticated parent
    await db.delete(parentDevicesTable)
      .where(and(
        eq(parentDevicesTable.expoPushToken, expoPushToken),
        eq(parentDevicesTable.email, tokenRow.email),
      ));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error removing device token");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── WEB PUSH: return VAPID public key ───────────────────────────────────────
// GET /parent/vapid-public-key  (no auth required — public key is not secret)

router.get("/parent/vapid-public-key", (_req, res): void => {
  res.json({ publicKey: vapidPublicKey });
});

// ─── WEB PUSH: register subscription ─────────────────────────────────────────
// POST /parent/web-push-subscribe  { endpoint, p256dh, auth }
// Requires a valid parent session token in Authorization: Bearer header.

router.post("/parent/web-push-subscribe", async (req, res): Promise<void> => {
  try {
    const rawToken = extractParentToken(req);
    if (!rawToken) { res.status(401).json({ error: "Token required" }); return; }
    const now = new Date();
    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));
    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const { endpoint, p256dh, auth } = req.body as { endpoint?: string; p256dh?: string; auth?: string };
    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: "endpoint, p256dh and auth are required" }); return;
    }

    await db
      .insert(parentWebSubscriptionsTable)
      .values({ email: tokenRow.email, endpoint, p256dh, auth, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: parentWebSubscriptionsTable.endpoint,
        set: { email: tokenRow.email, p256dh, auth, updatedAt: new Date() },
      });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error registering web push subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── WEB PUSH: remove subscription ───────────────────────────────────────────
// DELETE /parent/web-push-subscribe  { endpoint }
// Only removes the subscription when it belongs to the authenticated parent.

router.delete("/parent/web-push-subscribe", async (req, res): Promise<void> => {
  try {
    const rawToken = extractParentToken(req);
    if (!rawToken) { res.status(401).json({ error: "Token required" }); return; }
    const now = new Date();
    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));
    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) { res.status(400).json({ error: "endpoint required" }); return; }

    await db.delete(parentWebSubscriptionsTable)
      .where(and(
        eq(parentWebSubscriptionsTable.endpoint, endpoint),
        eq(parentWebSubscriptionsTable.email, tokenRow.email),
      ));

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error removing web push subscription");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/parent/children/:id", async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const parsed = ParentPatchChildBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token: _bodyToken, ...updateData } = parsed.data;
    const rawToken = extractParentToken(req);
    if (!rawToken) { res.status(401).json({ error: "Token required" }); return; }
    const now = new Date();

    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));

    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    // Verify this child belongs to the parent
    const [child] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, id), sql`lower(${membersTable.playerEmail}) = lower(${tokenRow.email})`));

    if (!child) { res.status(403).json({ error: "Not authorized to edit this member" }); return; }

    // Stamp timestamp when parent touches medical fields
    const medicalFields = ["playerMedicalnotes", "playerMedication"] as const;
    const hasMedicalUpdate = medicalFields.some(f => f in updateData);
    const setData = hasMedicalUpdate
      ? { ...updateData, medicalUpdatedByParentAt: new Date() }
      : updateData;

    const [updated] = await db.update(membersTable).set(setData).where(eq(membersTable.id, id)).returning();
    res.json(memberToDetail(updated));
  } catch (err) {
    req.log.error({ err }, "Error updating child by parent");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /parent/children/:id/sign-conduct ────────────────────────────────────
// Parent digitally signs the code of conduct for a child

router.post("/parent/children/:id/sign-conduct", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params["id"] as string, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const rawToken = extractParentToken(req);
    if (!rawToken) { res.status(401).json({ error: "Token required" }); return; }
    const now = new Date();

    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));
    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const [child] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, id), sql`lower(${membersTable.playerEmail}) = lower(${tokenRow.email})`));
    if (!child) { res.status(403).json({ error: "Not authorized" }); return; }

    const [updated] = await db.update(membersTable)
      .set({ readCode: 1, codeSignedAt: now })
      .where(eq(membersTable.id, id))
      .returning();

    res.json(memberToDetail(updated));
  } catch (err) {
    req.log.error({ err }, "Error signing conduct");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Player photo upload ───────────────────────────────────────────────────────

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function resolveParentChild(
  req: import("express").Request,
  res: import("express").Response,
): Promise<{ tokenRow: { email: string }; member: typeof membersTable.$inferSelect } | null> {
  const rawToken = extractParentToken(req);
  if (!rawToken) { res.status(401).json({ error: "No token" }); return null; }
  const now = new Date();
  const [tokenRow] = await db.select().from(parentTokensTable)
    .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));
  if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return null; }
  const memberId = Number(req.params.memberId);
  const [member] = await db.select().from(membersTable).where(eq(membersTable.id, memberId));
  if (!member || member.playerEmail.toLowerCase() !== tokenRow.email.toLowerCase()) {
    res.status(403).json({ error: "Forbidden" }); return null;
  }
  return { tokenRow, member };
}

/**
 * POST /parent/me/children/:memberId/photo/request-url
 * Returns a signed PUT URL for uploading a player photo.
 */
router.post("/parent/me/children/:memberId/photo/request-url", async (req, res): Promise<void> => {
  try {
    const ctx = await resolveParentChild(req, res);
    if (!ctx) return;

    const { contentType } = req.body as { contentType?: string };
    if (!contentType || !PHOTO_TYPES.has(contentType)) {
      res.status(400).json({ error: "Only jpeg/png/webp photos are allowed" }); return;
    }

    const uploadUrl = await storage.getObjectEntityUploadURL();
    const rawPath = uploadUrl.split("?")[0];
    const objectPath = storage.normalizeObjectEntityPath(rawPath);
    // Bind the minted object path to this parent so confirm can verify it
    await db.insert(uploadGrantsTable).values({
      objectPath,
      uploaderParentId: ctx.tokenRow.email.toLowerCase(),
      mimeType: contentType,
      maxBytes: 10 * 1024 * 1024,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    res.json({ uploadUrl, objectPath });
  } catch (err) {
    req.log.error({ err }, "Error requesting photo upload URL");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /parent/me/children/:memberId/photo/confirm
 * Saves the objectPath returned after a successful PUT upload.
 */
router.post("/parent/me/children/:memberId/photo/confirm", async (req, res): Promise<void> => {
  try {
    const ctx = await resolveParentChild(req, res);
    if (!ctx) return;

    const { objectPath } = req.body as { objectPath?: string };
    if (!objectPath || !objectPath.startsWith("/objects/")) {
      res.status(400).json({ error: "Invalid objectPath" }); return;
    }

    const [grant] = await db.select().from(uploadGrantsTable).where(and(
      eq(uploadGrantsTable.objectPath, objectPath),
      isNull(uploadGrantsTable.consumedAt),
      gt(uploadGrantsTable.expiresAt, new Date()),
      eq(uploadGrantsTable.uploaderParentId, ctx.tokenRow.email.toLowerCase()),
    ));
    if (!grant) { res.status(403).json({ error: "Upload not recognised" }); return; }
    await db.update(uploadGrantsTable)
      .set({ consumedAt: new Date() })
      .where(eq(uploadGrantsTable.id, grant.id));

    await db.update(membersTable)
      .set({ playerPhoto: objectPath })
      .where(eq(membersTable.id, ctx.member.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error confirming photo upload");
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /parent/me/children/:memberId/photo-url
 * Returns a short-lived signed GET URL for the player's photo.
 */
router.get("/parent/me/children/:memberId/photo-url", async (req, res): Promise<void> => {
  try {
    const ctx = await resolveParentChild(req, res);
    if (!ctx) return;

    if (!ctx.member.playerPhoto) {
      res.status(404).json({ error: "No photo" }); return;
    }
    const url = await storage.getObjectEntityDownloadURL(ctx.member.playerPhoto);
    res.json({ url });
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "No photo" }); return;
    }
    req.log.error({ err }, "Error getting photo URL");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /parent/me/payment/create-checkout
// Creates a Stripe Checkout Session for the authenticated parent to settle fees.
router.post("/parent/me/payment/create-checkout", async (req, res): Promise<void> => {
  try {
    const rawToken = extractParentToken(req);
    if (!rawToken) { res.status(401).json({ error: "Token required" }); return; }

    const { childId, amountPence, successUrl, cancelUrl } = req.body as {
      childId: number; amountPence: number; successUrl: string; cancelUrl: string;
    };

    if (!amountPence || amountPence < 50) {
      res.status(400).json({ error: "Minimum payment is £0.50" }); return;
    }
    if (!successUrl || !cancelUrl || !isAllowedReturnUrl(successUrl) || !isAllowedReturnUrl(cancelUrl)) {
      res.status(400).json({ error: "Invalid return URL" }); return;
    }

    const now = new Date();
    const [tokenRow] = await db.select().from(parentTokensTable)
      .where(and(eq(parentTokensTable.token, rawToken), gt(parentTokensTable.expiresAt, now)));
    if (!tokenRow) { res.status(401).json({ error: "Invalid or expired token" }); return; }

    const [child] = await db.select().from(membersTable)
      .where(and(eq(membersTable.id, childId), sql`lower(${membersTable.playerEmail}) = lower(${tokenRow.email})`));
    if (!child) { res.status(403).json({ error: "Not authorized" }); return; }

    const settingRows = await db.execute(sql`SELECT value FROM kjihc_settings WHERE key = 'stripe_secret_key'`);
    const stripeSecretKey = (settingRows.rows[0] as any)?.value as string | undefined;
    if (!stripeSecretKey) {
      res.status(503).json({ error: "Online payments are not yet configured. Please contact the club." }); return;
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-06-30.basil" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(amountPence),
          product_data: { name: `Club fees — ${child.playerName}` },
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: tokenRow.email,
      metadata: { childId: String(childId), childName: child.playerName },
    });

    res.json({ checkoutUrl: session.url });
  } catch (err) {
    req.log.error({ err }, "Error creating Stripe checkout");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
