import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const currentIdentityModule = readFileSync(new URL("../src/lib/auth/currentIdentity.ts", import.meta.url), "utf8");
const adminAuthModule = readFileSync(new URL("../src/lib/adminAuth.ts", import.meta.url), "utf8");
const apiClientModule = readFileSync(new URL("../src/lib/apiClient.ts", import.meta.url), "utf8");
const leadSummaryApi = readFileSync(new URL("../src/app/api/dashboard/lead-summary/route.ts", import.meta.url), "utf8");
const unreadCountApi = readFileSync(new URL("../src/app/api/notifications/unread-count/route.ts", import.meta.url), "utf8");
const streamApi = readFileSync(new URL("../src/app/api/notifications/stream/route.ts", import.meta.url), "utf8");
const crmCalendarApi = readFileSync(new URL("../src/app/api/dashboard/crm-calendar/route.ts", import.meta.url), "utf8");
const leadDashboardComp = readFileSync(new URL("../src/components/dashboard/LeadManagementDashboard.tsx", import.meta.url), "utf8");
const notificationBellComp = readFileSync(new URL("../src/components/NotificationBell.tsx", import.meta.url), "utf8");

test("Centralized authentication module src/lib/auth/currentIdentity.ts is single source of truth", () => {
  assert.match(currentIdentityModule, /export async function currentIdentity/);
  assert.match(currentIdentityModule, /getServerSession\(authOptions\)/);
  assert.match(currentIdentityModule, /getToken\(\{ req/);
  assert.match(currentIdentityModule, /findUserById/);
  assert.match(currentIdentityModule, /profile\.session_version !== tokenSessionVersion/);
});

test("currentIdentity outputs structured [AUTH_DEBUG] logs without logging secrets", () => {
  assert.match(currentIdentityModule, /\[AUTH_DEBUG\]/);
  assert.match(currentIdentityModule, /logAuthDebug/);
  assert.doesNotMatch(currentIdentityModule, /console\.log\(.*password/i);
  assert.doesNotMatch(currentIdentityModule, /console\.log\(.*token\.secret/i);
});

test("adminAuth.ts delegates currentIdentity to src/lib/auth/currentIdentity.ts", () => {
  assert.match(adminAuthModule, /import \{ currentIdentity as currentIdentityCore \} from "@\/lib\/auth\/currentIdentity"/);
  assert.match(adminAuthModule, /currentIdentityCore\(req\)/);
});

test("Protected API routes pass request to currentIdentity(request) and return standardized 401 JSON", () => {
  for (const [name, code] of [
    ["lead-summary", leadSummaryApi],
    ["unread-count", unreadCountApi],
    ["stream", streamApi],
    ["crm-calendar", crmCalendarApi],
  ]) {
    assert.match(code, /currentIdentity\(request\)/, `${name} must pass request to currentIdentity`);
    assert.match(code, /status:\s*401/, `${name} must return status 401 on missing identity`);
  }
});

test("Client-side apiClient implements 401 session refresh and single-retry logic", () => {
  assert.match(apiClientModule, /export async function refreshSession/);
  assert.match(apiClientModule, /export async function apiFetch/);
  assert.match(apiClientModule, /response\.status === 401/);
  assert.match(apiClientModule, /refreshSession\(\)/);
  assert.match(apiClientModule, /AbortSignal/);
});

test("LeadManagementDashboard uses apiFetch with AbortController and session refresh", () => {
  assert.match(leadDashboardComp, /apiFetch/);
  assert.match(leadDashboardComp, /AbortController/);
  assert.match(leadDashboardComp, /controller\.signal/);
  assert.match(leadDashboardComp, /controller\.abort\(\)/);
});

test("NotificationBell handles SSE stream errors cleanly without endless 401 retries", () => {
  assert.match(notificationBellComp, /apiFetch/);
  assert.match(notificationBellComp, /refreshSession/);
  assert.match(notificationBellComp, /eventSource\.onerror/);
  assert.match(notificationBellComp, /maxReconnectAttempts\s*=\s*3/);
});
