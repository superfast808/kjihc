import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const documentsTable = pgTable("kjihc_documents", {
  id:          serial("id").primaryKey(),
  title:       text("title").notNull(),
  objectPath:  text("object_path").notNull(),
  mimeType:    text("mime_type").notNull(),
  fileSize:    integer("file_size"),
  uploadedBy:  text("uploaded_by"),           // Clerk userId of uploader
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
