import { pool } from "../src/lib/db/core";
import { supabaseJson, getSupabaseServiceConfig } from "../src/lib/supabaseAuth";

async function main() {
  console.log("[Migration] Running default profile format migration for digital_cards...");
  
  // 1. Direct PG pool update
  try {
    const res = await pool.query(`
      UPDATE digital_cards
      SET profile = jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(profile::jsonb, '{}'::jsonb),
            '{profileFormat}',
            '"modern"'
          ),
          '{profileBackground}',
          '"#050B14"'
        ),
        '{profileAccent}',
        '"#0066FF"'
      ),
      updated_at = NOW()
      WHERE profile IS NULL
         OR profile->>'profileFormat' IS NULL
         OR profile->>'profileFormat' = 'standard'
         OR profile->>'profileBackground' = '#0B0D12'
         OR profile->>'profileBackground' = '#020202'
         OR profile->>'profileAccent' = '#D4AF62'
      RETURNING id, slug, profile->>'profileFormat' as format, profile->>'profileBackground' as bg;
    `);
    console.log(`[PG Migration] Successfully updated ${res.rowCount} digital cards.`);
    res.rows.forEach(r => console.log(`  - Card ${r.id} (${r.slug}): format=${r.format}, bg=${r.bg}`));
  } catch (err: any) {
    console.warn("[PG Migration] Direct PG query error:", err.message);
  } finally {
    await pool.end().catch(() => {});
  }

  // 2. Supabase REST API update if configured
  try {
    const config = getSupabaseServiceConfig();
    if (config) {
      console.log("[Supabase Migration] Fetching cards from Supabase REST API...");
      const { data } = await supabaseJson("/rest/v1/digital_cards?select=id,slug,profile", {}, true);
      if (Array.isArray(data)) {
        for (const row of data) {
          const prof = row.profile && typeof row.profile === "object" ? { ...row.profile } : {};
          const bgRaw = String(prof.profileBackground || "").toUpperCase();
          const accentRaw = String(prof.profileAccent || "").toUpperCase();
          const isLegacyGold = (!prof.profileBackground || bgRaw === "#0B0D12" || bgRaw === "#020202") &&
                               (!prof.profileAccent || accentRaw === "#D4AF62");
          
          if (!prof.profileFormat || prof.profileFormat === "standard" || isLegacyGold) {
            prof.profileFormat = "modern";
            if (isLegacyGold || !prof.profileBackground) prof.profileBackground = "#050B14";
            if (isLegacyGold || !prof.profileAccent) prof.profileAccent = "#0066FF";

            await supabaseJson(`/rest/v1/digital_cards?id=eq.${row.id}`, {
              method: "PATCH",
              body: JSON.stringify({ profile: prof, updated_at: new Date().toISOString() })
            }, true);
            console.log(`  [Supabase] Updated card ${row.id} (${row.slug}) to modern navy.`);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("[Supabase Migration] REST update note:", err.message);
  }
}

main();
