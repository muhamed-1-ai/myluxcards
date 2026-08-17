import type { PoolConfig } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function databaseConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  if (!env.DATABASE_URL && !env.PGHOST) {
    try {
      const envPath = resolve(process.cwd(), ".env");
      const envContent = readFileSync(envPath, "utf8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!env[key]) env[key] = val;
        }
      }
    } catch {
      /* .env is optional when environment variables are supplied directly */
    }
  }

  const common: PoolConfig = {
    application_name: "myluxcards",
    max: Number(env.PGPOOL_MAX || 10),
    connectionTimeoutMillis: Number(env.PGCONNECT_TIMEOUT_MS || 10_000),
    idleTimeoutMillis: Number(env.PGIDLE_TIMEOUT_MS || 30_000),
    statement_timeout: Number(env.PGSTATEMENT_TIMEOUT_MS || 15_000),
  };
  if (env.PGHOST && env.PGUSER && env.PGDATABASE) {
    return {
      ...common,
      host: env.PGHOST,
      port: env.PGPORT ? Number(env.PGPORT) : 5432,
      user: env.PGUSER,
      password: env.PGPASSWORD,
      database: env.PGDATABASE,
    };
  }
  if (!env.DATABASE_URL) throw new Error("PostgreSQL connection settings are not configured.");
  return { ...common, connectionString: env.DATABASE_URL };
}
