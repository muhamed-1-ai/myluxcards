import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pool } from "../src/lib/db/core.ts";
import {
  getDashboardSummaryData,
  CANONICAL_LOST_STAGES,
  normalizeLostStageId,
  updateLeadStage,
} from "../src/lib/crm.ts";

test("LOB Analysis - Canonical Stage Catalog & Normalization", () => {
  // 1. Verify stable identifiers and canonical stage registry
  const stageIds = CANONICAL_LOST_STAGES.map((s) => s.stageId);
  assert.ok(stageIds.includes("NEW"), "Registry must include NEW");
  assert.ok(stageIds.includes("CONTACTED"), "Registry must include CONTACTED");
  assert.ok(stageIds.includes("INTERESTED"), "Registry must include INTERESTED");
  assert.ok(stageIds.includes("FOLLOW_UP"), "Registry must include FOLLOW_UP");
  assert.ok(stageIds.includes("PROPOSAL"), "Registry must include PROPOSAL");
  assert.ok(stageIds.includes("NEGOTIATION"), "Registry must include NEGOTIATION");

  // 2. Normalization handles whitespace, case, enums, and aliases
  assert.equal(normalizeLostStageId("NEW").stageId, "NEW");
  assert.equal(normalizeLostStageId("NEW / UNCONTACTED").stageId, "NEW");
  assert.equal(normalizeLostStageId("contacted").stageId, "CONTACTED");
  assert.equal(normalizeLostStageId("INTERESTED").stageId, "INTERESTED");
  assert.equal(normalizeLostStageId("FOLLOW_UP").stageId, "FOLLOW_UP");
  assert.equal(normalizeLostStageId("FOLLOW-UP").stageId, "FOLLOW_UP");
  assert.equal(normalizeLostStageId("Proposal").stageId, "PROPOSAL");
  assert.equal(normalizeLostStageId("PROPOSAL / DEMO").stageId, "PROPOSAL");
  assert.equal(normalizeLostStageId("negotiation").stageId, "NEGOTIATION");
  assert.equal(normalizeLostStageId("WON").stageId, "WON");

  // 3. Unknown historical records return Unknown / Unavailable and never guess
  assert.equal(normalizeLostStageId(null).stageId, "UNKNOWN");
  assert.equal(normalizeLostStageId("").stageId, "UNKNOWN");
  assert.equal(normalizeLostStageId("UNKNOWN").label, "Unknown / Unavailable");
});

test("LOB Analysis - UI Code Integrity & Elimination of Mock Fabrications", () => {
  const compCode = fs.readFileSync(
    "src/components/dashboard/LeadManagementDashboard.tsx",
    "utf8"
  );

  // Verify mock calculations are completely eliminated
  assert.equal(
    compCode.includes("lostCount * 0.35"),
    false,
    "Mock percentage 0.35 must NOT exist"
  );
  assert.equal(
    compCode.includes("0.35) || 4"),
    false,
    "Hardcoded fallback || 4 must NOT exist"
  );
  assert.equal(
    compCode.includes("0.25) || 3"),
    false,
    "Hardcoded fallback || 3 must NOT exist"
  );
  assert.equal(
    compCode.includes("0.20) || 2"),
    false,
    "Hardcoded fallback || 2 must NOT exist"
  );
  assert.equal(
    compCode.includes("Math.round(lostCount"),
    false,
    "Math.round(lostCount mock formula must NOT exist"
  );

  // Verify usage of real normalized lostLeadsByStage
  assert.ok(
    compCode.includes("data?.lostLeadsByStage"),
    "Component must use data.lostLeadsByStage"
  );
  assert.ok(
    compCode.includes("crm-lob-desktop-chart"),
    "Component must contain crm-lob-desktop-chart container"
  );
  assert.ok(
    compCode.includes("crm-lob-mobile-chart"),
    "Component must contain crm-lob-mobile-chart horizontal container"
  );
  assert.ok(
    compCode.includes("item.stageId"),
    "Component must use item.stageId as key"
  );
  assert.ok(
    compCode.includes("No lost leads in this period"),
    "Component must render genuine empty state"
  );

  // Verify responsive CSS in dashboard.css
  const cssCode = fs.readFileSync("src/app/dashboard/dashboard.css", "utf8");
  assert.ok(
    cssCode.includes(".crm-lob-desktop-chart"),
    "dashboard.css must declare .crm-lob-desktop-chart"
  );
  assert.ok(
    cssCode.includes(".crm-lob-mobile-chart"),
    "dashboard.css must declare .crm-lob-mobile-chart"
  );
  assert.ok(
    cssCode.includes(".crm-lob-hbar-row"),
    "dashboard.css must declare .crm-lob-hbar-row"
  );
  assert.ok(
    cssCode.includes(".crm-lob-hbar-track"),
    "dashboard.css must declare .crm-lob-hbar-track"
  );
  assert.ok(
    cssCode.includes(".crm-lob-hbar-fill"),
    "dashboard.css must declare .crm-lob-hbar-fill"
  );
});

