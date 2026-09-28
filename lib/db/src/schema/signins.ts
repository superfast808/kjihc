import { pgTable, text, serial, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";

export const signinsTable = pgTable("kjihc_signins", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  session: text("session").notNull(),
  missReason: text("miss_reason"),
  sessionDate: date("session_date", { mode: "string" }).notNull(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSigninSchema = createInsertSchema(signinsTable).omit({ id: true, createdAt: true });
export type InsertSignin = z.infer<typeof insertSigninSchema>;
export type Signin = typeof signinsTable.$inferSelect;
