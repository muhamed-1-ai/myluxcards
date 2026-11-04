import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log("Beginning creator provenance database migration...");

  // 1. Add created_by_user_id column to leads if not present
  await pool.query(`
    ALTER TABLE leads 
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
  `);
  console.log("✔ Column created_by_user_id ensured on leads table");

  // 2. Create index on created_by_user_id
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_leads_created_by_user_id ON leads(created_by_user_id);
  `);
  console.log("✔ Index idx_leads_created_by_user_id ensured");

  // 3. Backfill legacy records from verified LEAD_CREATED activities
  const backfillRes = await pool.query(`
    UPDATE leads l
    SET created_by_user_id = la.owner_user_id
    FROM (
      SELECT DISTINCT ON (lead_id) lead_id, owner_user_id
      FROM lead_activities
      WHERE type = 'LEAD_CREATED' AND owner_user_id IS NOT NULL
      ORDER BY lead_id, occurred_at ASC
    ) la
    WHERE l.id = la.lead_id AND l.created_by_user_id IS NULL;
  `);
  console.log(`✔ Backfilled ${backfillRes.rowCount || 0} legacy leads with verified LEAD_CREATED provenance`);

  // 4. Verification summary
  const summary = await pool.query(`
    SELECT 
      COUNT(*)::int as total,
      COUNT(created_by_user_id)::int as with_verified_creator,
      COUNT(*) FILTER (WHERE created_by_user_id IS NULL)::int as unverified_or_public
    FROM leads;
  `);
  console.log("\nMigration Summary:", summary.rows[0]);

  const creatorBreakdown = await pool.query(`
    SELECT created_by_user_id, count(*)::int as count
    FROM leads
    GROUP BY created_by_user_id;
  `);
  console.log("\nCreator Breakdown:\n", creatorBreakdown.rows);

  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

