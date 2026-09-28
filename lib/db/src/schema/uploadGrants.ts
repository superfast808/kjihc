import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Records every presigned upload URL issued by the server.
 * The grant is consumed exactly once when a message attachment is created,
 * preventing a caller from referencing paths they did not personally upload
 * or from replaying the same path in multiple messages.
 */
export const uploadGrantsTable = pgTable("kjihc_upload_grants", {
  id:                serial("id").primaryKey(),
  objectPath:        text("object_path").notNull().unique(),
  uploaderStaffId:   text("uploader_staff_id"),   // Clerk userId — null for parents
  uploaderParentId:  text("uploader_parent_id"),  // parent email  — null for staff
  mimeType:          text("mime_type").notNull(),
  maxBytes:          integer("max_bytes").notNull(),
  expiresAt:         timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt:        timestamp("consumed_at", { withTimezone: true }),
  createdAt:         timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
