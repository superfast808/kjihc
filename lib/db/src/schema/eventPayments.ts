import { pgTable, serial, integer, text, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { membersTable } from "./members";

// Payments for events that carry an extra cost (e.g. ice time at another rink).
// One row per event/member. method 'bank' = parent marked as paid by bank
// transfer; method 'stripe' = paid by card via Stripe Checkout.
export const eventPaymentsTable = pgTable("kjihc_event_payments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull().references(() => membersTable.id, { onDelete: "cascade" }),
  method: text("method").notNull(), // bank | stripe
  amountPence: integer("amount_pence").notNull(), // amount actually paid (stripe includes handling fee)
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("uq_event_payment").on(t.eventId, t.memberId)]);

export const insertEventPaymentSchema = createInsertSchema(eventPaymentsTable).omit({ id: true, createdAt: true });
export type InsertEventPayment = z.infer<typeof insertEventPaymentSchema>;
export type EventPayment = typeof eventPaymentsTable.$inferSelect;
