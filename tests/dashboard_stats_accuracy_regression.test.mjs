import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pool } from "../src/lib/db/core.ts";
import { getDashboardSummaryData } from "../src/lib/crm.ts";

test("1. Frontend Code Integrity - No hardcoded mock fallbacks or falsy number overrides", () => {
  const code = fs.readFileSync("src/components/dashboard/LeadManagementDashboard.tsx", "utf8");

  // Ensure '|| 811' and '|| 1' are completely eliminated
  assert.equal(code.includes("|| 811"), false, "LeadManagementDashboard MUST NOT contain '|| 811'");
  assert.equal(code.includes("|| 1"), false, "LeadManagementDashboard MUST NOT contain '|| 1'");
  assert.equal(code.includes("totalLeads: 811"), false, "kpis fallback MUST NOT contain totalLeads: 811");
  assert.equal(code.includes('activeUsersVal = "6"'), false, "activeUsersVal MUST NOT be hardcoded to '6'");

  // Ensure DEFAULT_PIPELINE_COUNTS are all zero
  assert.equal(code.includes("NEW: 13"), false, "DEFAULT_PIPELINE_COUNTS MUST NOT contain NEW: 13");
  assert.equal(code.includes("CONTACTED: 8"), false, "DEFAULT_PIPELINE_COUNTS MUST NOT contain CONTACTED: 8");

  // Ensure card values render genuine counts
  assert.ok(code.includes("kpis.totalLeads ?? 0"), "Total leads card must render kpis.totalLeads ?? 0");
  assert.ok(code.includes("kpis.closedLeads ?? kpis.wonLeads ?? 0"), "Closed leads card must render closedLeads/wonLeads ?? 0");
});

test("2. Confirmed Empty Account - Returns real zeroes across all lead statistics", async () => {
  const emptyUserId = "77777777-0000-4000-8000-000000000001";
  try {
    await pool.query("DELETE FROM leads WHERE owner_user_id = $1", [emptyUserId]);
    await pool.query("DELETE FROM users WHERE id = $1", [emptyUserId]);
    await pool.query(
      `INSERT INTO users (id, email, name, role, status) VALUES ($1, 'empty_acc_test@zappit.app', 'Empty User', 'CUSTOMER', 'ACTIVE')`,
      [emptyUserId]
    );

    const summary = await getDashboardSummaryData(emptyUserId, {}, "CUSTOMER");

    assert.equal(summary.kpis.totalLeads, 0, "totalLeads must be 0 for empty account");
    assert.equal(summary.kpis.todaysLeads, 0, "todaysLeads must be 0 for empty account");
    assert.equal(summary.kpis.newLeads, 0, "newLeads must be 0 for empty account");
    assert.equal(summary.kpis.wonLeads, 0, "wonLeads must be 0 for empty account");
    assert.equal(summary.kpis.closedLeads, 0, "closedLeads must be 0 for empty account");
    assert.equal(summary.kpis.conversionRate, 0, "conversionRate must be 0 without division by zero errors");
    assert.equal(summary.kpis.activeUsers, 1, "activeUsers must be 1 for a single active workspace user");

    for (const [stage, count] of Object.entries(summary.pipelineCounts)) {
      assert.equal(count, 0, `pipelineCounts[${stage}] must be 0`);
    }
  } finally {
    await pool.query("DELETE FROM users WHERE id = $1", [emptyUserId]);
  }
});

