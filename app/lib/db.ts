import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "./env";
import * as schema from "./schema";

/**
 * Single postgres.js client shared by the whole server process.
 * Connections are created lazily, so importing this module never touches the
 * database (safe during build/typecheck).
 */
const client = postgres(env.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
