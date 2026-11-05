import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const leadsCssPath = path.resolve("src/app/dashboard/leads/leads.css");
const dashboardCssPath = path.resolve("src/app/dashboard/dashboard.css");
const dashboardDemoPath = path.resolve("src/app/dashboard/DashboardDemo.tsx");
const leadGrowthChartPath = path.resolve("src/components/dashboard/LeadGrowthChart.tsx");
const addLeadDrawerPath = path.resolve("src/components/leads/AddLeadDrawer.tsx");

test("Theme Consistency - Add Lead Mobile Number Country Selector", () => {
  const leadsCss = fs.readFileSync(leadsCssPath, "utf8");

  // 1. Selector button must not have hardcoded white or light-gray background in base styling
  assert.ok(
    leadsCss.includes(".add-lead-country-selector-btn"),
    "Expected .add-lead-country-selector-btn to exist"
  );
  assert.ok(
    !leadsCss.includes(".add-lead-country-selector-btn {\n  display: flex;\n  align-items: center;\n  height: 100%;\n  padding: 0 8px 0 12px;\n  padding: 0 10px 0 12px;\n  border: none;\n  border-right: 1px solid #E2E8F0;\n  background-color: #F1F5F9;"),
    "Old duplicate white background on country selector button should be removed"
  );

  // 2. Base selector button has transparent background
  assert.match(
    leadsCss,
    /\.add-lead-country-selector-btn\s*\{[^}]*background-color:\s*transparent/s,
    "Expected .add-lead-country-selector-btn to have transparent background to inherit from container"
  );

  // 3. Dark mode rules for country selector button
  assert.match(
    leadsCss,
    /\[data-theme="dark"\]\s+\.add-lead-country-selector-btn[^}]*background:\s*transparent\s*!important/s,
    "Expected dark mode country selector button to have transparent background"
  );

  // 4. Dark mode rules for country dial text
  assert.match(
    leadsCss,
    /\[data-theme="dark"\]\s+\.add-lead-country-dial[^}]*color:\s*#F8FAFC\s*!important/s,
    "Expected dark mode country dial text to be high-contrast #F8FAFC"
  );

  // 5. Dark mode mobile group focus-within
  assert.match(
    leadsCss,
    /\[data-theme="dark"\]\s+\.add-lead-mobile-group:focus-within[^}]*border-color:\s*#0967D2/s,
    "Expected dark mode focus-within on mobile group to have border color #0967D2"
  );

  // 6. Searchable country popover dark mode styling
  assert.match(
    leadsCss,
    /\[data-theme="dark"\]\s+\.add-lead-country-popover[^}]*background-color:\s*#1B1C21/s,
    "Expected dark mode country popover to use dark surface #1B1C21"
  );
  assert.match(
    leadsCss,
    /\[data-theme="dark"\]\s+\.add-lead-country-search-input[^}]*background-color:\s*#111216/s,
    "Expected dark mode search input to use dark input background #111216"
  );
});

test("Theme Consistency - Profile Dropdown Menu in Light and Dark Mode", () => {
  const dashCss = fs.readFileSync(dashboardCssPath, "utf8");
  const dashDemo = fs.readFileSync(dashboardDemoPath, "utf8");

  // 1. Account popover base styles use neutral menu items
  assert.match(
    dashCss,
    /\.account-popover\s+button,\s*\.account-popover\s+\.account-popover-item\s*\{[^}]*background:\s*transparent/s,
    "Expected base menu items to have transparent background instead of solid blue"
  );

  // 2. Light mode account popover overrides
  assert.match(
    dashCss,
    /\[data-theme="light"\]\s+\.account-popover\s+button,\s*\[data-theme="light"\]\s+\.account-popover\s+\.account-popover-item[^}]*background:\s*transparent\s*!important;\s*color:\s*#334155\s*!important/s,
    "Expected light mode account popover buttons to be neutral text #334155 on transparent background"
  );

  // 3. Light mode hover state
  assert.match(
    dashCss,
    /\[data-theme="light"\]\s+\.account-popover\s+button:hover[^}]*background:\s*#F1F5F9\s*!important/s,
    "Expected light mode button hover to use #F1F5F9"
  );

  // 4. Change nickname button neutral styling in light mode (no hardcoded dark navy)
  assert.match(
    dashCss,
    /\[data-theme="light"\]\s+\.account-popover\s+\.btn-change-nickname[^}]*background:\s*transparent\s*!important/s,
    "Expected light mode btn-change-nickname to have transparent background"
  );

  // 5. Destructive Log out styling in light mode
  assert.match(
    dashCss,
    /\[data-theme="light"\]\s+\.account-popover\s+button\.account-popover-danger[^}]*color:\s*#DC2626\s*!important/s,
    "Expected light mode log out danger button to use #DC2626"
  );

  // 6. Popover JSX structure in DashboardDemo.tsx
  assert.ok(
    dashDemo.includes('role="menu" aria-label="Account menu"'),
    "Expected account-popover to have role='menu' and aria-label"
  );
  assert.ok(
    dashDemo.includes('className="account-popover-item btn-change-nickname"'),
    "Expected Change Nickname to use account-popover-item class"
  );
  assert.ok(
    dashDemo.includes('className="account-popover-item account-popover-danger"'),
    "Expected Log out to use account-popover-danger class"
  );
  assert.ok(
    !dashDemo.includes('style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}'),
    "Expected inline styles on settings button to be removed"
  );
});

