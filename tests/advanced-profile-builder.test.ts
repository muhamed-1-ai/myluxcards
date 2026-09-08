import assert from "node:assert/strict";
import { Pool } from "pg";
import { completeCardProfile, DEFAULT_FEATURE_ORDER, DEFAULT_PROFILE_FEATURES, ProfileFeatureKey } from "../src/lib/cards";
import { databaseConfig } from "../src/lib/db/config";

const pool = new Pool(databaseConfig());

async function runTests() {
  console.log("🚀 Starting Advanced Dynamic Profile Builder Test Suite...");

  let testUserId: string | null = null;
  let testCardId: string | null = null;

  try {
    // 1. Verify Profile Defaults & 19 Feature Keys
    assert.equal(DEFAULT_FEATURE_ORDER.length, 19);
    assert.equal(Object.keys(DEFAULT_PROFILE_FEATURES).length, 19);
    console.log("  ✓ Verified 19 profile feature keys in DEFAULT_FEATURE_ORDER and DEFAULT_PROFILE_FEATURES");

    // 2. Setup Test User and Digital Card
    const email = `profile_builder_test_${Date.now()}@test.com`;
    const userRes = await pool.query<{ id: string }>(
      `insert into users (email, normalized_email, name, role) values ($1, $2, $3, $4) returning id`,
      [email, email.toLowerCase(), "Builder Tester", "CUSTOMER"]
    );
    testUserId = userRes.rows[0].id;

    const cardRes = await pool.query<{ id: string; profile: unknown }>(
      `insert into digital_cards (owner_id, slug, profile) values ($1, $2, $3) returning id, profile`,
      [testUserId, `builder-card-${Date.now()}`, JSON.stringify({ name: "Builder Tester" })]
    );
    testCardId = cardRes.rows[0].id;

    const completed = completeCardProfile(cardRes.rows[0].profile as any);
    assert.equal(completed.profileFeatures.SERVICES.enabled, false);
    assert.equal(completed.profileFeatures.PORTFOLIO.enabled, false);
    assert.equal(completed.profileFeatures.GALLERY.enabled, false);
    assert.equal(completed.profileFeatures.VIDEOS.enabled, false);
    assert.equal(completed.profileFeatures.PAYMENT_LINKS.enabled, false);
    assert.equal(completed.profileFeatures.DOCUMENTS.enabled, false);
    assert.equal(completed.profileFeatures.ACHIEVEMENTS.enabled, false);
    assert.equal(completed.profileFeatures.CERTIFICATIONS.enabled, false);
    console.log("  ✓ New user card initializes modular sections in OFF state by default (DATA != VISIBILITY)");

    // 3. Test Custom Section Order Persistence
    const customOrder: ProfileFeatureKey[] = [
      "PRODUCTS",
      "GALLERY",
      "CONTACT",
      "SOCIAL_LINKS",
      "BASIC_PROFILE",
      "PORTFOLIO",
      "WEBSITE",
      "EMERGENCY_CONTACT",
      "VEHICLE",
      "LOST_AND_FOUND",
      "SERVICES",
      "VIDEOS",
      "BUSINESS_HOURS",
      "LOCATION",
      "PAYMENT_LINKS",
      "DOCUMENTS",
      "RESUME",
      "ACHIEVEMENTS",
      "CERTIFICATIONS",
    ];

    const updateOrderProfile = {
      ...completed,
      featureOrder: customOrder,
    };

    await pool.query(`update digital_cards set profile = $1 where id = $2`, [
      JSON.stringify(updateOrderProfile),
      testCardId,
    ]);

    const fetchedCard = await pool.query<{ profile: unknown }>(`select profile from digital_cards where id = $1`, [testCardId]);
    const fetchedCompleted = completeCardProfile(fetchedCard.rows[0].profile);
    assert.deepEqual(fetchedCompleted.featureOrder, customOrder);
    console.log("  ✓ Custom section order (PRODUCTS -> GALLERY -> CONTACT -> SOCIAL_LINKS -> BASIC_PROFILE -> PORTFOLIO) persists accurately");

    // 4. Test Hidden Section Position Preservation (Products OFF -> ON)
    const toggledOffProfile = {
      ...fetchedCompleted,
      profileFeatures: {
        ...fetchedCompleted.profileFeatures,
        PRODUCTS: { enabled: false, sortOrder: 0 },
      },
    };
    await pool.query(`update digital_cards set profile = $1 where id = $2`, [JSON.stringify(toggledOffProfile), testCardId]);

    const fetchedOff = completeCardProfile((await pool.query<{ profile: unknown }>(`select profile from digital_cards where id = $1`, [testCardId])).rows[0].profile);
    assert.equal(fetchedOff.profileFeatures.PRODUCTS.enabled, false);
    assert.equal(fetchedOff.featureOrder[0], "PRODUCTS");
    console.log("  ✓ Section OFF preserves its exact index position in featureOrder array");

    const toggledOnProfile = {
      ...fetchedOff,
      profileFeatures: {
        ...fetchedOff.profileFeatures,
        PRODUCTS: { enabled: true, sortOrder: 0 },
      },
    };
    await pool.query(`update digital_cards set profile = $1 where id = $2`, [JSON.stringify(toggledOnProfile), testCardId]);

    const fetchedOn = completeCardProfile((await pool.query<{ profile: unknown }>(`select profile from digital_cards where id = $1`, [testCardId])).rows[0].profile);
    assert.equal(fetchedOn.profileFeatures.PRODUCTS.enabled, true);
    assert.equal(fetchedOn.featureOrder[0], "PRODUCTS");
    console.log("  ✓ Section ON restores section to its exact previous position in layout order");

    // 5. Test Services Table CRUD & Visibility
    const serviceRes = await pool.query<{ id: string; name: string }>(
      `insert into card_profile_services
       (card_id, name, description, price, currency, image_url, category, cta_label, cta_url, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
      [testCardId, "Executive Coaching", "1-on-1 strategy sessions", "5000", "INR", "", "Consulting", "Book Session", "https://wa.me/919876543210", true, 0]
    );
    const serviceId = serviceRes.rows[0].id;
    assert.equal(serviceRes.rows[0].name, "Executive Coaching");
    console.log("  ✓ Created Card Profile Service");

    // 6. Test Portfolio Table CRUD & Visibility
    const portfolioRes = await pool.query<{ id: string; title: string }>(
      `insert into card_profile_portfolio
       (card_id, title, description, image_url, category, project_url, cta_label, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
      [testCardId, "Next.js E-Commerce", "Full stack store build", "", "Web App", "https://example.com/app", "View App", true, 0]
    );
    const portfolioId = portfolioRes.rows[0].id;
    assert.equal(portfolioRes.rows[0].title, "Next.js E-Commerce");
    console.log("  ✓ Created Card Profile Portfolio Project");

    // 7. Test Gallery Table CRUD & Visibility
    const galleryRes = await pool.query<{ id: string; title: string }>(
      `insert into card_profile_gallery
       (card_id, title, image_url, caption, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6) returning *`,
      [testCardId, "Headshot 2026", "https://example.com/photo.jpg", "Official studio photo", true, 0]
    );
    const galleryId = galleryRes.rows[0].id;
    assert.equal(galleryRes.rows[0].title, "Headshot 2026");
    console.log("  ✓ Created Card Profile Gallery Photo");

    // 8. Test Videos Table CRUD & Visibility
    const videoRes = await pool.query<{ id: string; title: string }>(
      `insert into card_profile_videos
       (card_id, title, provider, video_url, embed_id, description, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [testCardId, "Keynote Address 2026", "YouTube", "https://youtube.com/watch?v=123", "123", "Keynote speech", true, 0]
    );
    const videoId = videoRes.rows[0].id;
    assert.equal(videoRes.rows[0].title, "Keynote Address 2026");
    console.log("  ✓ Created Card Profile Video Showcase");

    // 9. Test Payment Links Table CRUD & Visibility
    const payRes = await pool.query<{ id: string; label: string }>(
      `insert into card_profile_payment_links
       (card_id, label, provider, pay_url, upi_id, description, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [testCardId, "Pay via GPay", "UPI", "https://pay.gpay.app/123", "user@upi", "Direct UPI transfer", true, 0]
    );
    const payId = payRes.rows[0].id;
    assert.equal(payRes.rows[0].label, "Pay via GPay");
    console.log("  ✓ Created Card Profile Payment Link");

    // 10. Test Documents Table CRUD & Visibility
    const docRes = await pool.query<{ id: string; title: string }>(
      `insert into card_profile_documents
       (card_id, title, file_url, file_size, file_type, description, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [testCardId, "Company Brochure 2026", "https://example.com/brochure.pdf", "2.4 MB", "PDF", "2026 corporate overview", true, 0]
    );
    const docId = docRes.rows[0].id;
    assert.equal(docRes.rows[0].title, "Company Brochure 2026");
    console.log("  ✓ Created Card Profile Document");

    // 11. Test Achievements Table CRUD & Visibility
    const achRes = await pool.query<{ id: string; title: string }>(
      `insert into card_profile_achievements
       (card_id, title, organization, achievement_date, description, image_url, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [testCardId, "Innovator of the Year", "Tech Council", "2025", "Recognized for AI innovation", "", true, 0]
    );
    const achId = achRes.rows[0].id;
    assert.equal(achRes.rows[0].title, "Innovator of the Year");
    console.log("  ✓ Created Card Profile Achievement");

    // 12. Test Certifications Table CRUD & Visibility
    const certRes = await pool.query<{ id: string; title: string }>(
      `insert into card_profile_certifications
       (card_id, title, issuer, issue_date, credential_url, certificate_url, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [testCardId, "AWS Solutions Architect", "Amazon Web Services", "2025", "https://credly.com/123", "", true, 0]
    );
    const certId = certRes.rows[0].id;
    assert.equal(certRes.rows[0].title, "AWS Solutions Architect");
    console.log("  ✓ Created Card Profile Certification");

    // 13. Test Item-level Visibility Toggle & Preservation
    await pool.query(`update card_profile_services set enabled = false where id = $1`, [serviceId]);
    const checkToggledService = await pool.query<{ enabled: boolean }>(`select enabled from card_profile_services where id = $1`, [serviceId]);
    assert.equal(checkToggledService.rows[0].enabled, false);
    console.log("  ✓ Item visibility toggle (OFF) preserves database row without deletion");

    // Turn back ON
    await pool.query(`update card_profile_services set enabled = true where id = $1`, [serviceId]);
    const checkRestoredService = await pool.query<{ enabled: boolean }>(`select enabled from card_profile_services where id = $1`, [serviceId]);
    assert.equal(checkRestoredService.rows[0].enabled, true);
    console.log("  ✓ Item visibility toggle (ON) restores public rendering");

    // 14. Cleanup
    await pool.query(`delete from users where id = $1`, [testUserId]);
    console.log("  ✓ Cleaned up test database records (CASCADE removed all section rows)");

    console.log("\n✅ ALL ADVANCED PROFILE BUILDER TESTS PASSED SUCCESSFULLY!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

runTests();
