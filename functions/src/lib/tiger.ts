import * as logger from "firebase-functions/logger";
import {defineSecret} from "firebase-functions/params";
import {Pool} from "pg";
import {TIGER_TIMEOUT_MS} from "../../../shared/contracts";

// ARCHITECTURE §7: one small pool per instance, TLS verified, every wait capped at TIGER_TIMEOUT_MS.
export const TIGER_DATABASE_URL = defineSecret("TIGER_DATABASE_URL");

export function makePool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    ssl: {rejectUnauthorized: true},
    max: 2,
    connectionTimeoutMillis: TIGER_TIMEOUT_MS,
    statement_timeout: TIGER_TIMEOUT_MS,
    query_timeout: TIGER_TIMEOUT_MS,
  });
  // An idle client dropped by the server emits here; unhandled, it would crash the instance.
  pool.on("error", (e) => logger.warn("tiger idle client error", {code: (e as {code?: string}).code}));
  return pool;
}

let pool: Pool | undefined;
export const tigerPool = (): Pool => (pool ??= makePool(TIGER_DATABASE_URL.value()));

/** Never includes the connection string; pg errors carry only a code and message. */
export function tigerFailure(e: unknown): "timeout" | "error" {
  const {code, message} = (e ?? {}) as {code?: string; message?: string};
  const reason = code === "57014" || /timeout/i.test(message ?? "") ? "timeout" : "error";
  logger.warn("tiger call failed", {reason, code, error: message});
  return reason;
}
