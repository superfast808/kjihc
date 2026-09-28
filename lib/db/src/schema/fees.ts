import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feesTable = pgTable("kjihc_fees", {
  id: serial("id").primaryKey(),
  feeGroup: text("fee_group").notNull(),
  feeAmount: text("fee_amount").notNull(),
});

export const insertFeeSchema = createInsertSchema(feesTable).omit({ id: true });
export type InsertFee = z.infer<typeof insertFeeSchema>;
export type Fee = typeof feesTable.$inferSelect;
