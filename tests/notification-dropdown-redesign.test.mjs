import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const COMPONENT_PATH = path.resolve("src/components/NotificationBell.tsx");
const GLOBALS_CSS_PATH = path.resolve("src/app/globals.css");
const SHEET_CSS_PATH = path.resolve("src/components/notifications/notification-sheet.css");

test("1. Notification Dropdown Container Specifications", (t) => {
  const css = fs.readFileSync(GLOBALS_CSS_PATH, "utf8");
  const comp = fs.readFileSync(COMPONENT_PATH, "utf8");

  // Approximately 420px width on desktop
  assert.match(css, /width:\s*420px\s*!important;/, "Desktop panel width must be ~420px");

  // Clearance from screen edges: constrained to viewport
  assert.match(css, /max-width:\s*calc\(100vw\s*-\s*32px\)\s*!important;/, "Panel must keep clearance from screen edges");

  // Constrained max-height to avoid bottom clipping
  assert.match(css, /max-height:\s*min\(540px,\s*calc\(100vh\s*-\s*85px\)\)\s*!important;/, "Panel height must be constrained to viewport");

  // Approximately 16px corner radius
  assert.match(css, /border-radius:\s*16px\s*!important;/, "Panel must have ~16px corner radius");

  // Neutral charcoal surface in dark mode
  assert.match(css, /background:\s*var\(--surface-elevated,\s*#23252C\)\s*!important;/, "Dark mode surface must use charcoal surface");

  // Subtle border & restrained shadow
  assert.match(css, /box-shadow:\s*0\s+16px\s+36px\s+-4px\s+rgba\(0,\s*0,\s*0,\s*0\.45\)/, "Must use restrained shadow in dark mode");

  // Light mode support
  assert.match(css, /\[data-theme="light"\]\s+\.notif-dropdown-panel[^{]*\{[^}]*background:\s*#FFFFFF/s, "Must support light mode with white background");
  assert.match(css, /\[data-theme="light"\]\s+\.notif-dropdown-panel[^{]*\{[^}]*border-color:\s*#E2E8F0/s, "Must support light mode border");

  // Dynamic viewport clamping in component
  assert.match(comp, /updateDropdownPosition/, "Must implement dynamic viewport edge clamping");
  assert.match(comp, /style=\{dropdownStyle\}/, "Panel must apply dynamic viewport positioning styles");
});

test("2. Clear Header with Compact Unread Badge and Disabled Bulk Action", (t) => {
  const comp = fs.readFileSync(COMPONENT_PATH, "utf8");
  const css = fs.readFileSync(GLOBALS_CSS_PATH, "utf8");

  // Notifications title with compact unread count badge
  assert.match(comp, /<h3[^>]*>\s*Notifications\s*<\/h3>/, "Must display Notifications heading");
  assert.match(comp, /unreadCount\s*>\s*0\s*\?\s*`\$\{unreadCount\}\s+unread`\s*:\s*"0 unread"/, "Must display compact unread badge");

  // Mark all as read button with icon
  assert.match(comp, /CheckCheck/, "Must include CheckCheck icon for bulk mark-read action");
  assert.match(comp, /disabled=\{unreadCount\s*===\s*0\s*\|\|\s*isMarkingAll\}/, "Bulk action must be disabled when 0 unread or processing");
  assert.match(comp, /aria-disabled=\{unreadCount\s*===\s*0\s*\|\|\s*isMarkingAll\}/, "Bulk action must expose aria-disabled");

  // Stationary header
  assert.match(css, /\.notif-dropdown-header\s*\{[^}]*flex-shrink:\s*0\s*!important;/s, "Header must be stationary");
  assert.match(css, /\.notif-dropdown-header\s*\{[^}]*border-bottom:\s*1px\s+solid/s, "Header must have subtle divider");
});

test("3. Notification Row Redesign Hierarchy", (t) => {
  const comp = fs.readFileSync(COMPONENT_PATH, "utf8");

  // Left: restrained 32-36px icon container (34px)
  assert.match(comp, /w-\[34px\]\s+h-\[34px\]\s+rounded-xl/, "Icon container must be restrained ~34px with rounded corners");

  // Centre: Title (14px, wraps up to 2 lines)
  assert.match(comp, /text-\[14px\]\s+leading-snug\s+break-words\s+line-clamp-2/, "Title must be 14px and wrap up to 2 lines");

  // Centre: Description (13px, line-clamp-2)
  assert.match(comp, /text-\[13px\]\s+text-\[var\(--text-secondary\)[^\]]*\]\s+line-clamp-2/, "Description must be 13px with secondary text color");

  // Centre: Timestamp placed below description with Clock icon
  assert.match(comp, /<Clock\s+className="w-3\s+h-3\s+shrink-0"\s*\/>\s*<span>\{formatTimeAgo\(n\.created_at\)\}<\/span>/, "Timestamp must be placed below description with Clock icon");

  // Right: Small unread indicator (blue dot) & quick read action
  assert.match(comp, /rounded-full\s+bg-\[#0066FF\]\s+dark:bg-\[#3898FF\]/, "Unread indicator must be a clean blue dot");
  assert.match(comp, /title="Mark as read"/, "Must include individual mark as read action");

  // Faint blue tint for unread rows, transparent for read rows
  assert.match(comp, /bg-blue-500\/\[0\.035\]\s+dark:bg-blue-500\/\[0\.05\]/, "Unread rows must use faint blue tint");
  assert.match(comp, /bg-transparent\s+hover:bg-\[var\(--surface-hover/, "Read rows must use normal surface");

  // Safe row padding (~14-16px) and flexible height
  assert.match(comp, /px-4\s+py-3\.5/, "Row padding must be ~14-16px");
});

test("4. Scrolling, Date Grouping, and Normal Footer Styling", (t) => {
  const comp = fs.readFileSync(COMPONENT_PATH, "utf8");
  const css = fs.readFileSync(GLOBALS_CSS_PATH, "utf8");

  // Date groups (Today, Yesterday, Earlier)
  assert.match(comp, /groupedNotifications\.map/, "Must render grouped notifications");
  assert.match(comp, /sticky\s+top-0\s+z-10/, "Date group header must be sticky");

  // Only notification list scrolls
  assert.match(comp, /className="overflow-y-auto\s+flex-1\s+min-h-0/, "List container must scroll with flex-1 min-h-0");

  // Clean footer with normal readable styling (not shouty all-caps)
  assert.match(comp, /<span>View all notifications<\/span>/, "Footer link text must use normal sentence/title case");
  assert.match(css, /\.notif-dropdown-footer\s+a\s*\{[^}]*text-transform:\s*none\s*!important;/s, "Footer link must not force uppercase shouting");
  assert.match(css, /\.notif-dropdown-footer\s+a\s*\{[^}]*font-weight:\s*500\s*!important;/s, "Footer link must use readable 500 font-weight");
});

test("5. Preserved Behavior, Accessibility, and States", (t) => {
  const comp = fs.readFileSync(COMPONENT_PATH, "utf8");

  // Escape key closes and returns focus to bell button
  assert.match(comp, /ref=\{bellButtonRef\}/, "Bell button must retain ref for focus return");
  assert.match(comp, /bellButtonRef\.current\?\.focus\(\)/, "Focus must return to bell button on Escape");

  // Click outside to dismiss
  assert.match(comp, /handleClickOutside/, "Must handle click outside to dismiss");

  // Avoid nested interactive navigation conflicts
  assert.match(comp, /e\.stopPropagation\(\);\s*e\.preventDefault\(\);\s*void\s+handleMarkRead\(n\.id,\s*e\);/s, "Must stop propagation and prevent default on row action");
  assert.match(comp, /e\.target\s*===\s*e\.currentTarget\s*&&\s*\(e\.key\s*===\s*"Enter"\s*\|\|\s*e\.key\s*===\s*" "\)/, "Row keyboard handler must guard against nested button triggers");

  // Preserve lead navigation rules
  assert.match(comp, /isLeadEntity/, "Must preserve isLeadEntity safety check");

  // Loading, empty, and distinct error states
  assert.match(comp, /Failed to load notifications/, "Must show distinct error state");
  assert.match(comp, /No Notifications Yet/, "Must show friendly empty state");
  assert.match(comp, /animate-pulse/, "Must show loading skeleton state");
});
