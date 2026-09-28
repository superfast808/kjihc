import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("kjihc_settings", {
  key: text("key").primaryKey(),
  value: text("value").default("").notNull(),
  label: text("label").default("").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Setting = typeof settingsTable.$inferSelect;
