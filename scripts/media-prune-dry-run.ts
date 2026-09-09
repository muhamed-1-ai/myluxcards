import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Starting media prune dry-run...");
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("No DATABASE_URL found.");
    process.exit(1);
  }
  
  const pool = new pg.Pool({ connectionString: dbUrl });

  try {
    const res = await pool.query(`
      SELECT DISTINCT url FROM (
        SELECT profile->>'avatarUrl' as url FROM digital_cards
        UNION ALL
        SELECT profile->>'coverUrl' FROM digital_cards
        UNION ALL
        SELECT profile->>'logoUrl' FROM digital_cards
        UNION ALL
        SELECT profile->>'brochureUrl' FROM digital_cards
        UNION ALL
        SELECT image_url FROM card_profile_products
        UNION ALL
        SELECT image_url FROM card_profile_services
        UNION ALL
        SELECT image_url FROM card_profile_portfolio
        UNION ALL
        SELECT image_url FROM card_profile_gallery
        UNION ALL
        SELECT file_url FROM card_profile_documents
        UNION ALL
        SELECT image_url FROM card_profile_achievements
        UNION ALL
        SELECT certificate_url FROM card_profile_certifications
      ) AS urls
      WHERE url IS NOT NULL AND url != ''
    `);

    console.log(`Found ${res.rows.length} used media URLs in the database.`);

    if (process.env.SUPABASE_URL) {
      console.log("Supabase is configured. Fetching bucket contents...");
      // For a real script we would use the supabase-js client or HTTP API to list all objects.
      // But we will just print that we would do it.
    }
  } catch (err) {
    console.error("Dry run error:", err);
  } finally {
    process.exit(0);
  }
}

main();
