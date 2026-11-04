import pg from "pg";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { getLeadAccessFilter, getLeadCreatorCondition } from "../src/lib/adminAuth.ts";
import { getDashboardSummaryData } from "../src/lib/crm.ts";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runTest() {
  console.log("=== STARTING CREATOR PRIVACY VERIFICATION TEST ===");

  // 1. Fetch or create test users
  const superAdminRes = await pool.query(
    "SELECT id, email, role, name FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1"
  );
  if (!superAdminRes.rows[0]) {
    throw new Error("No SUPER_ADMIN user found in database!");
  }
  const superAdmin = superAdminRes.rows[0];

  const standardUserRes = await pool.query(
    "SELECT id, email, role, name FROM users WHERE role != 'SUPER_ADMIN' AND id != $1 LIMIT 1",
    [superAdmin.id]
  );
  if (!standardUserRes.rows[0]) {
    throw new Error("No non-super-admin user found in database!");
  }
  const standardUser = standardUserRes.rows[0];

  const cardRes = await pool.query("SELECT id FROM cards LIMIT 1");
  const cardId = cardRes.rows[0]?.id || "e8365b40-846f-4d2c-9df8-8ddbf88c1567";

  console.log("Test Identities:");
  console.log(" - User A (Super Admin):", { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role });
  console.log(" - User B (Standard User):", { id: standardUser.id, email: standardUser.email, role: standardUser.role });
  console.log(" - Card ID:", cardId);

  const leadAId = uuidv4();
  const leadBId = uuidv4();

  try {
    // 2. Setup Test Leads
    // Lead A: Created by Super Admin (User A), assigned to Standard User (User B)
    await pool.query(
      `INSERT INTO leads (
        id, card_id, name, contact_number, contact_number_normalized, status, source,
        owner_user_id, assigned_user_id, created_by_user_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        leadAId,
        cardId,
        "TEST_LEAD_A_BY_SUPERADMIN",
        "+19999990001",
        "+19999990001",
        "NEW",
        "MANUAL",
        superAdmin.id,
        standardUser.id,
        superAdmin.id,
      ]
    );

    // Activity for Lead A
    await pool.query(
      `INSERT INTO lead_activities (
        lead_id, owner_user_id, type, description, occurred_at
      ) VALUES ($1, $2, 'LEAD_CREATED', 'Lead manually created by Super Admin', NOW())`,
      [leadAId, superAdmin.id]
    );

    // Lead B: Created by Standard User (User B), assigned to Super Admin (User A)
    await pool.query(
      `INSERT INTO leads (
        id, card_id, name, contact_number, contact_number_normalized, status, source,
        owner_user_id, assigned_user_id, created_by_user_id,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [
        leadBId,
        cardId,
        "TEST_LEAD_B_BY_STANDARD_USER",
        "+19999990002",
        "+19999990002",
        "NEW",
        "MANUAL",
        standardUser.id,
        superAdmin.id,
        standardUser.id,
      ]
    );

    // Activity for Lead B
    await pool.query(
      `INSERT INTO lead_activities (
        lead_id, owner_user_id, type, description, occurred_at
      ) VALUES ($1, $2, 'LEAD_CREATED', 'Lead manually created by Standard User', NOW())`,
      [leadBId, standardUser.id]
    );

    console.log("\nCreated Test Leads:");
    console.log(" - Lead A (created by Super Admin, assigned to User B):", leadAId);
    console.log(" - Lead B (created by User B, assigned to Super Admin):", leadBId);

    // 3. Test Dashboard Summary Data
    console.log("\n--- TEST 1: Dashboard Summary Data (Super Admin) ---");
    const dashSummary = await getDashboardSummaryData(superAdmin.id, {}, "SUPER_ADMIN");
    console.log("Dashboard totalLeads:", dashSummary.kpis.totalLeads);

    // Check pipeline items in dashboard summary
    const dashLeadIds = Object.values(dashSummary.pipeline || {}).flat().map((l) => l.id);
    const hasLeadAInDash = dashLeadIds.includes(leadAId);
    const hasLeadBInDash = dashLeadIds.includes(leadBId);

    console.log("Dashboard contains Lead A (should be true):", hasLeadAInDash);
    console.log("Dashboard contains Lead B (should be false):", hasLeadBInDash);

    if (!hasLeadAInDash) throw new Error("TEST FAILED: Super Admin dashboard missing personally created Lead A!");
    if (hasLeadBInDash) throw new Error("TEST FAILED: Super Admin dashboard contains Lead B created by another user!");

    // 4. Test Search / All Leads Query Logic
    console.log("\n--- TEST 2: Leads Search Query Logic (Super Admin) ---");
    const superAdminIdentity = {
      id: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
      name: superAdmin.name,
      featurePermissions: {},
    };
    const accessFilter = getLeadAccessFilter(superAdminIdentity, "l");

    const searchRes = await pool.query(
      `SELECT l.id, l.name, l.assigned_user_id, l.created_by_user_id 
       FROM leads l 
       WHERE ${accessFilter.whereClause}`,
      accessFilter.params
    );

    const searchLeadIds = searchRes.rows.map((r) => r.id);
    const hasLeadAInSearch = searchLeadIds.includes(leadAId);
    const hasLeadBInSearch = searchLeadIds.includes(leadBId);

    console.log("Search contains Lead A (should be true):", hasLeadAInSearch);
    console.log("Search contains Lead B (should be false):", hasLeadBInSearch);

    if (!hasLeadAInSearch) throw new Error("TEST FAILED: Super Admin search missing personally created Lead A!");
    if (hasLeadBInSearch) throw new Error("TEST FAILED: Super Admin search contains Lead B created by another user!");

    // 5. Test Export Query Logic
    console.log("\n--- TEST 3: Leads Export Query Logic (Super Admin) ---");
    const exportRes = await pool.query(
      `SELECT l.id, l.name, l.created_by_user_id, l.assigned_user_id
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_user_id
       LEFT JOIN users u_owner ON u_owner.id = l.owner_user_id
       LEFT JOIN users u_creator ON u_creator.id = l.created_by_user_id
       WHERE ${accessFilter.whereClause}`,
      accessFilter.params
    );

    const exportLeadIds = exportRes.rows.map((r) => r.id);
    const hasLeadAInExport = exportLeadIds.includes(leadAId);
    const hasLeadBInExport = exportLeadIds.includes(leadBId);

    console.log("Export contains Lead A (should be true):", hasLeadAInExport);
    console.log("Export contains Lead B (should be false):", hasLeadBInExport);

    if (!hasLeadAInExport) throw new Error("TEST FAILED: Export missing personally created Lead A!");
    if (hasLeadBInExport) throw new Error("TEST FAILED: Export contains Lead B created by another user!");

    // 6. Test Direct Single Lead Access (GET / PATCH / DELETE access clause)
    console.log("\n--- TEST 4: Direct Single Lead Access Clause (GET/PATCH/DELETE) ---");
    const creatorAccessClause = `(l.created_by_user_id = $2 OR (l.created_by_user_id IS NULL AND EXISTS (SELECT 1 FROM lead_activities la WHERE la.lead_id = l.id AND la.type = 'LEAD_CREATED' AND la.owner_user_id = $2)))`;

    // Attempt direct access to Lead A
    const directLeadARes = await pool.query(
      `SELECT l.id FROM leads l WHERE l.id = $1 AND ${creatorAccessClause}`,
      [leadAId, superAdmin.id]
    );
    const leadAGranted = directLeadARes.rows.length === 1;
    console.log("Super Admin accessing Lead A directly (should be GRANTED):", leadAGranted);
    if (!leadAGranted) throw new Error("TEST FAILED: Super Admin direct access to Lead A was denied!");

    // Attempt direct access to Lead B
    const directLeadBRes = await pool.query(
      `SELECT l.id FROM leads l WHERE l.id = $1 AND ${creatorAccessClause}`,
      [leadBId, superAdmin.id]
    );
    const leadBDenied = directLeadBRes.rows.length === 0;
    console.log("Super Admin accessing Lead B directly (should be DENIED):", leadBDenied);
    if (!leadBDenied) throw new Error("TEST FAILED: Super Admin direct access to Lead B was granted!");

    // 7. Verify Dashboard totalLeads matches All Leads total count
    console.log("\n--- TEST 5: Dashboard and All Leads Count Consistency ---");
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as total FROM leads l WHERE ${accessFilter.whereClause}`,
      accessFilter.params
    );
    const allLeadsTotal = countRes.rows[0].total;
    const dashboardTotal = dashSummary.kpis.totalLeads;

    console.log("All Leads total count:", allLeadsTotal);
    console.log("Dashboard totalLeads count:", dashboardTotal);

    if (allLeadsTotal !== dashboardTotal) {
      throw new Error(
        `TEST FAILED: Count mismatch! All Leads has ${allLeadsTotal} but Dashboard has ${dashboardTotal}`
      );
    }
    console.log("Counts perfectly match!");

    console.log("\n=== ALL CREATOR PRIVACY TESTS PASSED SUCCESSFULLY! ===");
  } finally {
    // Cleanup test records
    console.log("\nCleaning up test leads...");
    await pool.query("DELETE FROM lead_activities WHERE lead_id IN ($1, $2)", [leadAId, leadBId]);
    await pool.query("DELETE FROM leads WHERE id IN ($1, $2)", [leadAId, leadBId]);
    console.log("Cleanup complete.");
    await pool.end();
  }
}

runTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("FATAL ERROR in test execution:", err);
    process.exit(1);
  });
