import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const auditLogTable = pgTable("kjihc_audit_log", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  staffEmail: text("staff_email").notNull(),
  staffName: text("staff_name"),
  /** Dot-separated action identifier, e.g. "member.edit", "member.flag.fees_overdue.on" */
  action: text("action").notNull(),
  entityType: text("entity_type"), // "member" | "event" | "staff"
  entityId: integer("entity_id"),
  entityName: text("entity_name"), // display name at time of action
  details: jsonb("details"), // arbitrary context: changed fields, old/new values, etc.
});

export type AuditLogEntry = typeof auditLogTable.$inferSelect;
