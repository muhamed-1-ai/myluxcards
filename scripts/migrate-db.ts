import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Pool, type PoolClient } from "pg";
import { databaseConfig } from "../src/lib/db/config";

const MIGRATION_DIR = path.resolve(process.cwd(), "db/migrations");
const LOCK_ID = 4_866_892_367;
const migrationPattern = /^\d{4}_[a-z0-9_]+\.sql$/;

async function migrationFiles() {
  const names = (await readdir(MIGRATION_DIR)).filter(name => migrationPattern.test(name)).sort();
  if (!names.length) throw new Error("No database migrations were found.");
  return Promise.all(names.map(async name => {
    const sql = await readFile(path.join(MIGRATION_DIR,name),"utf8");
    return { id:name.slice(0,-4), sql, checksum:createHash("sha256").update(sql).digest("hex") };
  }));
}

async function ensureLedger(client: PoolClient) {
  await client.query(`create table if not exists schema_migrations(
    version text primary key, checksum text not null, applied_at timestamptz not null default now(),
    execution_ms integer not null check(execution_ms >= 0))`);
}

async function main() {
  const pool = new Pool({ ...databaseConfig(), max:1, application_name:"myluxcards-migrator" });
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock($1)",[LOCK_ID]);
    await ensureLedger(client);
    const applied = new Map((await client.query<{version:string;checksum:string}>("select version,checksum from schema_migrations order by version")).rows.map(row=>[row.version,row.checksum]));
    for (const migration of await migrationFiles()) {
      const recorded = applied.get(migration.id);
      if (recorded && recorded !== migration.checksum) throw new Error(`Migration checksum mismatch: ${migration.id}`);
      if (recorded) { process.stdout.write(`already applied ${migration.id}\n`); continue; }
      const started=performance.now();
      await client.query("begin");
      try {
        await client.query(migration.sql);
        const elapsed=Math.max(0,Math.round(performance.now()-started));
        await client.query("insert into schema_migrations(version,checksum,execution_ms) values($1,$2,$3)",[migration.id,migration.checksum,elapsed]);
        await client.query("commit");
        process.stdout.write(`applied ${migration.id}\n`);
      } catch(error) { await client.query("rollback").catch(()=>undefined); throw error; }
    }
  } finally {
    await client.query("select pg_advisory_unlock($1)",[LOCK_ID]).catch(()=>undefined);
    client.release(); await pool.end();
  }
}
main().catch(error=>{ console.error("Database migration failed:", error instanceof Error ? error.message : "Unknown error"); process.exitCode=1; });