test("Theme Consistency - Daily Follow-Up Capacity Badge Button", () => {
  const dashCss = fs.readFileSync(dashboardCssPath, "utf8");

  // 1. Light mode daily capacity badge button has light background and clear blue text
  assert.match(
    dashCss,
    /\[data-theme="light"\]\s+\.crm-capacity-badge-btn[^}]*background:\s*#EFF6FF\s*!important;\s*border:\s*1px\s*solid\s*rgba\(0,\s*102,\s*255,\s*0\.25\)\s*!important;\s*color:\s*#0066FF\s*!important/s,
    "Expected light mode daily capacity button to use #EFF6FF background and #0066FF text"
  );

  // 2. Light mode hover state
  assert.match(
    dashCss,
    /\[data-theme="light"\]\s+\.crm-capacity-badge-btn:hover[^}]*background:\s*#0066FF\s*!important/s,
    "Expected light mode hover state to have #0066FF background"
  );
  assert.match(
    dashCss,
    /\[data-theme="light"\]\s+\.crm-capacity-badge-btn:hover[^}]*color:\s*#FFFFFF\s*!important/s,
    "Expected light mode hover state to have #FFFFFF text"
  );

  // 3. Dark mode maintains dark slate background
  assert.match(
    dashCss,
    /\[data-theme="dark"\]\s+\.crm-capacity-badge-btn[^}]*background:\s*#14263A\s*!important/s,
    "Expected dark mode daily capacity button to retain #14263A background"
  );
});

test("Theme Consistency - Growth Velocity Period Selector", () => {
  const dashCss = fs.readFileSync(dashboardCssPath, "utf8");
  const chartJsx = fs.readFileSync(leadGrowthChartPath, "utf8");

  // 1. JSX uses CSS class instead of hardcoded background: "#161822"
  assert.ok(
    chartJsx.includes('className="growth-period-selector"'),
    "Expected LeadGrowthChart to use growth-period-selector class"
  );
  assert.ok(
    !chartJsx.includes('background: "#161822"'),
    "Expected hardcoded #161822 background to be removed from LeadGrowthChart"
  );

  // 2. Light mode selector container
  assert.match(
    dashCss,
    /\[data-theme="light"\]\s+\.growth-period-selector[^}]*background:\s*#F1F5F9\s*!important;\s*border-color:\s*#E2E8F0\s*!important/s,
    "Expected light mode growth-period-selector to have #F1F5F9 background and #E2E8F0 border"
  );

  // 3. Dark mode selector container
  assert.match(
    dashCss,
    /\[data-theme="dark"\]\s+\.growth-period-selector[^}]*background:\s*#141519\s*!important;\s*border-color:\s*#343740\s*!important/s,
    "Expected dark mode growth-period-selector to have #141519 background and #343740 border"
  );

  // 4. Inactive button text color in light mode
  assert.match(
    dashCss,
    /\[data-theme="light"\]\s+\.growth-period-btn[^}]*color:\s*#64748B\s*!important/s,
    "Expected inactive period button to have #64748B text in light mode"
  );

  // 5. Inactive button text color in dark mode
  assert.match(
    dashCss,
    /\[data-theme="dark"\]\s+\.growth-period-btn[^}]*color:\s*#94A3B8\s*!important/s,
    "Expected inactive period button to have #94A3B8 text in dark mode"
  );
});

test("Theme Consistency - Rapid Switching and Portal Propagation", () => {
  const dashDemo = fs.readFileSync(dashboardDemoPath, "utf8");

  // Verify toggleThemeWithTransition synchronizes both documentElement and body
  assert.ok(
    dashDemo.includes('document.documentElement.setAttribute("data-theme", nextTheme);'),
    "Expected nextTheme to be set on documentElement"
  );
  assert.ok(
    dashDemo.includes('document.body.setAttribute("data-theme", nextTheme);'),
    "Expected nextTheme to be set on body"
  );
  assert.ok(
    dashDemo.includes('document.documentElement.classList.add("light", "light-mode");'),
    "Expected light and light-mode classes on documentElement"
  );
  assert.ok(
    dashDemo.includes('document.body.classList.add("light", "light-mode");'),
    "Expected light and light-mode classes on body"
  );
  assert.ok(
    dashDemo.includes('document.documentElement.classList.add("dark", "dark-mode");'),
    "Expected dark and dark-mode classes on documentElement"
  );
  assert.ok(
    dashDemo.includes('document.body.classList.add("dark", "dark-mode");'),
    "Expected dark and dark-mode classes on body"
  );
});

test("Theme Consistency - Add Lead Drawer preserves international numbers and state", () => {
  const addLead = fs.readFileSync(addLeadDrawerPath, "utf8");

  // Country code state and phone number state are preserved
  assert.ok(
    addLead.includes('const [selectedCountryCode, setSelectedCountryCode] = useState("IN");'),
    "Expected selectedCountryCode state hook"
  );
  assert.ok(
    addLead.includes('const [phoneNumber, setPhoneNumber] = useState("");'),
    "Expected phoneNumber state hook"
  );
  assert.ok(
    addLead.includes("handlePhoneChange"),
    "Expected handlePhoneChange handler"
  );
  assert.ok(
    addLead.includes("handlePhonePaste"),
    "Expected handlePhonePaste handler"
  );
});