test("3. Small Known Dataset - Accurate metric aggregation and conversion rates", async () => {
  const testUserId = "77777777-1111-4111-8111-111111111111";
  const testCardId = "77777777-2222-4222-8222-222222222222";

  try {
    // Cleanup
    await pool.query("DELETE FROM leads WHERE owner_user_id = $1", [testUserId]);
    await pool.query("DELETE FROM digital_cards WHERE id = $1", [testCardId]);
    await pool.query("DELETE FROM users WHERE id = $1", [testUserId]);

    // Setup
    await pool.query(
      `INSERT INTO users (id, email, name, role, status) VALUES ($1, 'known_dataset@zappit.app', 'Dataset User', 'CUSTOMER', 'ACTIVE')`,
      [testUserId]
    );
    await pool.query(
      `INSERT INTO digital_cards (id, owner_id, slug) VALUES ($1, $2, 'known-card-slug')`,
      [testCardId, testUserId]
    );

    // Insert 4 leads:
    // - Lead 1: NEW (created today)
    // - Lead 2: CONTACTED (created today)
    // - Lead 3: WON (closed deal, created yesterday)
    // - Lead 4: LOST (lost deal, created 2 days ago)
    await pool.query(
      `INSERT INTO leads (id, owner_user_id, card_id, name, contact_number, contact_number_normalized, status, created_at, updated_at)
       VALUES 
         (gen_random_uuid(), $1, $2, 'Lead 1', '+919999900001', '+919999900001', 'NEW', NOW(), NOW()),
         (gen_random_uuid(), $1, $2, 'Lead 2', '+919999900002', '+919999900002', 'CONTACTED', NOW(), NOW()),
         (gen_random_uuid(), $1, $2, 'Lead 3', '+919999900003', '+919999900003', 'WON', NOW() - INTERVAL '1 day', NOW()),
         (gen_random_uuid(), $1, $2, 'Lead 4', '+919999900004', '+919999900004', 'LOST', NOW() - INTERVAL '2 days', NOW())`,
      [testUserId, testCardId]
    );

    const summary = await getDashboardSummaryData(testUserId, {}, "CUSTOMER");

    assert.equal(summary.kpis.totalLeads, 4, "Total leads must equal 4");
    assert.equal(summary.kpis.todaysLeads, 2, "Today's leads must equal 2 (Lead 1 & Lead 2 created today)");
    assert.equal(summary.kpis.newLeads, 1, "New leads must equal 1");
    assert.equal(summary.kpis.contactedLeads, 1, "Contacted leads must equal 1");
    assert.equal(summary.kpis.wonLeads, 1, "Won leads must equal 1");
    assert.equal(summary.kpis.closedLeads, 1, "Closed leads must equal 1");
    assert.equal(summary.kpis.lostLeads, 1, "Lost leads must equal 1");
    // 1 won / 4 total = 25.0%
    assert.equal(summary.kpis.conversionRate, 25.0, "Conversion rate must be accurately 25.0%");

    assert.equal(summary.pipelineCounts.NEW, 1);
    assert.equal(summary.pipelineCounts.CONTACTED, 1);
    assert.equal(summary.pipelineCounts.WON, 1);
    assert.equal(summary.pipelineCounts.LOST, 1);
    assert.equal(summary.pipelineCounts.INTERESTED, 0);
    assert.equal(summary.pipelineCounts.FOLLOW_UP, 0);

    // Test filtering by stage 'WON'
    const wonSummary = await getDashboardSummaryData(testUserId, { stage: "WON" }, "CUSTOMER");
    assert.equal(wonSummary.kpis.totalLeads, 1);
    assert.equal(wonSummary.kpis.wonLeads, 1);

    // Test filter that returns zero results: stage 'INTERESTED'
    const interestedSummary = await getDashboardSummaryData(testUserId, { stage: "INTERESTED" }, "CUSTOMER");
    assert.equal(interestedSummary.kpis.totalLeads, 0, "Filtered zero results must remain 0");
    assert.equal(interestedSummary.kpis.wonLeads, 0);

  } finally {
    await pool.query("DELETE FROM leads WHERE owner_user_id = $1", [testUserId]);
    await pool.query("DELETE FROM digital_cards WHERE id = $1", [testCardId]);
    await pool.query("DELETE FROM users WHERE id = $1", [testUserId]);
  }
});

test("4. Multi-Tenant User Isolation - Account A never leaks into Account B", async () => {
  const userAId = "77777777-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userBId = "77777777-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const cardAId = "77777777-aaaa-4aaa-8aaa-cccccccccccc";

  try {
    await pool.query("DELETE FROM leads WHERE owner_user_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM digital_cards WHERE id = $1", [cardAId]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2)", [userAId, userBId]);

    await pool.query(
      `INSERT INTO users (id, email, name, role, status) VALUES 
         ($1, 'userA@test.com', 'User A', 'CUSTOMER', 'ACTIVE'),
         ($2, 'userB@test.com', 'User B', 'CUSTOMER', 'ACTIVE')`,
      [userAId, userBId]
    );
    await pool.query(`INSERT INTO digital_cards (id, owner_id, slug) VALUES ($1, $2, 'slug-a')`, [cardAId, userAId]);

    // Insert 5 leads for User A
    await pool.query(
      `INSERT INTO leads (id, owner_user_id, card_id, name, contact_number, contact_number_normalized, status, created_at, updated_at)
       VALUES 
         (gen_random_uuid(), $1, $2, 'Lead A1', '+919999911111', '+919999911111', 'NEW', NOW(), NOW()),
         (gen_random_uuid(), $1, $2, 'Lead A2', '+919999911112', '+919999911112', 'NEW', NOW(), NOW())`,
      [userAId, cardAId]
    );

    const summaryA = await getDashboardSummaryData(userAId, {}, "CUSTOMER");
    const summaryB = await getDashboardSummaryData(userBId, {}, "CUSTOMER");

    assert.equal(summaryA.kpis.totalLeads, 2, "User A must see 2 leads");
    assert.equal(summaryB.kpis.totalLeads, 0, "User B must see 0 leads (zero leak)");
  } finally {
    await pool.query("DELETE FROM leads WHERE owner_user_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM digital_cards WHERE id = $1", [cardAId]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2)", [userAId, userBId]);
  }
});

test.after(async () => {
  await pool.end();
});

