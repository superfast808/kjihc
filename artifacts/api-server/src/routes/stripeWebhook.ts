import { Router } from "express";
import { db, membersTable, feePaymentsTable, eventPaymentsTable, eventsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// POST /api/webhooks/stripe
// Must be registered BEFORE express.json() — Stripe signature verification needs the raw body.
router.post(
  "/webhooks/stripe",
  async (req, res): Promise<void> => {
    try {
      // --- 1. Get the webhook secret from settings ---
      const secretRows = await db.execute(
        sql`SELECT value FROM kjihc_settings WHERE key = 'stripe_webhook_secret'`
      );
      const webhookSecret = (secretRows.rows[0] as any)?.value as string | undefined;

      // --- 2. Verify Stripe signature (if webhook secret is configured) ---
      const sig = req.headers["stripe-signature"] as string | undefined;
      let event: any;

      if (webhookSecret && sig) {
        const Stripe = (await import("stripe")).default;
        // Pull secret key from settings for the Stripe constructor
        const skRows = await db.execute(
          sql`SELECT value FROM kjihc_settings WHERE key = 'stripe_secret_key'`
        );
        const secretKey = (skRows.rows[0] as any)?.value as string | undefined;
        if (!secretKey) {
          res.status(503).json({ error: "Stripe not configured" });
          return;
        }
        const stripe = new Stripe(secretKey, { apiVersion: "2025-06-30.basil" });
        try {
          event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        } catch (err: any) {
          logger.warn({ err: err.message }, "Stripe webhook signature verification failed");
          res.status(400).json({ error: `Webhook signature invalid: ${err.message}` });
          return;
        }
      } else {
        // No webhook secret configured — accept unverified (test/dev use only)
        try {
          event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        } catch {
          res.status(400).json({ error: "Invalid JSON body" });
          return;
        }
      }

      // --- 3. Handle checkout.session.completed ---
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;

        // Event cost payment (away-rink ice fees etc.) — record and stop;
        // must NOT touch the member's club-fee balance.
        if (session.metadata?.eventPayment === "1") {
          const evId = parseInt(session.metadata?.eventId ?? "", 10);
          const memId = parseInt(session.metadata?.childId ?? "", 10);
          const isPaid = session.payment_status === "paid" || session.payment_status == null;
          if (!isNaN(evId) && !isNaN(memId) && isPaid) {
            const [ev] = await db.select().from(eventsTable).where(eq(eventsTable.id, evId));
            if (!ev || !ev.costPence || ev.costPence <= 0) {
              logger.warn({ evId, memId }, "Stripe event payment for unknown/free event — ignored");
              res.json({ received: true });
              return;
            }
            const expected = ev.costPence + 10;
            if (session.amount_total != null && session.amount_total !== expected) {
              logger.warn({ evId, memId, amountTotal: session.amount_total, expected }, "Stripe event payment amount differs from current event cost — recording actual amount");
            }
            await db.insert(eventPaymentsTable)
              .values({
                eventId: evId,
                memberId: memId,
                method: "stripe",
                amountPence: session.amount_total ?? 0,
                stripeSessionId: session.id,
              })
              .onConflictDoNothing();
            logger.info({ evId, memId, amountPence: session.amount_total }, "Stripe event payment recorded");
          }
          res.json({ received: true });
          return;
        }

        const childId = parseInt(session.metadata?.childId ?? "", 10);
        const amountPence: number = session.amount_total ?? 0;
        const amountPounds = amountPence / 100;

        if (!isNaN(childId) && amountPounds > 0) {
          // Fetch current member
          const [member] = await db.select({
            id: membersTable.id,
            playerName: membersTable.playerName,
            feesBalance: membersTable.feesBalance,
          }).from(membersTable).where(eq(membersTable.id, childId));

          if (member) {
            const currentBalance = member.feesBalance != null
              ? parseFloat(member.feesBalance as string)
              : null;

            const newBalance = currentBalance != null
              ? Math.max(0, currentBalance - amountPounds)
              : null;

            const clearFlag = newBalance != null && newBalance <= 0;

            await db.update(membersTable)
              .set({
                feesBalance: newBalance != null ? String(newBalance.toFixed(2)) : null,
                ...(clearFlag ? { feesOverdue: 0 } : {}),
              })
              .where(eq(membersTable.id, childId));

            // Record the payment
            await db.insert(feePaymentsTable).values({
              memberId:        childId,
              memberName:      member.playerName,
              parentEmail:     session.customer_email ?? session.customer_details?.email ?? "",
              amountPounds:    String(amountPounds.toFixed(2)),
              stripeSessionId: session.id,
            });

            logger.info(
              { childId, amountPounds, newBalance, clearFlag },
              "Stripe payment processed — balance updated"
            );
          }
        }
      }

      res.json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook error");
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
