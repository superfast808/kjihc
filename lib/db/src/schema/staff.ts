import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffTable = pgTable("kjihc_staff", {
  id: serial("id").primaryKey(),
  staffName: text("staff_name").notNull(),
  staffEmail: text("staff_email").notNull().unique(),
  staffLevel: text("staff_level").notNull().default(""),
  staffRoles: text("staff_roles").notNull().default(""),
  clerkUserId: text("clerk_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
