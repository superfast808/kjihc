import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hejaCodesTable = pgTable("kjihc_heja_codes", {
  id: serial("id").primaryKey(),
  codeGroup: text("code_group").notNull(),
  codeCode: text("code_code").notNull(),
});

export const insertHejaCodeSchema = createInsertSchema(hejaCodesTable).omit({ id: true });
export type InsertHejaCode = z.infer<typeof insertHejaCodeSchema>;
export type HejaCode = typeof hejaCodesTable.$inferSelect;
