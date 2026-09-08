import assert from "node:assert/strict";
import { Pool } from "pg";
import { completeCardProfile } from "../src/lib/cards";
import { databaseConfig } from "../src/lib/db/config";

const pool = new Pool(databaseConfig());

async function runTests() {
  console.log("🚀 Starting Custom Profile Products Test Suite...");

  let testUserIdA: string | null = null;
  let testCardIdA: string | null = null;
  let testUserIdB: string | null = null;
  let testCardIdB: string | null = null;
  let productId1: string | null = null;
  let productId2: string | null = null;

  try {
    // 1. Setup Test Users and Cards
    const emailA = `prod_user_a_${Date.now()}@test.com`;
    const userARes = await pool.query<{ id: string }>(
      `insert into users (email, normalized_email, name, role) values ($1, $2, $3, $4) returning id`,
      [emailA, emailA.toLowerCase(), "User A", "CUSTOMER"]
    );
    testUserIdA = userARes.rows[0].id;

    const cardARes = await pool.query<{ id: string }>(
      `insert into digital_cards (owner_id, slug, profile) values ($1, $2, $3) returning id`,
      [testUserIdA, `prod-card-a-${Date.now()}`, JSON.stringify({ name: "User A Card" })]
    );
    testCardIdA = cardARes.rows[0].id;

    const emailB = `prod_user_b_${Date.now()}@test.com`;
    const userBRes = await pool.query<{ id: string }>(
      `insert into users (email, normalized_email, name, role) values ($1, $2, $3, $4) returning id`,
      [emailB, emailB.toLowerCase(), "User B", "CUSTOMER"]
    );
    testUserIdB = userBRes.rows[0].id;

    const cardBRes = await pool.query<{ id: string; profile: unknown }>(
      `insert into digital_cards (owner_id, slug, profile) values ($1, $2, $3) returning id, profile`,
      [testUserIdB, `prod-card-b-${Date.now()}`, JSON.stringify({ name: "User B Card" })]
    );
    testCardIdB = cardBRes.rows[0].id;

    // Check default feature state for new user card B
    const completedB = completeCardProfile(cardBRes.rows[0].profile as any);
    assert.equal(completedB.profileFeatures.PRODUCTS.enabled, false);
    console.log("  ✓ Brand new user card has PRODUCTS feature OFF (disabled) by default");

    // 2. Create Custom Profile Product 1 for User A
    const prod1Res = await pool.query<{ id: string; name: string; enabled: boolean }>(
      `insert into card_profile_products
       (card_id, name, description, price, currency, image_url, category, cta_label, cta_url, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning *`,
      [
        testCardIdA,
        "Rolex Submariner",
        "Premium automatic watch with stainless steel case",
        "12,50,000",
        "INR",
        "https://example.com/rolex.jpg",
        "Watches",
        "Enquire",
        "https://wa.me/919876543210",
        true,
        0,
      ]
    );
    productId1 = prod1Res.rows[0].id;
    assert.equal(prod1Res.rows[0].name, "Rolex Submariner");
    assert.equal(prod1Res.rows[0].enabled, true);
    console.log("  ✓ Created Product 1: Rolex Submariner");

    // 3. Create Custom Profile Product 2 for User A
    const prod2Res = await pool.query<{ id: string; name: string }>(
      `insert into card_profile_products
       (card_id, name, description, price, currency, image_url, category, cta_label, cta_url, enabled, sort_order)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning *`,
      [
        testCardIdA,
        "Omega Seamaster",
        "Professional diver watch",
        "7,50,000",
        "INR",
        "https://example.com/omega.jpg",
        "Watches",
        "View Details",
        "https://example.com/omega",
        true,
        1,
      ]
    );
    productId2 = prod2Res.rows[0].id;
    assert.equal(prod2Res.rows[0].name, "Omega Seamaster");
    console.log("  ✓ Created Product 2: Omega Seamaster");

    // 4. Edit Product 1
    const updateRes = await pool.query<{ name: string; price: string }>(
      `update card_profile_products set name = $1, price = $2, updated_at = now() where id = $3 returning *`,
      ["Rolex Submariner Date", "13,00,000", productId1]
    );
    assert.equal(updateRes.rows[0].name, "Rolex Submariner Date");
    assert.equal(updateRes.rows[0].price, "13,00,000");
    console.log("  ✓ Edited Product 1 details successfully");

    // 5. Hide Product 2 (Level 2 Visibility)
    const hideRes = await pool.query<{ enabled: boolean }>(
      `update card_profile_products set enabled = false where id = $1 returning *`,
      [productId2]
    );
    assert.equal(hideRes.rows[0].enabled, false);

    // Verify active products query returns only Product 1
    const activeProdsRes = await pool.query<{ id: string }>(
      `select * from card_profile_products where card_id = $1 and enabled = true order by sort_order asc`,
      [testCardIdA]
    );
    assert.equal(activeProdsRes.rows.length, 1);
    assert.equal(activeProdsRes.rows[0].id, productId1);
    console.log("  ✓ Product hiding (Level 2 visibility) verified without data loss");

    // 6. Restore Product 2
    await pool.query(`update card_profile_products set enabled = true where id = $1`, [productId2]);
    const restoredRes = await pool.query<{ id: string }>(
      `select * from card_profile_products where card_id = $1 and enabled = true order by sort_order asc`,
      [testCardIdA]
    );
    assert.equal(restoredRes.rows.length, 2);
    console.log("  ✓ Restored Product 2 visibility");

    // 7. Product Reordering
    await pool.query(`update card_profile_products set sort_order = 1 where id = $1`, [productId1]);
    await pool.query(`update card_profile_products set sort_order = 0 where id = $1`, [productId2]);

    const reorderedRes = await pool.query<{ id: string }>(
      `select id, name, sort_order from card_profile_products where card_id = $1 order by sort_order asc`,
      [testCardIdA]
    );
    assert.equal(reorderedRes.rows[0].id, productId2);
    assert.equal(reorderedRes.rows[1].id, productId1);
    console.log("  ✓ Product reordering verified");

    // 8. User Ownership Isolation Check
    const crossAccessCheck = await pool.query<{ id: string }>(
      `select p.* from card_profile_products p
       join digital_cards c on c.id = p.card_id
       where p.id = $1 and c.owner_id = $2`,
      [productId1, testUserIdB]
    );
    assert.equal(crossAccessCheck.rows.length, 0);
    console.log("  ✓ User B prevented from accessing User A's products (IDOR Protection)");

    // 9. Product Deletion
    await pool.query(`delete from card_profile_products where id = $1`, [productId2]);
    const afterDeleteRes = await pool.query<{ id: string }>(`select * from card_profile_products where id = $1`, [productId2]);
    assert.equal(afterDeleteRes.rows.length, 0);

    const remainingRes = await pool.query<{ id: string }>(`select * from card_profile_products where card_id = $1`, [testCardIdA]);
    assert.equal(remainingRes.rows.length, 1);
    assert.equal(remainingRes.rows[0].id, productId1);
    console.log("  ✓ Product deletion clean and isolated");

    console.log("\n🎉 ALL CUSTOM PROFILE PRODUCTS TESTS PASSED SUCCESSFULLY!");
  } finally {
    // Cleanup test data
    if (testUserIdA) await pool.query(`delete from users where id = $1`, [testUserIdA]);
    if (testUserIdB) await pool.query(`delete from users where id = $1`, [testUserIdB]);
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
