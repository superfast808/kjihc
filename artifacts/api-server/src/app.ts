import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import stripeWebhookRouter from "./routes/stripeWebhook";
import eventPaymentsRouter from "./routes/eventPayments";

const app = express();
// Behind Replit's proxy in production: trust X-Forwarded-For so req.ip is the
// real client IP (otherwise all visitors share the proxy's IP for rate limits).
app.set("trust proxy", true);

// Disable Express's automatic ETag generation — this is a JSON API where
// React Query manages client-side caching. ETags cause the browser HTTP cache
// to serve stale 304 responses after mutations, making changes appear to revert.
app.set("etag", false);

// Ensure no API response is ever stored in the browser HTTP cache.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));

// Stripe webhook must receive the raw body for signature verification —
// scope express.raw() to ONLY the webhook path. Mounting it on all of /api
// consumes every JSON body as a Buffer, silently breaking every other
// POST/PATCH route (express.json() can't re-parse an already-read body).
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use("/api", stripeWebhookRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", eventPaymentsRouter);
app.use("/api", router);

export default app;
