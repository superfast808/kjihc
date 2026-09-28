import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const parentWebSubscriptionsTable = pgTable("kjihc_parent_web_subscriptions", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ParentWebSubscription = typeof parentWebSubscriptionsTable.$inferSelect;
