import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const staffWebSubscriptionsTable = pgTable("kjihc_staff_web_subscriptions", {
  id: serial("id").primaryKey(),
  staffId: text("staff_id").notNull(),          // staff table id (as string)
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StaffWebSubscription = typeof staffWebSubscriptionsTable.$inferSelect;
