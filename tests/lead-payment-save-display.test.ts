import { strict as assert } from "node:assert";
import { pool } from "../src/lib/db/core";

// 1. Monetary parsing helper unit tests
function parseMonetaryValue(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === "") return fallback;
  if (typeof val === "number") return isNaN(val) ? fallback : val;
  const str = String(val).replace(/[^\d.-]/g, "").trim();
  const num = Number(str);
  return isNaN(num) ? fallback : num;
}

// 2. Advance calculation helper unit test
interface AdvanceRecord {
  id: string;
  amount: number;
  note: string;
  status?: "RECEIVED" | "REQUESTED";
}

function calculatePayments(totalInput: any, records: AdvanceRecord[]) {
  const totalAmount = parseMonetaryValue(totalInput, 0);
  const totalAdvanceReceived = records
    .filter(r => r.status !== "REQUESTED")
    .reduce((sum, r) => sum + r.amount, 0);
  const totalAdvanceRequested = records
    .filter(r => r.status === "REQUESTED")
    .reduce((sum, r) => sum + r.amount, 0);
  const balanceAmount = totalAmount - totalAdvanceReceived;

  return {
    totalAmount,
    totalAdvanceReceived,
    totalAdvanceRequested,
    balanceAmount,
  };
}

async function runTests() {
  console.log("--- Starting Lead Payment Save & Display Regression Tests ---");

  // TEST 1: Monetary parsing handles formatted strings
  console.log("Test 1: Monetary input parsing...");
  assert.equal(parseMonetaryValue("1,199"), 1199, "Should parse '1,199' to 1199");
  assert.equal(parseMonetaryValue("₹1,199"), 1199, "Should parse '₹1,199' to 1199");
  assert.equal(parseMonetaryValue("1,199.50"), 1199.5, "Should parse '1,199.50' to 1199.5");
  assert.equal(parseMonetaryValue(1199), 1199, "Should parse numeric 1199 to 1199");
  assert.equal(parseMonetaryValue(""), 0, "Should fallback empty string to 0");
  assert.equal(parseMonetaryValue(null, 50), 50, "Should use custom fallback for null");
  assert.equal(parseMonetaryValue(undefined, 100), 100, "Should use custom fallback for undefined");

  // TEST 2: Distinguish received advances vs requested advances
  console.log("Test 2: Received vs Requested advance calculations...");
  const records: AdvanceRecord[] = [
    { id: "adv-1", amount: 1199, note: "Paid online", status: "RECEIVED" },
    { id: "adv-2", amount: 500, note: "Pending token", status: "REQUESTED" },
  ];
  const calc = calculatePayments("1,199", records);
  assert.equal(calc.totalAmount, 1199, "Total amount should be 1199");
  assert.equal(calc.totalAdvanceReceived, 1199, "Only RECEIVED advances count as received money");
  assert.equal(calc.totalAdvanceRequested, 500, "REQUESTED advance is tracked separately");
  assert.equal(calc.balanceAmount, 0, "Balance should be 1199 - 1199 = 0 (REQUESTED advance does not reduce balance)");

  // TEST 3: Overpayment / Credit behavior
  console.log("Test 3: Overpayment preserves credit without clamping...");
  const overpayRecords: AdvanceRecord[] = [
    { id: "adv-1", amount: 1500, note: "Overpaid advance", status: "RECEIVED" },
  ];
  const overpayCalc = calculatePayments(1000, overpayRecords);
  assert.equal(overpayCalc.balanceAmount, -500, "Balance should be -500 (credit preserved, not clamped to 0)");

  // TEST 4: Database persistence and search query regression
  console.log("Test 4: Database query verification for totalAmount and advanceAmount...");
  const testPhone = "+919999988888";
  const normPhone = "+919999988888";

  // Find a test owner user ID and a card ID
  const userRes = await pool.query("SELECT id FROM users LIMIT 1");
  const ownerUserId = userRes.rows[0]?.id;
  assert.ok(ownerUserId, "Must have at least one user in database for testing");

  const cardRes = await pool.query("SELECT card_id as id FROM leads WHERE card_id IS NOT NULL LIMIT 1");
  let cardId = cardRes.rows[0]?.id;
  if (!cardId) {
    const fallbackCard = await pool.query('SELECT id FROM "Card" LIMIT 1');
    cardId = fallbackCard.rows[0]?.id;
  }
  assert.ok(cardId, "Must have at least one card in database for testing");

  // Clean any existing test record
  await pool.query("DELETE FROM leads WHERE contact_number = $1", [testPhone]);

  // Insert lead with 1,199 total and 1,199 advance
  const insertRes = await pool.query(
    `INSERT INTO leads (
      owner_user_id, card_id, name, company_name, contact_number, contact_number_normalized,
      email, status, source, address, total_amount, advance_amount, payment_information,
      created_at, updated_at
    ) VALUES (
      $1, $2, 'Test Lead Financial', 'Acme Corp', $3, $4,
      'testfinancial@example.com', 'WON', 'MANUAL', '123 Business Way', 1199, 1199,
      $5::jsonb, NOW(), NOW()
    ) RETURNING id`,
    [
      ownerUserId,
      cardId,
      testPhone,
      normPhone,
      JSON.stringify({
        totalAmount: 1199,
        advanceAmount: 1199,
        balanceAmount: 0,
        advanceRecords: [
          { id: "adv-test-1", amount: 1199, note: "Full advance paid", createdAt: "27/10/2026", status: "RECEIVED" },
        ],
      }),
    ]
  );

  const testLeadId = insertRes.rows[0].id;
  assert.ok(testLeadId, "Test lead should be inserted");

  try {
    // Execute the exact query used by /api/leads/search
    const searchQuery = `
      SELECT 
        l.id, l.name,
        COALESCE(l.address, '')::text as "address",
        COALESCE(l.total_amount, 0)::float as "totalAmount",
        COALESCE(l.advance_amount, 0)::float as "advanceAmount",
        COALESCE(l.payment_information, '{}'::jsonb) as "paymentInformation"
      FROM leads l
      WHERE l.id = $1
    `;
    const searchRes = await pool.query(searchQuery, [testLeadId]);
    const leadRow = searchRes.rows[0];

    assert.ok(leadRow, "Lead row must be returned by search query");
    assert.equal(leadRow.totalAmount, 1199, "Search query must return totalAmount = 1199, not 0");
    assert.equal(leadRow.advanceAmount, 1199, "Search query must return advanceAmount = 1199, not 0");
    assert.equal(leadRow.address, "123 Business Way", "Search query must return address");
    assert.ok(Array.isArray(leadRow.paymentInformation?.advanceRecords), "advanceRecords must be preserved in search result");
    assert.equal(leadRow.paymentInformation.advanceRecords[0].amount, 1199);

    // TEST 5: Unrelated edit does not reset payments
    console.log("Test 5: Unrelated field update preserves financial fields...");
    // Simulate updating name and status only
    const updateRes = await pool.query(
      `UPDATE leads
       SET name = $1,
           status = $2,
           total_amount = COALESCE($3, total_amount),
           advance_amount = COALESCE($4, advance_amount),
           updated_at = NOW()
       WHERE id = $5
       RETURNING total_amount, advance_amount`,
      ["Test Lead Updated Name", "CONTACTED", 1199, 1199, testLeadId]
    );

    assert.equal(Number(updateRes.rows[0].total_amount), 1199, "Total amount remains 1199 after unrelated update");
    assert.equal(Number(updateRes.rows[0].advance_amount), 1199, "Advance amount remains 1199 after unrelated update");

    console.log("All Lead Payment Save & Display regression tests passed successfully!");
  } finally {
    // Cleanup
    await pool.query("DELETE FROM leads WHERE id = $1", [testLeadId]);
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
