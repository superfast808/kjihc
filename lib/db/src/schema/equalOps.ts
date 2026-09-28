import { pgTable, serial, text } from "drizzle-orm/pg-core";

// Anonymous Equal Opportunities survey responses.
// Deliberately stores NO identifying information (no name, email, IP, player id).
export const equalOpsResponsesTable = pgTable("kjihc_equal_ops_responses", {
  id: serial("id").primaryKey(),
  // "male" | "female" | "other" | "prefer_not"
  gender: text("gender").notNull(),
  // Each category answer: "yes" | "no" | "prefer_not"
  minorityEthnic: text("minority_ethnic").notNull(),
  disabledChild: text("disabled_child").notNull(),
  threeOrMoreChildren: text("three_or_more_children").notNull(),
  childUnderOne: text("child_under_one").notNull(),
  motherUnder25: text("mother_under_25").notNull(),
  youngCarer: text("young_carer").notNull(),
  careExperienced: text("care_experienced").notNull(),
  // Month-only ("YYYY-MM") to avoid re-identification via precise timestamps.
  submittedMonth: text("submitted_month").notNull(),
});

export type EqualOpsResponse = typeof equalOpsResponsesTable.$inferSelect;
