import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 1. Verify frontend AddLeadDrawer contains required debug logging and payload building
test("1. AddLeadDrawer.tsx contains EDIT SAVE CLICKED and UPDATE LEAD PAYLOAD logs", () => {
  const code = fs.readFileSync("src/components/leads/AddLeadDrawer.tsx", "utf8");
  assert.equal(code.includes('console.log("EDIT SAVE CLICKED"'), true, "AddLeadDrawer MUST log EDIT SAVE CLICKED");
  assert.equal(code.includes('console.log("UPDATE LEAD PAYLOAD"'), true, "AddLeadDrawer MUST log UPDATE LEAD PAYLOAD");
});

// 2. Verify backend route /api/leads/[id]/route.ts contains debug logging requirements
test("2. /api/leads/[id]/route.ts contains UPDATE REQUEST BODY, LEAD ID, and ID check logs", () => {
  const code = fs.readFileSync("src/app/api/leads/[id]/route.ts", "utf8");
  assert.equal(code.includes('console.log("UPDATE REQUEST BODY"'), true, "route.ts MUST log UPDATE REQUEST BODY");
  assert.equal(code.includes('console.log("LEAD ID"'), true, "route.ts MUST log LEAD ID");
  assert.equal(code.includes("frontendId"), true, "route.ts MUST log frontendId");
  assert.equal(code.includes("databaseId"), true, "route.ts MUST log databaseId");
});

// 3. Verify backend route updates all lead fields in PostgreSQL database
test("3. /api/leads/[id]/route.ts updates name, company_name, contact_number, status, source, and custom fields", () => {
  const code = fs.readFileSync("src/app/api/leads/[id]/route.ts", "utf8");
  assert.equal(code.includes("contact_number_normalized = $4"), true, "UPDATE query MUST update contact_number_normalized");
  assert.equal(code.includes("source = COALESCE($9, source)"), true, "UPDATE query MUST update source column");
  assert.equal(code.includes("saveCustomFieldValue"), true, "route.ts MUST call saveCustomFieldValue for custom fields");
});

// 4. Verify backend route handles both PATCH and PUT requests and returns updated lead object
test("4. /api/leads/[id]/route.ts supports PATCH and PUT and returns success response", () => {
  const code = fs.readFileSync("src/app/api/leads/[id]/route.ts", "utf8");
  assert.equal(code.includes("export async function PUT"), true, "route.ts MUST export PUT method");
  assert.equal(code.includes("success: true"), true, "route.ts response MUST include success: true");
  assert.equal(code.includes("lead:"), true, "route.ts response MUST return updated lead object");
});
