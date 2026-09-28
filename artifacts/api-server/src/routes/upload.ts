import { Router } from "express";
import { db } from "@workspace/db";
import {
  messageAttachmentsTable, messagesTable, uploadGrantsTable,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { resolveCaller, canAccessChannel } from "../lib/messagingAuth";

const router = Router();
const storage = new ObjectStorageService();

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Grant expires after 30 minutes — enough time to complete a presigned PUT
const GRANT_TTL_MS = 30 * 60 * 1000;

/**
 * POST /api/upload/request-url
 * Body: { name: string, size: number, contentType: string }
 * Returns: { uploadUrl, objectPath, fileName, mimeType }
 *
 * Records a server-side upload grant binding the returned objectPath to the
 * authenticated caller. The grant must be consumed (via message creation)
 * within 30 minutes; it cannot be reused.
 */
router.post("/upload/request-url", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { res.status(401).json({ error: "Unauthorized" }); return; }

    const { name, size, contentType } = req.body as {
      name?: string; size?: number; contentType?: string;
    };

    if (!contentType || !ALLOWED_TYPES.has(contentType)) {
      res.status(400).json({ error: "Only image uploads are allowed (jpeg, png, gif, webp)" });
      return;
    }
    if (typeof size === "number" && size > MAX_BYTES) {
      res.status(400).json({ error: "File too large (max 10 MB)" });
      return;
    }

    const uploadUrl = await storage.getObjectEntityUploadURL();
    const rawPath = uploadUrl.split("?")[0];
    const objectPath = storage.normalizeObjectEntityPath(rawPath);

    // Persist the grant — binds this objectPath to the caller before returning
    // the URL to the client.
    await db.insert(uploadGrantsTable).values({
      objectPath,
      uploaderStaffId:  caller.kind === "staff"  ? caller.userId : null,
      uploaderParentId: caller.kind === "parent" ? caller.email  : null,
      mimeType:         contentType,
      maxBytes:         typeof size === "number" ? size : MAX_BYTES,
      expiresAt:        new Date(Date.now() + GRANT_TTL_MS),
    });

    res.json({ uploadUrl, objectPath, fileName: name ?? "attachment", mimeType: contentType });
  } catch (err) {
    console.error("upload/request-url error", err);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /api/storage/objects/*objectPath
 *
 * Serves a stored attachment to an authenticated caller, verifying:
 *   1. A consumed upload grant exists for this path (proves it was a real upload).
 *   2. The path is linked to a message attachment whose channel the caller can access.
 *
 * Both conditions must hold — the grant proves provenance, the channel check
 * proves the caller is entitled to see it.
 */
router.get("/storage/objects/*objectPath", async (req, res): Promise<void> => {
  try {
    const caller = await resolveCaller(req);
    if (!caller) { res.status(401).json({ error: "Unauthorized" }); return; }

    const rawParam = req.params["objectPath"];
    const rawStr = Array.isArray(rawParam) ? rawParam.join("/") : (rawParam ?? "");
    const cleaned = rawStr.replace(/^\/+/, "");
    const objectPath = cleaned.startsWith("objects/") ? "/" + cleaned : "/objects/" + cleaned;

    // Verify a (consumed) grant exists for this path — proves it was a real upload
    const [grant] = await db.select().from(uploadGrantsTable)
      .where(eq(uploadGrantsTable.objectPath, objectPath));

    if (!grant) {
      res.status(404).json({ error: "Not found" }); return;
    }

    // Find attachment → message → channel
    const [att] = await db.select().from(messageAttachmentsTable)
      .where(eq(messageAttachmentsTable.objectPath, objectPath));

    if (!att) {
      // Grant exists but not yet linked to a message.
      // Only the uploader themselves may access their own unlinked upload.
      const isOwner =
        (caller.kind === "staff"  && grant.uploaderStaffId  === caller.userId) ||
        (caller.kind === "parent" && grant.uploaderParentId === caller.email);
      if (!isOwner) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
    } else {
      const [msg] = await db.select({ channelId: messagesTable.channelId })
        .from(messagesTable).where(eq(messagesTable.id, att.messageId));
      if (!msg) { res.status(404).json({ error: "Not found" }); return; }

      if (!await canAccessChannel(msg.channelId, caller)) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
    }

    // Stream from GCS
    const file = await storage.getObjectEntityFile(objectPath);
    const response = await storage.downloadObject(file);
    const buf = Buffer.from(await response.arrayBuffer());
    const ct = response.headers.get("content-type") ?? "application/octet-stream";
    res.set("Content-Type", ct);
    res.set("Cache-Control", "private, max-age=3600");
    res.send(buf);
  } catch (err: unknown) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Not found" }); return;
    }
    console.error("storage/objects error", err);
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
