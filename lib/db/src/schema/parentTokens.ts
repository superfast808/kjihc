import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const parentTokensTable = pgTable("kjihc_parent_tokens", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertParentTokenSchema = createInsertSchema(parentTokensTable).omit({ id: true, createdAt: true });
export type InsertParentToken = z.infer<typeof insertParentTokenSchema>;
export type ParentToken = typeof parentTokensTable.$inferSelect;
