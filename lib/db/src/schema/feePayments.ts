import { pgTable, serial, timestamp, text, integer, numeric } from "drizzle-orm/pg-core";

export const feePaymentsTable = pgTable("kjihc_fee_payments", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  memberId: integer("member_id").notNull(),
  memberName: text("member_name").notNull(),
  parentEmail: text("parent_email").notNull(),
  amountPounds: numeric("amount_pounds", { precision: 10, scale: 2 }).notNull(),
  stripeSessionId: text("stripe_session_id"),
  notes: text("notes"),
});
