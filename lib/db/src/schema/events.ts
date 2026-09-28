import { pgTable, text, serial, integer, real, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";

export const eventsTable = pgTable("kjihc_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  eventType: text("event_type").notNull().default("training"), // training | game | social
  eventDate: date("event_date", { mode: "string" }).notNull(),
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time"), // HH:MM optional
  locationName: text("location_name").notNull().default(""),
  locationLat: real("location_lat"),
  locationLng: real("location_lng"),
  meetOffsetMins: integer("meet_offset_mins").notNull().default(60),
  ageGroups: text("age_groups").notNull().default(""), // comma-separated
  notes: text("notes"),
  isRosterRestricted: integer("is_roster_restricted").notNull().default(0),
  status: text("status").notNull().default("active"), // active | suggested | dismissed
  costPence: integer("cost_pence"), // optional per-player cost in pence (e.g. away-rink ice fee); null/0 = free
  snlFixtureId: integer("snl_fixture_id"), // external fixture id from kjihc.org, used to avoid re-importing
  createdByStaffId: integer("created_by_staff_id").references(() => staffTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
