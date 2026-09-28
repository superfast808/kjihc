import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * Tracks which scheduled reminder pushes have been sent for an event,
 * so the reminder scheduler never sends the same notification twice.
 * kind examples: "morning", "meet2h".
 */
export const eventRemindersTable = pgTable("kjihc_event_reminders", {
  id:        serial("id").primaryKey(),
  eventId:   integer("event_id").notNull(),
  kind:      text("kind").notNull(),
  sentAt:    timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [unique().on(t.eventId, t.kind)]);
