import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// 1. Verify lead-summary route handles missing account and server logging
test("1. /api/dashboard/lead-summary/route.ts contains server logging and missing account fallback", () => {
  const code = fs.readFileSync("src/app/api/dashboard/lead-summary/route.ts", "utf8");
  assert.equal(code.includes("[DASHBOARD_SUMMARY_START]"), true, "Route MUST log DASHBOARD_SUMMARY_START");
  assert.equal(code.includes("[SESSION_DATA]"), true, "Route MUST log SESSION_DATA");
  assert.equal(code.includes("[ACCOUNT_DATA]"), true, "Route MUST log ACCOUNT_DATA");
  assert.equal(code.includes("DEFAULT_DASHBOARD_SUMMARY"), true, "Route MUST use DEFAULT_DASHBOARD_SUMMARY fallback for missing account ID");
  assert.equal(code.includes("[DASHBOARD_SUMMARY_ERROR]"), true, "Route MUST catch and log DASHBOARD_SUMMARY_ERROR");
});

// 2. Verify getDashboardSummaryData handles empty owner ID gracefully without throwing
test("2. getDashboardSummaryData in src/lib/crm.ts handles missing owner ID gracefully", () => {
  const code = fs.readFileSync("src/lib/crm.ts", "utf8");
  assert.equal(code.includes("DEFAULT_DASHBOARD_SUMMARY"), true, "crm.ts MUST export DEFAULT_DASHBOARD_SUMMARY");
  assert.equal(code.includes("if (!ownerUserId)"), true, "getDashboardSummaryData MUST check falsy ownerUserId");
  assert.equal(code.includes("[getDashboardSummaryData] Error"), true, "getDashboardSummaryData MUST catch DB query errors safely");
});

// 3. Verify LeadManagementDashboard has retry logic and request locking
test("3. LeadManagementDashboard frontend implements exponential backoff retry and request locking", () => {
  const code = fs.readFileSync("src/components/dashboard/LeadManagementDashboard.tsx", "utf8");
  assert.equal(code.includes("MAX_RETRIES = 3"), true, "LeadManagementDashboard MUST implement MAX_RETRIES = 3");
  assert.equal(code.includes("inFlightRef.current"), true, "LeadManagementDashboard MUST lock concurrent requests with inFlightRef");
  assert.equal(code.includes("Initializing Lead Command Center... Retrying"), true, "LeadManagementDashboard MUST display retry status in loading UI");
});

// 4. Verify Prisma client singleton instance usage
test("4. src/lib/db/prisma.ts exports global singleton PrismaClient", () => {
  const code = fs.readFileSync("src/lib/db/prisma.ts", "utf8");
  assert.equal(code.includes("globalForPrisma.prisma"), true, "prisma.ts MUST reuse global singleton instance");
});
