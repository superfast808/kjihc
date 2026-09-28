import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireStaff, requireSuperUser } from "../middlewares/auth";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router = Router();
const storage = new ObjectStorageService();

const ALLOWED_DOC_TYPES: Record<string, string> = {
  "application/pdf":                                                          "pdf",
  "application/msword":                                                       "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":  "docx",
  "application/vnd.ms-excel":                                                 "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":        "xlsx",
  "application/vnd.ms-powerpoint":                                            "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":"pptx",
};

const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25 MB

// ── GET /documents ─────────────────────────────────────────────────────────────
router.get("/documents", requireStaff, async (req, res): Promise<void> => {
  try {
    const docs = await db
      .select()
      .from(documentsTable)
      .orderBy(documentsTable.createdAt);
    res.json(docs);
  } catch (err) {
    req.log.error({ err }, "Error fetching documents");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /documents/upload-url ────────────────────────────────────────────────
// Returns a presigned PUT URL + the objectPath to use when creating the record.
router.post("/documents/upload-url", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const { name, size, contentType } = req.body as {
      name?: string; size?: number; contentType?: string;
    };

    if (!contentType || !ALLOWED_DOC_TYPES[contentType]) {
      res.status(400).json({ error: "Unsupported file type. Allowed: PDF, Word, Excel, PowerPoint." });
      return;
    }
    if (typeof size === "number" && size > MAX_DOC_BYTES) {
      res.status(400).json({ error: "File too large (max 25 MB)" });
      return;
    }

    const uploadUrl = await storage.getObjectEntityUploadURL();
    const objectPath = storage.normalizeObjectEntityPath(uploadUrl.split("?")[0]);

    res.json({ uploadUrl, objectPath, fileName: name ?? "document", mimeType: contentType });
  } catch (err) {
    req.log.error({ err }, "Error generating document upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// ── POST /documents ────────────────────────────────────────────────────────────
// Create a document record after the client has PUT the file to the signed URL.
router.post("/documents", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const staff = (req as any).staffMember;
    const { title, objectPath, mimeType, fileSize } = req.body as {
      title?: string; objectPath?: string; mimeType?: string; fileSize?: number;
    };

    if (!title || !objectPath || !mimeType) {
      res.status(400).json({ error: "title, objectPath and mimeType are required" });
      return;
    }

    const [doc] = await db.insert(documentsTable).values({
      title,
      objectPath,
      mimeType,
      fileSize: fileSize ?? null,
      uploadedBy: staff?.staffEmail ?? null,
    }).returning();

    res.status(201).json(doc);
  } catch (err) {
    req.log.error({ err }, "Error creating document record");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /documents/:id/download ───────────────────────────────────────────────
// Stream the file from object storage with appropriate Content-Disposition.
router.get("/documents/:id/download", requireStaff, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
    if (!doc) { res.status(404).json({ error: "Not found" }); return; }

    const file = await storage.getObjectEntityFile(doc.objectPath);
    const response = await storage.downloadObject(file);
    const buf = Buffer.from(await response.arrayBuffer());

    // PDFs open inline; everything else downloads
    const isInline = doc.mimeType === "application/pdf";
    const ext = ALLOWED_DOC_TYPES[doc.mimeType] ?? "bin";
    const safeName = doc.title.replace(/[^a-z0-9\-_. ]/gi, "_");
    const filename = safeName.toLowerCase().endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`;

    res.set("Content-Type", doc.mimeType);
    res.set("Content-Disposition", `${isInline ? "inline" : "attachment"}; filename="${filename}"`);
    res.set("Content-Length", String(buf.length));
    res.set("Cache-Control", "private, max-age=3600");
    res.send(buf);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found in storage" });
      return;
    }
    req.log.error({ err }, "Error serving document");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /documents/:id ─────────────────────────────────────────────────────
router.delete("/documents/:id", requireSuperUser, async (req, res): Promise<void> => {
  try {
    const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(raw, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    await db.delete(documentsTable).where(eq(documentsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting document");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