test("LOB Analysis - Database Real Aggregation, Isolation, Real Zeros & Deduplication", async () => {
  const userAId = "99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const userBId = "99999999-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const cardAId = "88888888-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const cardBId = "88888888-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  try {
    // 1. Clean test records
    await pool.query("DELETE FROM lead_activities WHERE owner_user_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM leads WHERE owner_user_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM digital_cards WHERE owner_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2)", [userAId, userBId]);

    // 2. Insert test users and cards
    await pool.query(
      `INSERT INTO users (id, email, name, role, status, updated_at)
       VALUES 
         ($1, 'user-lob-a@test.com', 'User LOB A', 'CUSTOMER', 'ACTIVE', NOW()),
         ($2, 'user-lob-b@test.com', 'User LOB B', 'CUSTOMER', 'ACTIVE', NOW())`,
      [userAId, userBId]
    );

    await pool.query(
      `INSERT INTO digital_cards (id, owner_id, slug, updated_at)
       VALUES 
         ($1, $2, 'card-lob-a-test', NOW()),
         ($3, $4, 'card-lob-b-test', NOW())`,
      [cardAId, userAId, cardBId, userBId]
    );

    // 3. Create deliberate distinct counts for User A:
    // - New / Uncontacted: 4
    // - Contacted: 3
    // - Interested: 2
    // - Proposal: 1
    // - Negotiation: 0 (verified real zero!)
    // - Unknown / Unavailable: 1 (historical lead without stage history)

    const insertLead = async (userId, cardId, name, phone, stageBeforeLost, extraActivities = 0) => {
      const res = await pool.query(
        `INSERT INTO leads (
           id, owner_user_id, card_id, name, contact_number, contact_number_normalized, 
           status, lost_at_stage, updated_at
         ) VALUES (
           gen_random_uuid(), $1, $2, $3, $4, $4, 'LOST', $5, NOW()
         ) RETURNING id`,
        [userId, cardId, name, phone, stageBeforeLost]
      );
      const leadId = res.rows[0].id;

      // Insert lead activity records (testing duplicate join immunity)
      for (let i = 0; i <= extraActivities; i++) {
        await pool.query(
          `INSERT INTO lead_activities (owner_user_id, lead_id, type, from_value, to_value, description, occurred_at, created_at)
           VALUES ($1, $2, 'LEAD_LOST', $3, 'LOST', 'Marked as lost', NOW() - ($4 || ' hours')::interval, NOW())`,
          [userId, leadId, stageBeforeLost, i]
        );
      }
      return leadId;
    };

    // User A: 4 New leads
    for (let i = 1; i <= 4; i++) {
      await insertLead(userAId, cardAId, `Lead New ${i}`, `+91980000100${i}`, "NEW");
    }

    // User A: 3 Contacted leads (with 3 duplicate activity records on one lead to test deduplication!)
    await insertLead(userAId, cardAId, "Lead Contacted 1", "+919800002001", "CONTACTED", 3);
    await insertLead(userAId, cardAId, "Lead Contacted 2", "+919800002002", "CONTACTED");
    await insertLead(userAId, cardAId, "Lead Contacted 3", "+919800002003", "CONTACTED");

    // User A: 2 Interested leads
    await insertLead(userAId, cardAId, "Lead Interested 1", "+919800003001", "INTERESTED");
    await insertLead(userAId, cardAId, "Lead Interested 2", "+919800003002", "INTERESTED");

    // User A: 1 Proposal lead
    await insertLead(userAId, cardAId, "Lead Proposal 1", "+919800004001", "PROPOSAL");

    // User A: 1 Historical lead with NULL lost_at_stage and NO activity history (testing Unknown)
    await pool.query(
      `INSERT INTO leads (
         id, owner_user_id, card_id, name, contact_number, contact_number_normalized, 
         status, lost_at_stage, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, 'Old Historical Lead', '+919800009999', '+919800009999', 'LOST', NULL, NOW()
       )`,
      [userAId, cardAId]
    );

    // User B: 5 Negotiation leads (must NOT leak into User A)
    for (let i = 1; i <= 5; i++) {
      await insertLead(userBId, cardBId, `Lead B Neg ${i}`, `+91980000500${i}`, "NEGOTIATION");
    }

    // 4. Fetch dashboard summary for User A
    const summaryA = await getDashboardSummaryData(userAId, {}, "CUSTOMER");
    const lostA = summaryA.lostLeadsByStage;

    assert.ok(Array.isArray(lostA), "lostLeadsByStage must be an array");

    const getStageCount = (stageId) => lostA.find((s) => s.stageId === stageId)?.count ?? 0;

    // Verify exact independent counts for User A
    assert.equal(getStageCount("NEW"), 4, "New / Uncontacted MUST be exactly 4");
    assert.equal(getStageCount("CONTACTED"), 3, "Contacted MUST be exactly 3 (deduplicated!)");
    assert.equal(getStageCount("INTERESTED"), 2, "Interested MUST be exactly 2");
    assert.equal(getStageCount("PROPOSAL"), 1, "Proposal MUST be exactly 1");
    assert.equal(getStageCount("NEGOTIATION"), 0, "Negotiation MUST be strictly 0 (no leakage from User B)");
    assert.equal(getStageCount("UNKNOWN"), 1, "Historical lead with no prior stage MUST be 1 in Unknown");

    // Total leads: 4 + 3 + 2 + 1 + 0 + 1 = 11 lost leads for User A
    const totalA = lostA.reduce((sum, s) => sum + s.count, 0);
    assert.equal(totalA, 11, "Sum of lostLeadsByStage MUST equal total lost leads");
    assert.equal(summaryA.kpis.lostLeads, 11, "KPI lostLeads MUST match sum of lostLeadsByStage");

    // 5. Multi-Tenant Isolation check for User B
    const summaryB = await getDashboardSummaryData(userBId, {}, "CUSTOMER");
    const lostB = summaryB.lostLeadsByStage;
    const getStageCountB = (stageId) => lostB.find((s) => s.stageId === stageId)?.count ?? 0;

    assert.equal(getStageCountB("NEGOTIATION"), 5, "User B MUST have 5 in Negotiation");
    assert.equal(getStageCountB("NEW"), 0, "User B MUST have 0 in NEW (User A's leads isolated)");

    // 6. Test Atomic Transition in updateLeadStage
    const activeLeadRes = await pool.query(
      `INSERT INTO leads (
         id, owner_user_id, card_id, name, contact_number, contact_number_normalized, 
         status, updated_at
       ) VALUES (
         gen_random_uuid(), $1, $2, 'Transition Test Lead', '+919800007777', '+919800007777', 'INTERESTED', NOW()
       ) RETURNING id`,
      [userAId, cardAId]
    );
    const activeLeadId = activeLeadRes.rows[0].id;

    // Transition from INTERESTED to LOST
    await updateLeadStage(userAId, activeLeadId, "LOST");
    const transitionedLead = (
      await pool.query("SELECT status, lost_at_stage FROM leads WHERE id = $1", [activeLeadId])
    ).rows[0];
    assert.equal(transitionedLead.status, "LOST");
    assert.equal(transitionedLead.lost_at_stage, "INTERESTED", "Transition to LOST atomically saves previous stage");

    // Reopen from LOST to CONTACTED
    await updateLeadStage(userAId, activeLeadId, "CONTACTED");
    const reopenedLead = (
      await pool.query("SELECT status, lost_at_stage FROM leads WHERE id = $1", [activeLeadId])
    ).rows[0];
    assert.equal(reopenedLead.status, "CONTACTED");
    assert.equal(reopenedLead.lost_at_stage, null, "Reopening clears lost_at_stage to null");

  } finally {
    // Cleanup test records
    await pool.query("DELETE FROM lead_activities WHERE owner_user_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM leads WHERE owner_user_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM digital_cards WHERE owner_id IN ($1, $2)", [userAId, userBId]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2)", [userAId, userBId]);
  }
});
