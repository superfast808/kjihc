import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Age groups are stored/entered with inconsistent casing ("u14" vs "U14").
// Always compare via this normalizer.
export function normAgeGroup(g: string | null | undefined): string {
  return (g ?? "").trim().toLowerCase();
}

export function parseStaffRoles(staff: { staffLevel: string; staffRoles?: string | null }) {
  const isSuperUser = staff.staffLevel === "1";
  const rawRoles = (staff.staffRoles ?? "").split(",").map(r => r.trim()).filter(Boolean);
  const ageGroups = !isSuperUser
    ? staff.staffLevel.split(",").map(g => normAgeGroup(g)).filter(Boolean)
    : [];
  // Backward compat: staff added before roles existed with age groups set → treat as coach
  const roles = rawRoles.length === 0 && ageGroups.length > 0 ? ["coach"] : rawRoles;
  return {
    isSuperUser,
    isCoach: isSuperUser || roles.includes("coach"),
    isTreasurer: isSuperUser || roles.includes("treasurer"),
    isRegistrations: isSuperUser || roles.includes("registrations"),
    ageGroups,
    roles,
  };
}

async function resolveStaffEmail(userId: string): Promise<string | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

export const requireStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  if (!auth?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 1. Try clerkUserId (fastest — already linked)
  let rows = await db.select().from(staffTable).where(eq(staffTable.clerkUserId, auth.userId));
  let staff = rows[0] ?? null;

  if (!staff) {
    // 2. Fetch primary email from Clerk and match against staff table
    const email = await resolveStaffEmail(auth.userId);
    if (email) {
      rows = await db.select().from(staffTable).where(eq(staffTable.staffEmail, email));
      staff = rows[0] ?? null;

      // 3. Link clerkUserId so future logins skip the API call
      if (staff) {
        await db.update(staffTable).set({ clerkUserId: auth.userId }).where(eq(staffTable.id, staff.id));
      }
    }
  }

  if (!staff) {
    res.status(403).json({ error: "Not a staff member" });
    return;
  }

  (req as any).staffMember = staff;
  next();
};

export const requireSuperUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  await requireStaff(req, res, () => {
    const staff = (req as any).staffMember;
    if (!staff || staff.staffLevel !== "1") {
      res.status(403).json({ error: "Superuser access required" });
      return;
    }
    next();
  });
};
