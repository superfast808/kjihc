import webpush from "web-push";
import { db, parentWebSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const vapidPublicKey  = process.env["VAPID_PUBLIC_KEY"]  ?? "";
const vapidPrivateKey = process.env["VAPID_PRIVATE_KEY"] ?? "";
const vapidEmail      = process.env["VAPID_EMAIL"]       ?? "info@kjihc.co.uk";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey);
}

export { vapidPublicKey };

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a web push notification to all registered browser subscriptions for a
 * given parent email address.  Removes stale subscriptions automatically.
 */
export async function sendWebPushToEmail(email: string, payload: PushPayload): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) return;

  const rows = await db
    .select()
    .from(parentWebSubscriptionsTable)
    .where(eq(parentWebSubscriptionsTable.email, email));

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        // 410 Gone / 404 Not Found = subscription is expired; clean it up
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db
            .delete(parentWebSubscriptionsTable)
            .where(eq(parentWebSubscriptionsTable.endpoint, row.endpoint));
        }
      }
    }),
  );
}

/**
 * Broadcast a web push notification to ALL parents who have subscribed.
 * Used for club-wide announcements.
 */
export async function broadcastWebPush(payload: PushPayload): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) return;

  const rows = await db.select().from(parentWebSubscriptionsTable);

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db
            .delete(parentWebSubscriptionsTable)
            .where(eq(parentWebSubscriptionsTable.endpoint, row.endpoint));
        }
      }
    }),
  );
}
