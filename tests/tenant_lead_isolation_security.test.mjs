import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log("Skipping DB tenant isolation test (DATABASE_URL not set).");
  process.exit(0);
}

const pool = new Pool({ connectionString: databaseUrl });

test("SECURITY TEST: Multi-Tenant Lead Isolation", async (t) => {
  const userAId = "11111111-1111-4111-8111-111111111111";
  const userBId = "22222222-2222-4222-8222-222222222222";
  const cardAId = "11111111-1111-4111-8111-1111111111aa";
  const cardBId = "22222222-2222-4222-8222-2222222222bb";

  try {
    // 1. Cleanup old test data if present
    await pool.query("DELETE FROM leads WHERE owner_user_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM digital_cards WHERE owner_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2)", [userAId, userBId]);

    // 2. Insert User A and User B
    await pool.query(`
      INSERT INTO users (id, email, name, role, status, updated_at)
      VALUES 
        ($1, 'usera@test.com', 'User A', 'CUSTOMER', 'ACTIVE', NOW()),
        ($2, 'userb@test.com', 'User B', 'CUSTOMER', 'ACTIVE', NOW())
    `, [userAId, userBId]);

    // 3. Insert Digital Cards
    await pool.query(`
      INSERT INTO digital_cards (id, owner_id, slug, updated_at)
      VALUES 
        ($1, $2, 'card-usera-test', NOW()),
        ($3, $4, 'card-userb-test', NOW())
    `, [cardAId, userAId, cardBId, userBId]);

    // 4. Create Leads for User A and User B
    await pool.query(`
      INSERT INTO leads (id, owner_user_id, card_id, name, contact_number, contact_number_normalized, status, updated_at)
      VALUES 
        (gen_random_uuid(), $1, $2, 'Lead A1', '+919999900001', '+919999900001#test1', 'NEW', NOW()),
        (gen_random_uuid(), $1, $2, 'Lead A2', '+919999900002', '+919999900002#test2', 'NEW', NOW()),
        (gen_random_uuid(), $3, $4, 'Lead B1', '+919999900003', '+919999900003#test3', 'NEW', NOW()),
        (gen_random_uuid(), $3, $4, 'Lead B2', '+919999900004', '+919999900004#test4', 'NEW', NOW())
    `, [userAId, cardAId, userBId, cardBId]);

    // 5. Test Query for User A
    const userALeadsRes = await pool.query(
      `SELECT name FROM leads WHERE (owner_user_id = $1 OR assigned_user_id = $1) ORDER BY name ASC`,
      [userAId]
    );
    const userALeadNames = userALeadsRes.rows.map(r => r.name);
    console.log("User A returned leads:", userALeadNames);

    assert.deepEqual(userALeadNames, ["Lead A1", "Lead A2"], "User A MUST ONLY see Lead A1 and Lead A2");
    assert.equal(userALeadNames.includes("Lead B1"), false, "User A MUST NOT see Lead B1");
    assert.equal(userALeadNames.includes("Lead B2"), false, "User A MUST NOT see Lead B2");

    // 6. Test Query for User B
    const userBLeadsRes = await pool.query(
      `SELECT name FROM leads WHERE (owner_user_id = $1 OR assigned_user_id = $1) ORDER BY name ASC`,
      [userBId]
    );
    const userBLeadNames = userBLeadsRes.rows.map(r => r.name);
    console.log("User B returned leads:", userBLeadNames);

    assert.deepEqual(userBLeadNames, ["Lead B1", "Lead B2"], "User B MUST ONLY see Lead B1 and Lead B2");
    assert.equal(userBLeadNames.includes("Lead A1"), false, "User B MUST NOT see Lead A1");
    assert.equal(userBLeadNames.includes("Lead A2"), false, "User B MUST NOT see Lead A2");

    // 7. Test Search isolation (User A searching for "Lead B")
    const userASearchRes = await pool.query(
      `SELECT name FROM leads WHERE (owner_user_id = $1 OR assigned_user_id = $1) AND name ILIKE '%Lead B%'`,
      [userAId]
    );
    assert.equal(userASearchRes.rows.length, 0, "User A searching for User B leads MUST return 0 leads");

    console.log("✅ TENANT LEAD ISOLATION SECURITY TEST PASSED SUCCESSFULY!");
  } finally {
    // Cleanup
    await pool.query("DELETE FROM leads WHERE owner_user_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM digital_cards WHERE owner_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2)", [userAId, userBId]);
    await pool.end();
  }
});
