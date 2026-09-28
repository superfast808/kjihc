import { pgTable, text, serial, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ensignEntriesTable = pgTable("kjihc_ensign_entries", {
  id: serial("id").primaryKey(),
  ageGroup: text("age_group").notNull(),
  clubName: text("club_name").notNull(),
  teamName: text("team_name").notNull(),
  shirtColourHome: text("shirt_colour_home").notNull().default(""),
  shirtColourAway: text("shirt_colour_away").notNull().default(""),
  numCoachesOfficials: text("num_coaches_officials").notNull().default(""),
  seniorContactName: text("senior_contact_name").notNull().default(""),
  seniorContactPhoneEmail: text("senior_contact_phone_email").notNull().default(""),
  bookingContactName: text("booking_contact_name").notNull().default(""),
  bookingContactPhone: text("booking_contact_phone").notNull().default(""),
  bookingContactEmail: text("booking_contact_email").notNull().default(""),
  managerName: text("manager_name").notNull().default(""),
  managerPhone: text("manager_phone").notNull().default(""),
  managerEmail: text("manager_email").notNull().default(""),
  remarks: text("remarks"),
  paymentStatus: integer("payment_status").notNull().default(0),
  signature: text("signature").notNull().default(""),
  printName: text("print_name").notNull().default(""),
  positionInClub: text("position_in_club").notNull().default(""),
  dateSigned: date("date_signed", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEnsignEntrySchema = createInsertSchema(ensignEntriesTable).omit({ id: true, createdAt: true });
export type InsertEnsignEntry = z.infer<typeof insertEnsignEntrySchema>;
export type EnsignEntry = typeof ensignEntriesTable.$inferSelect;
