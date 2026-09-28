import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { membersTable } from "./members";

export const eventRsvpTable = pgTable("kjihc_event_rsvp", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("maybe"), // yes | no | maybe
  reason: text("reason"),                             // absence reason (optional, used when status = 'no')
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("uq_event_rsvp").on(t.eventId, t.memberId)]);

export const insertEventRsvpSchema = createInsertSchema(eventRsvpTable).omit({ id: true, updatedAt: true });
export type InsertEventRsvp = z.infer<typeof insertEventRsvpSchema>;
export type EventRsvp = typeof eventRsvpTable.$inferSelect;
