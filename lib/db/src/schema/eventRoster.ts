import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { membersTable } from "./members";

export const eventRosterTable = pgTable("kjihc_event_roster", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
}, (t) => [unique("uq_event_roster").on(t.eventId, t.memberId)]);

export const insertEventRosterSchema = createInsertSchema(eventRosterTable).omit({ id: true });
export type InsertEventRoster = z.infer<typeof insertEventRosterSchema>;
export type EventRoster = typeof eventRosterTable.$inferSelect;
