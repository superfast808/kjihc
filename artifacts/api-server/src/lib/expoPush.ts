/**
 * Expo Push Notification helper
 * Sends notifications to one or more Expo push tokens via the Expo push API.
 */

import { logger } from "./logger";

export interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Send push notifications in chunks of up to 100 tokens (Expo limit).
 * Fire-and-forget — errors are logged but not thrown so they never break the
 * caller's request/response cycle.
 */
export async function sendExpoPushNotifications(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  // Expo accepts up to 100 messages per request
  const CHUNK = 100;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        logger.warn({ status: res.status, body: text }, "Expo push API non-OK response");
      }
    } catch (err) {
      logger.error({ err }, "Failed to send Expo push notification chunk");
    }
  }
}

/** Returns true if the token looks like a valid Expo push token. */
export function isValidExpoPushToken(token: string): boolean {
  return (
    token.startsWith("ExponentPushToken[") ||
    token.startsWith("ExpoPushToken[") ||
    /^[a-zA-Z0-9_-]{20,}$/.test(token) // simulator tokens
  );
}
