import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const membersTable = pgTable("kjihc_members", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  playerDob: text("player_dob"),
  ageGroup: text("age_group").notNull().default(""),
  addAgeGroup: text("add_age_group"),
  playerAddress1: text("player_address1"),
  playerAddress2: text("player_address2"),
  playerCity: text("player_city"),
  playerPost: text("player_post"),
  playerParent: text("player_parent").notNull().default(""),
  playerContactTel: text("player_contact_tel").notNull().default(""),
  playerEmail: text("player_email").notNull().default(""),
  playerMedicalnotes: text("player_medicalnotes"),
  playerMedication: text("player_medication"),
  playerFee: integer("player_fee"),
  readCode: integer("read_code"),
  agreeFee: integer("agree_fee"),
  agreeGdpr: integer("agree_gdpr"),
  agreePhoto: integer("agree_photo"),
  sihaRegistered: integer("siha_registered").notNull().default(0),
  playerNumber: integer("player_number"),
  sihaNumber: text("siha_number"),
  feesOverdue: integer("fees_overdue").notNull().default(0),
  feesBalance: numeric("fees_balance", { precision: 10, scale: 2 }),
  codeSignedAt: timestamp("code_signed_at", { withTimezone: true }),
  medicalUpdatedByParentAt: timestamp("medical_updated_by_parent_at", { withTimezone: true }),
  playerPhoto: text("player_photo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMemberSchema = createInsertSchema(membersTable).omit({ id: true, createdAt: true });
export type InsertMember = z.infer<typeof insertMemberSchema>;
export type Member = typeof membersTable.$inferSelect;
