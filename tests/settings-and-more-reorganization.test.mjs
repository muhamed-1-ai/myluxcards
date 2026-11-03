import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Settings and Accounting More Reorganization Suite", async (t) => {
  const moreViewPath = path.resolve("src/components/accounting/MoreView.tsx");
  const configViewsPath = path.resolve("src/components/accounting/AccountingConfigViews.tsx");
  const globalSettingsPath = path.resolve("src/components/settings/GlobalAccountSettingsView.tsx");
  const securitySettingsPath = path.resolve("src/components/security/SecuritySettingsView.tsx");
  const dashboardPath = path.resolve("src/app/dashboard/DashboardDemo.tsx");
  const accountingAppPath = path.resolve("src/components/accounting/AccountingApp.tsx");
  const accountingCssPath = path.resolve("src/components/accounting/accounting.css");

  await t.test("1. MoreView implements Grouped Tool Directory with Financial, Configuration, and Data groups", () => {
    const code = fs.readFileSync(moreViewPath, "utf8");

    // Check groups
    assert.match(code, /Financial Tools/, "Must have Financial Tools section");
    assert.match(code, /Accounting Configuration/, "Must have Accounting Configuration section");
    assert.match(code, /Accounting Data/, "Must have Accounting Data section");

    // Check financial tools
    assert.match(code, /"BUDGETS"/);
    assert.match(code, /"LOANS"/);
    assert.match(code, /"RECURRING"/);
    assert.match(code, /"REMINDERS"/);

    // Check configuration tools moved from Settings
    assert.match(code, /"ACCOUNTS"/);
    assert.match(code, /"WORKSPACE"/);
    assert.match(code, /"PERMISSIONS"/);
    assert.match(code, /"INTEGRATIONS"/);
    assert.match(code, /"NOTIFICATIONS"/);

    // Check data management tool
    assert.match(code, /"DATA_MANAGEMENT"/);

    // Check Back button in focused view
    assert.match(code, /Back to More Tools/);
  });

  await t.test("2. AccountingConfigViews provides modular, dedicated configuration components", () => {
    const code = fs.readFileSync(configViewsPath, "utf8");

    assert.match(code, /export function PaymentAccountsConfigView/);
    assert.match(code, /export function WorkspaceConfigView/);
    assert.match(code, /export function TeamPermissionsConfigView/);
    assert.match(code, /export function AccountingNotificationsConfigView/);
    assert.match(code, /export function LeadsIntegrationConfigView/);
  });

  await t.test("3. GlobalAccountSettingsView implements complete personal account settings", () => {
    const code = fs.readFileSync(globalSettingsPath, "utf8");

    // Read identity from authenticated account source /api/auth/me
    assert.match(code, /\/api\/auth\/me/);
    assert.match(code, /Registered Login Email/);

    // Change Password & Credentials
    assert.match(code, /\/api\/auth\/change-password/);
    assert.match(code, /\/api\/auth\/setup-password\/send-link/);

    // Active session revocation notice
    assert.match(code, /Active Session Protection/);

    // Personal preferences (Theme toggle)
    assert.match(code, /Interface Theme/);

    // Danger Zone / Account Deletion
    assert.match(code, /Account Deletion (&amp;|&) Data Protection/);
  });

  await t.test("4. SecuritySettingsView fixes 'Unknown' Registered Account Email issue", () => {
    const code = fs.readFileSync(securitySettingsPath, "utf8");
    assert.match(code, /accountEmail \|\| user\?\.email/);
    assert.doesNotMatch(code, /user\?\.email \|\| "Unknown"/);
  });

  await t.test("5. DashboardDemo removes Settings from Accounting submenu and adds Global Settings shortcuts", () => {
    const code = fs.readFileSync(dashboardPath, "utf8");

    // Check Accounting section slice
    const accSectionStart = code.indexOf('isAccountingEntitled(currentUser?.featurePermissions, currentUser?.role)');
    const accSectionEnd = code.indexOf('{/* Section: Card & Profile */}', accSectionStart);
    const accSlice = code.slice(accSectionStart, accSectionEnd);

    assert.ok(!accSlice.includes('accounting-settings'), "Accounting submenu must NOT contain Settings");
    assert.ok(accSlice.includes('accounting-more'), "Accounting submenu must contain More");

    // Check global settings shortcut in main sidebar outside module groups
    assert.match(code, /side-nav-settings-group/);

    // Check Settings in top-right avatar popover
    assert.match(code, /<div className="account-popover">[\s\S]*?selectTab\("settings" as Tab\)/);

    // Check tab rendering
    assert.match(code, /tab === "settings" \|\| tab === "security"/);
    assert.match(code, /<GlobalAccountSettingsView/);
  });

  await t.test("6. Legacy accounting-settings links are preserved and properly redirected", () => {
    const code = fs.readFileSync(dashboardPath, "utf8");

    // Security section -> settings
    assert.match(code, /section === "SECURITY"/);
    // Accounting sections -> accounting-more
    assert.match(code, /qTab = "accounting-more"/);
  });

  await t.test("7. AccountingApp routes accounting-settings to MoreView configuration group", () => {
    const code = fs.readFileSync(accountingAppPath, "utf8");
    assert.match(code, /case "accounting-settings":[\s\r\n]+return <MoreView initialGroup="CONFIGURATION" \/>;/);
  });

  await t.test("8. Responsive CSS supports mobile layouts at 320px, 375px, and 390px", () => {
    const code = fs.readFileSync(accountingCssPath, "utf8");
    assert.match(code, /\.acc-tool-grid/);
    assert.match(code, /@media \(max-width: 640px\)/);
    assert.match(code, /grid-template-columns: 1fr;/);
  });
});
