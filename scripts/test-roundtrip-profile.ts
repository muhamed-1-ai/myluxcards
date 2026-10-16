import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config";
import { cleanCardProfile, completeCardProfile, safePublicCard } from "../src/lib/cards";

async function main() {
  const pool = new Pool(databaseConfig());
  try {
    console.log("=== Profile Design Switcher E2E Backend Verification ===");
    
    // 1. Select card
    const cardRes = await pool.query(
      "SELECT id, slug, owner_id, profile, active FROM digital_cards WHERE slug = 'test-dev-148106'"
    );
    if (cardRes.rows.length === 0) {
      throw new Error("Card test-dev-148106 not found");
    }
    const card = cardRes.rows[0];
    const initialProfile = card.profile || {};
    console.log("Initial profileFormat:", initialProfile.profileFormat || "(none)");

    // 2. Update to simple design
    const updatedToSimple = {
      ...initialProfile,
      name: "Alexander Harrington-Smythe",
      title: "Senior VP of Strategic Partnerships",
      business: "Global Technology Holdings Ltd.",
      about: "Guiding enterprise digital transformation, ecosystem alliances, and product design.",
      mobile: "+91 98765 43210",
      email: "alexander@example.com",
      website: "https://globaltech.example.com",
      profileFormat: "simple",
      social: {
        LinkedIn: "https://linkedin.com/in/alexander-harrington",
        Twitter: "https://x.com/alex_harrington",
        Instagram: "https://instagram.com/alex_tech",
      },
    };

    const cleanedSimple = cleanCardProfile(updatedToSimple);
    await pool.query(
      "UPDATE digital_cards SET profile = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(cleanedSimple), card.id]
    );

    // 3. Verify public card retrieval
    const afterSimpleRes = await pool.query(
      "SELECT id, slug, owner_id, profile, active FROM digital_cards WHERE id = $1",
      [card.id]
    );
    const safeSimple = safePublicCard(afterSimpleRes.rows[0]) as any;
    console.log("After update -> safePublicCard.profileFormat:", safeSimple.profileFormat);
    if (safeSimple.profileFormat !== "simple") {
      throw new Error("Expected profileFormat to be 'simple'");
    }
    if (safeSimple.name !== "Alexander Harrington-Smythe") {
      throw new Error("Expected name to be preserved");
    }
    console.log("✓ Simple design successfully persisted in database and returned via safePublicCard");

    // 4. Test public fetch simulation
    const publicUrl = `http://localhost:3000/api/cards/public/${card.slug}`;
    const pubFetch = await fetch(publicUrl);
    const pubData = await pubFetch.json();
    console.log("Public API HTTP status:", pubFetch.status);
    console.log("Public API profileFormat:", pubData.card?.profileFormat);
    if (pubData.card?.profileFormat !== "simple") {
      throw new Error("Public API did not return profileFormat === 'simple'");
    }
    console.log("✓ Public endpoint /api/cards/public/[slug] outputs profileFormat: 'simple'");

    // 5. Test switching back to Modern
    const updatedToModern = {
      ...cleanedSimple,
      profileFormat: "modern",
    };
    const cleanedModern = cleanCardProfile(updatedToModern);
    await pool.query(
      "UPDATE digital_cards SET profile = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(cleanedModern), card.id]
    );

    const afterModernRes = await pool.query(
      "SELECT id, slug, owner_id, profile, active FROM digital_cards WHERE id = $1",
      [card.id]
    );
    const safeModern = safePublicCard(afterModernRes.rows[0]) as any;
    console.log("After switch back -> safePublicCard.profileFormat:", safeModern.profileFormat);
    if (safeModern.profileFormat !== "modern") {
      throw new Error("Expected profileFormat to be 'modern'");
    }
    if (safeModern.about !== updatedToSimple.about || safeModern.email !== updatedToSimple.email) {
      throw new Error("Information was lost during design switch!");
    }
    console.log("✓ Switched back to Modern with 100% data preservation");

    // Keep it on 'simple' for visual validation and screenshots
    await pool.query(
      "UPDATE digital_cards SET profile = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(cleanedSimple), card.id]
    );
    console.log("✓ Card test-dev-148106 set to 'simple' for browser visual testing.");

  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
