import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { databaseConfig } from "./config";

const globalPool = globalThis as typeof globalThis & { __myluxcardsPool?: Pool };
export const pool = globalPool.__myluxcardsPool ?? new Pool(databaseConfig());
if (process.env.NODE_ENV !== "production") globalPool.__myluxcardsPool = pool;
pool.on("error", (error) =>
  console.error("[Database] Idle connection error", {
    name: error.name,
    code: (error as NodeJS.ErrnoException).code,
  })
);

export async function query<R extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
  return pool.query<R>(text, [...values]);
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  isolation: "read committed" | "repeatable read" | "serializable" = "read committed"
) {
  const client = await pool.connect();
  try {
    await client.query(`begin isolation level ${isolation}`);
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth() {
  return (await query<{ ok: boolean }>("select true as ok")).rows[0]?.ok === true;
}

export async function closeDatabasePool() {
  await pool.end();
  if (globalPool.__myluxcardsPool === pool) delete globalPool.__myluxcardsPool;
}
