import type { PoolConfig } from "pg";
import { sanitizeDatabaseUrl } from "@/lib/env/server";

export function databaseConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const common: PoolConfig = {
    application_name: "myluxcards",
    max: Number(env.PGPOOL_MAX || 10),
    connectionTimeoutMillis: Number(env.PGCONNECT_TIMEOUT_MS || 10_000),
    idleTimeoutMillis: Number(env.PGIDLE_TIMEOUT_MS || 30_000),
    statement_timeout: Number(env.PGSTATEMENT_TIMEOUT_MS || 15_000),
  };
  if (env.PGHOST && env.PGUSER && env.PGDATABASE) {
    return { ...common, host: env.PGHOST, port: env.PGPORT ? Number(env.PGPORT) : 5432,
      user: env.PGUSER, password: env.PGPASSWORD, database: env.PGDATABASE };
  }
  if (!env.DATABASE_URL) throw new Error("PostgreSQL connection settings are not configured.");
  return { ...common, connectionString: sanitizeDatabaseUrl(env.DATABASE_URL) };
}
