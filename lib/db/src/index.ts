import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// DATABASE_OVERRIDE_URL lets you point dev at a different database (e.g. production)
// without touching Replit's runtime-managed DATABASE_URL.
const connectionString = process.env.DATABASE_OVERRIDE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString });

// Idle clients in the pool can emit 'error' when the server terminates a
// connection (e.g. Neon restarts). Without a handler this crashes the process.
pool.on("error", (err) => {
  console.error("Postgres pool idle client error (recovering):", err.message);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
