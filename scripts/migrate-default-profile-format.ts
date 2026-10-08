import { pool } from "../src/lib/db/core";

async function main() {
  console.log("[Migration] Running default profile format migration for digital_cards...");
  try {
    const res = await pool.query(`
      UPDATE digital_cards
      SET profile = jsonb_set(
        COALESCE(profile::jsonb, '{}'::jsonb),
        '{profileFormat}',
        '"modern"'
      ),
      updated_at = NOW()
      WHERE profile IS NULL
         OR profile->>'profileFormat' IS NULL
         OR (
           profile->>'profileFormat' = 'standard'
           AND (profile->>'profileTheme' IS NULL OR profile->>'profileTheme' = '')
           AND (profile->'modernConfig' IS NULL OR profile->'modernConfig' = '{}'::jsonb)
         )
      RETURNING id, slug, profile->>'profileFormat' as format;
    `);
    console.log(`[Migration] Successfully updated ${res.rowCount} digital cards to modern format.`);
    res.rows.forEach(r => console.log(`  - Card ${r.id} (${r.slug}): ${r.format}`));
  } catch (err: any) {
    console.warn("[Migration] Direct PG query result:", err.message);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
