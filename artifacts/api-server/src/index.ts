import app from "./app";
import { logger } from "./lib/logger";
import { seedDefaultChannels } from "./lib/seedChannels";
import { startEventReminderScheduler } from "./lib/eventReminders";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed default noticeboard channels (idempotent — safe to run every boot)
  seedDefaultChannels().catch((e) => logger.error({ err: e }, "Failed to seed channels"));

  // Game-day reminder scheduler (idempotent; skipped under NODE_ENV=test)
  startEventReminderScheduler();
});
