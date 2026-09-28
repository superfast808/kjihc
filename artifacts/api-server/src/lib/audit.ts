import { db, auditLogTable } from "@workspace/db";
import type { Request } from "express";

export interface AuditOpts {
  entityType?: "member" | "event" | "staff";
  entityId?: number;
  entityName?: string;
  details?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit log write. Never throws — a logging failure must
 * never break the main request.
 */
export function logAudit(req: Request, action: string, opts: AuditOpts = {}): void {
  const staff = (req as any).staffMember as { staffEmail: string; staffName: string } | undefined;
  if (!staff) return;

  db.insert(auditLogTable).values({
    staffEmail: staff.staffEmail,
    staffName: staff.staffName ?? null,
    action,
    entityType: opts.entityType ?? null,
    entityId: opts.entityId ?? null,
    entityName: opts.entityName ?? null,
    details: opts.details ?? null,
  }).catch((err) => {
    // Log but never propagate — audit must be best-effort
    console.error("[audit] write failed:", err?.message);
  });
}
