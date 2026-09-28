import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const parentDevicesTable = pgTable("kjihc_parent_devices", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  expoPushToken: text("expo_push_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ParentDevice = typeof parentDevicesTable.$inferSelect;
