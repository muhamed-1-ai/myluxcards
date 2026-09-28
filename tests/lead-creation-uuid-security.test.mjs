import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("1. POST /api/leads injects session user ID as ownerId and ignores invalid strings", () => {
  const code = fs.readFileSync("src/app/api/leads/route.ts", "utf8");
  assert.equal(code.includes('const ownerUserId = identity.id;'), true, "POST /api/leads MUST set ownerUserId from identity.id");
  assert.equal(code.includes('isValidUuid(identity.id)'), true, "POST /api/leads MUST validate identity.id is a UUID");
  assert.equal(code.includes('safeAssignedUserId'), true, "POST /api/leads MUST sanitize assignedUserId");
});

test("2. GET /api/leads exists and requires authentication", () => {
  const code = fs.readFileSync("src/app/api/leads/route.ts", "utf8");
  assert.equal(code.includes('export async function GET(request: Request)'), true, "GET /api/leads route MUST exist");
  assert.equal(code.includes('Not authenticated.'), true, "GET /api/leads MUST return 401 when unauthenticated");
});

test("3. src/lib/leads.ts validates ownerUserId and assignedUserId as UUIDs", () => {
  const code = fs.readFileSync("src/lib/leads.ts", "utf8");
  assert.equal(code.includes('Invalid owner user ID. Must be a valid UUID.'), true, "upsertLead MUST reject non-UUID ownerUserId");
  assert.equal(code.includes('safeAssignedUserId'), true, "validateLeadInput MUST sanitize assignedUserId to null if not a valid UUID");
});

test("4. AddLeadModal and AddLeadDrawer contain NO hardcoded 'admin' identity fallbacks", () => {
  const modalCode = fs.readFileSync("src/components/dashboard/AddLeadModal.tsx", "utf8");
  assert.equal(modalCode.includes('id: "admin"'), false, "AddLeadModal MUST NOT hardcode id: 'admin'");

  const drawerCode = fs.readFileSync("src/components/leads/AddLeadDrawer.tsx", "utf8");
  assert.equal(drawerCode.includes('assignedUserId: identity?.id || ""'), false, "AddLeadDrawer MUST NOT blindly assign invalid identity.id");
});

test("5. GET /api/admin/managed-users validates session and role permissions", () => {
  const code = fs.readFileSync("src/app/api/admin/managed-users/route.ts", "utf8");
  assert.equal(code.includes('currentIdentity(request)'), true, "GET /api/admin/managed-users MUST pass request to currentIdentity");
  assert.equal(code.includes('status: 403'), true, "GET /api/admin/managed-users MUST return 403 Forbidden for non-admin roles");
});
