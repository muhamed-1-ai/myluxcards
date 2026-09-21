import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 1. Verify search/route.ts SQL queries do NOT contain non-existent columns (total_amount, advance_amount, address, lead_cycle)
test("1. /api/leads/search/route.ts SQL query schema verification", () => {
  const code = fs.readFileSync("src/app/api/leads/search/route.ts", "utf8");
  assert.equal(code.includes("l.total_amount"), false, "SQL query must NOT reference l.total_amount");
  assert.equal(code.includes("l.advance_amount"), false, "SQL query must NOT reference l.advance_amount");
  assert.equal(code.includes("l.address"), false, "SQL query must NOT reference l.address");
  assert.equal(code.includes("l.lead_cycle"), false, "SQL query must NOT reference l.lead_cycle");
});

// 2. Verify /api/leads/search/route.ts enforces strict account isolation (owner_user_id = $1)
test("2. /api/leads/search/route.ts enforces account isolation", () => {
  const code = fs.readFileSync("src/app/api/leads/search/route.ts", "utf8");
  assert.equal(code.includes("whereClause = \"l.owner_user_id = $1\""), true, "whereClause MUST mandate owner_user_id scoping");
  assert.equal(code.includes("owner_user_id = $1 AND status = 'SCHEDULED'"), true, "Subqueries MUST scope lead_follow_ups to owner_user_id");
  assert.equal(code.includes("owner_user_id = $1 AND type = 'REMARK'"), true, "Subqueries MUST scope lead_activities to owner_user_id");
});

// 3. Verify POST /api/leads auto-provisions digital card if missing
test("3. POST /api/leads auto-provisions digital card for new users", () => {
  const code = fs.readFileSync("src/app/api/leads/route.ts", "utf8");
  assert.equal(code.includes("INSERT INTO digital_cards"), true, "POST /api/leads MUST auto-provision digital_cards if missing");
  assert.equal(code.includes("UPDATE leads SET"), false, "POST /api/leads MUST NOT execute invalid UPDATE for non-existent columns");
});

// 4. Verify /api/admin/managed-users enforces requireAdmin security check
test("4. /api/admin/managed-users enforces requireAdmin security check", () => {
  const code = fs.readFileSync("src/app/api/admin/managed-users/route.ts", "utf8");
  assert.equal(code.includes("requireAdmin()"), true, "managed-users route MUST enforce requireAdmin check");
});

// 5. Verify /api/notifications/stream contains ping frames for SSE connection stability
test("5. /api/notifications/stream sends ping frames for connection stability", () => {
  const code = fs.readFileSync("src/app/api/notifications/stream/route.ts", "utf8");
  assert.equal(code.includes(":ping\\n\\n"), true, "Notification stream MUST send raw SSE :ping comment frames");
});
