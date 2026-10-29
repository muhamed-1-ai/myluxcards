/**
 * Maintenance script to safely repair previously deleted user accounts
 * that still reserve their login email addresses.
 *
 * Usage:
 *   npx tsx scripts/repair-deleted-user-emails.ts --dry-run
 *   npx tsx scripts/repair-deleted-user-emails.ts --confirm
 */
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config";

async function main() {
  const isConfirm = process.argv.includes("--confirm");
  const isDryRun = process.argv.includes("--dry-run") || !isConfirm;

  const pool = new Pool({ ...databaseConfig(), max: 1 });
  const client = await pool.connect();

  try {
    console.log(`[Repair Maintenance] Mode: ${isDryRun ? "DRY RUN (preview only)" : "CONFIRMED EXECUTION"}`);

    // Query candidate records: strictly deleted records where email is not yet tombstoned
    const candidatesRes = await client.query<{ id: string; email: string; deleted_at: Date | null }>(
      `SELECT id, email, deleted_at
       FROM users
       WHERE status = 'DELETED'
         AND email NOT LIKE 'deleted+%'
       ORDER BY deleted_at ASC`
    );

    const candidates = candidatesRes.rows;
    console.log(`[Repair Maintenance] Found ${candidates.length} deleted account(s) reserving login email(s).`);

    if (candidates.length === 0) {
      console.log("[Repair Maintenance] All deleted accounts have already released their login emails. No action required.");
      return;
    }

    for (const c of candidates) {
      const tombstoneEmail = `deleted+${c.id}@deleted.zappit.local`;
      console.log(` - User ID: ${c.id} | Email: ${c.email} -> Tombstone: ${tombstoneEmail} (Deleted: ${c.deleted_at?.toISOString() || "unknown"})`);
    }

    if (isDryRun) {
      console.log("\n[Dry Run Complete] To apply this repair to the database, run with --confirm.");
      return;
    }

    await client.query("BEGIN");
    try {
      const updateRes = await client.query(
        `UPDATE users
         SET original_email = email,
             email = 'deleted+' || id || '@deleted.zappit.local',
             updated_at = NOW()
         WHERE status = 'DELETED'
           AND email NOT LIKE 'deleted+%'
         RETURNING id, original_email, email`
      );

      await client.query("COMMIT");
      console.log(`\n[Repair Maintenance] Successfully repaired ${updateRes.rowCount} deleted user account(s).`);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[Repair Maintenance] Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
