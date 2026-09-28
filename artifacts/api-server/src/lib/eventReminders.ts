import { db, eventsTable, eventRemindersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "./logger";
import { notifyEventParents } from "../routes/events";

// ─── London wall-clock ⇄ UTC helpers ──────────────────────────────────────────
//
// The server runs in UTC but the club is in the UK, so "today" and the
// morning-reminder threshold must be evaluated in Europe/London local time.
// We derive the current UTC offset for London (which handles BST/GMT) using
// Intl's longOffset time-zone name, with no extra dependencies.

/** Returns London's UTC offset in minutes for the given instant (e.g. +60 for BST). */
function londonOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // tzName looks like "GMT", "GMT+01:00", "GMT-00:00" etc.
  const m = /GMT([+-])(\d{2}):?(\d{2})/.exec(tzName);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2]!, 10) * 60 + parseInt(m[3]!, 10));
}

/** The current London wall-clock date/time components for a given instant. */
function londonParts(at: Date): {
  year: number; month: number; day: number; hour: number; minute: number; dateStr: string;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  let hour = parseInt(p["hour"]!, 10);
  if (hour === 24) hour = 0; // en-GB midnight quirk
  return {
    year: parseInt(p["year"]!, 10),
    month: parseInt(p["month"]!, 10),
    day: parseInt(p["day"]!, 10),
    hour,
    minute: parseInt(p["minute"]!, 10),
    dateStr: `${p["year"]}-${p["month"]}-${p["day"]}`,
  };
}

/**
 * Converts a London wall-clock date ("YYYY-MM-DD") + time ("HH:MM") into the
 * corresponding UTC Date. We take the naive UTC instant for those wall-clock
 * numbers, then subtract London's offset at that instant.
 */
function londonWallClockToUtc(dateStr: string, timeStr: string): Date {
  const [y, mo, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const [h, mi] = timeStr.split(":").map((n) => parseInt(n, 10));
  const naive = Date.UTC(y!, (mo! - 1), d!, h ?? 0, mi ?? 0, 0, 0);
  // First-pass offset from the naive instant, then re-evaluate to be safe
  // around DST boundaries.
  let offset = londonOffsetMinutes(new Date(naive));
  let utcMs = naive - offset * 60_000;
  const offset2 = londonOffsetMinutes(new Date(utcMs));
  if (offset2 !== offset) {
    utcMs = naive - offset2 * 60_000;
  }
  return new Date(utcMs);
}

/** Formats a UTC Date as London HH:MM. */
function formatLondonHHMM(at: Date): string {
  const p = londonParts(at);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

// ─── Reminder tick ─────────────────────────────────────────────────────────────

const FIVE_MIN = 5 * 60_000;
const TWO_HOURS_MS = 2 * 60 * 60_000;

/**
 * Attempts to claim a (eventId, kind) reminder slot. Returns true if this
 * process won the race and should send; false if it was already sent.
 * Safe across restarts and multiple processes thanks to the unique index.
 */
async function claimReminder(eventId: number, kind: string): Promise<boolean> {
  const inserted = await db
    .insert(eventRemindersTable)
    .values({ eventId, kind })
    .onConflictDoNothing()
    .returning();
  return inserted.length > 0;
}

async function runReminderTick(): Promise<void> {
  const now = new Date();
  const today = londonParts(now).dateStr;

  // Load today's events in London terms.
  const events = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.eventDate, today));

  for (const event of events) {
    try {
      if (!event.startTime) continue;

      const startUtc = londonWallClockToUtc(event.eventDate, event.startTime);
      const meetOffset = event.meetOffsetMins ?? 60;
      const meetUtc = new Date(startUtc.getTime() - meetOffset * 60_000);
      const kickoffLondon = formatLondonHHMM(startUtc);
      const meetLondon = formatLondonHHMM(meetUtc);
      const isGame = event.eventType === "game" || event.eventType === "match";

      // ── morning reminder ──
      // Fire once London local time is at/after 08:00 on the event day and the
      // event has not started yet.
      const londonNow = londonParts(now);
      if (londonNow.hour >= 8 && now.getTime() < startUtc.getTime()) {
        if (await claimReminder(event.id, "morning")) {
          const title = isGame ? "Game day!" : "Event today";
          const body = `Today: ${event.title} at ${event.locationName}. Meet at ${meetLondon} (kick-off ${kickoffLondon}).`;
          await notifyEventParents(event, title, body, { eventId: event.id });
        }
      }

      // ── meet2h reminder ──
      // Fire within the 2-hour window immediately before meet time.
      if (
        now.getTime() >= meetUtc.getTime() - TWO_HOURS_MS &&
        now.getTime() < meetUtc.getTime()
      ) {
        if (await claimReminder(event.id, "meet2h")) {
          const title = isGame ? "Game day!" : "Event today";
          const body = `Time to get ready! Meet at ${meetLondon} for ${event.title} at ${event.locationName}.`;
          await notifyEventParents(event, title, body, { eventId: event.id });
        }
      }
    } catch (err) {
      logger.error({ err, eventId: event.id }, "Event reminder failed for event");
    }
  }
}

let started = false;

/**
 * Starts the periodic game-day reminder scheduler. Idempotent: calling it more
 * than once is a no-op. Skipped entirely under NODE_ENV=test.
 */
export function startEventReminderScheduler(): void {
  if (started) return;
  if (process.env.NODE_ENV === "test") return;
  started = true;

  const safeTick = () => {
    runReminderTick().catch((err) => {
      logger.error({ err }, "Event reminder tick failed");
    });
  };

  // One run shortly after startup, then every 5 minutes.
  setTimeout(safeTick, 15_000);
  setInterval(safeTick, FIVE_MIN);

  logger.info("Event reminder scheduler started");
}
