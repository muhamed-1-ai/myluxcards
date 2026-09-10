import pg from "pg";
import * as dotenv from "dotenv";
import { WasabiStorageProvider, extractStorageKey } from "../src/lib/storage";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

async function runMigration() {
  console.log("==================================================");
  console.log(`ZAPPIT Supabase to Wasabi Migration Utility ${DRY_RUN ? "[DRY RUN MODE]" : ""}`);
  console.log("==================================================");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("Error: DATABASE_URL not set.");
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const wasabi = new WasabiStorageProvider();

  if (!wasabi.isConfigured()) {
    console.error("Error: Wasabi Storage is not fully configured in environment.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    console.log("Scanning database for legacy Supabase media URLs...");

    // Collect all media URLs in the system
    const res = await pool.query<{ table_name: string; column_name: string; id: string; url: string }>(`
      SELECT 'digital_cards_avatar' as table_name, 'profile' as column_name, id::text, profile->>'avatarUrl' as url FROM digital_cards WHERE profile->>'avatarUrl' LIKE '%supabase%'
      UNION ALL
      SELECT 'digital_cards_cover' as table_name, 'profile' as column_name, id::text, profile->>'coverUrl' as url FROM digital_cards WHERE profile->>'coverUrl' LIKE '%supabase%'
      UNION ALL
      SELECT 'digital_cards_logo' as table_name, 'profile' as column_name, id::text, profile->>'logoUrl' as url FROM digital_cards WHERE profile->>'logoUrl' LIKE '%supabase%'
      UNION ALL
      SELECT 'card_profile_products' as table_name, 'image_url' as column_name, id::text, image_url as url FROM card_profile_products WHERE image_url LIKE '%supabase%'
      UNION ALL
      SELECT 'card_profile_services' as table_name, 'image_url' as column_name, id::text, image_url as url FROM card_profile_services WHERE image_url LIKE '%supabase%'
      UNION ALL
      SELECT 'card_profile_portfolio' as table_name, 'image_url' as column_name, id::text, image_url as url FROM card_profile_portfolio WHERE image_url LIKE '%supabase%'
      UNION ALL
      SELECT 'card_profile_gallery' as table_name, 'image_url' as column_name, id::text, image_url as url FROM card_profile_gallery WHERE image_url LIKE '%supabase%'
      UNION ALL
      SELECT 'card_profile_documents' as table_name, 'file_url' as column_name, id::text, file_url as url FROM card_profile_documents WHERE file_url LIKE '%supabase%'
      UNION ALL
      SELECT 'users' as table_name, 'image' as column_name, id::text, image as url FROM users WHERE image LIKE '%supabase%'
      UNION ALL
      SELECT 'leads' as table_name, 'profile_image' as column_name, id::text, profile_image as url FROM leads WHERE profile_image LIKE '%supabase%'
    `);

    const rows = res.rows;
    console.log(`\nFiles found referencing Supabase: ${rows.length}`);

    let filesAlreadyMigrated = 0;
    let filesMissing = 0;
    let filesFailed = 0;
    let filesMigrated = 0;
    let totalBytes = 0;

    for (const row of rows) {
      const key = extractStorageKey(row.url);
      if (!key) continue;

      const wasabiKey = `migrated/${key}`;
      const wasabiExists = await wasabi.objectExists(wasabiKey);

      if (wasabiExists) {
        filesAlreadyMigrated++;
        continue;
      }

      if (!supabaseUrl || !serviceRoleKey) {
        console.log(`[Dry-Run Notice] Found Supabase file reference: ${key}`);
        continue;
      }

      // Fetch from Supabase
      try {
        const fetchRes = await fetch(row.url, {
          headers: { Authorization: `Bearer ${serviceRoleKey}` },
        });

        if (!fetchRes.ok) {
          console.warn(`⚠️ Supabase file missing/unreachable (HTTP ${fetchRes.status}): ${row.url}`);
          filesMissing++;
          continue;
        }

        const buffer = Buffer.from(await fetchRes.arrayBuffer());
        const contentType = fetchRes.headers.get("content-type") || "application/octet-stream";
        totalBytes += buffer.byteLength;

        if (!DRY_RUN) {
          const uploadRes = await wasabi.uploadObject({
            buffer,
            key: wasabiKey,
            contentType,
            isPublic: true,
          });

          // Update database row reference with new Wasabi public URL
          if (row.table_name.startsWith("digital_cards_")) {
            const field = row.table_name.replace("digital_cards_", "") + "Url";
            await pool.query(
              `UPDATE digital_cards SET profile = jsonb_set(profile, ARRAY[$1], to_jsonb($2::text)) WHERE id = $3::uuid`,
              [field, uploadRes.publicUrl, row.id]
            );
          } else {
            await pool.query(
              `UPDATE ${row.table_name} SET ${row.column_name} = $1 WHERE id = $2::uuid`,
              [uploadRes.publicUrl, row.id]
            );
          }

          filesMigrated++;
          console.log(`✅ Migrated: ${key} -> ${uploadRes.publicUrl}`);
        } else {
          filesMigrated++;
        }
      } catch (err) {
        console.error(`❌ Migration failed for ${key}:`, err);
        filesFailed++;
      }
    }

    console.log("\n==================================================");
    console.log("Migration Summary Report:");
    console.log(`- Files found:            ${rows.length}`);
    console.log(`- Files already migrated: ${filesAlreadyMigrated}`);
    console.log(`- Files migrated:         ${filesMigrated} ${DRY_RUN ? "(Simulated)" : ""}`);
    console.log(`- Files missing:          ${filesMissing}`);
    console.log(`- Files failed:           ${filesFailed}`);
    console.log(`- Total data volume:      ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
    console.log("==================================================");
    console.log("NOTE: Legacy Supabase files were NOT deleted automatically.");
  } catch (err) {
    console.error("Migration script error:", err);
  } finally {
    await pool.end();
  }
}

runMigration();
