import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const CSS_PATH = path.resolve("src/components/notifications/notification-sheet.css");
const COMPONENT_PATH = path.resolve("src/components/NotificationBell.tsx");
const DASHBOARD_CSS_PATH = path.resolve("src/app/dashboard/dashboard.css");

test("Notification sheet CSS defines proper mobile bottom sheet architecture", (t) => {
  assert.ok(fs.existsSync(CSS_PATH), "notification-sheet.css should exist");
  const css = fs.readFileSync(CSS_PATH, "utf8");

  // Backdrop and bottom sheet constraints
  assert.match(css, /\.notif-sheet-backdrop/, "Must define .notif-sheet-backdrop");
  assert.match(css, /\.notif-sheet-card/, "Must define .notif-sheet-card");
  assert.match(css, /max-height:\s*85vh;/, "Must limit height to 85vh fallback");
  assert.match(css, /max-height:\s*85dvh;/, "Must limit height to 85dvh dynamic viewport");
  assert.match(css, /border-radius:\s*20px\s*20px\s*0\s*0;/, "Must have rounded top corners on sheet");

  // 3-section layout
  assert.match(css, /\.notif-sheet-header/, "Must define .notif-sheet-header");
  assert.match(css, /\.notif-sheet-body/, "Must define .notif-sheet-body");
  assert.match(css, /\.notif-sheet-footer/, "Must define .notif-sheet-footer");

  // Body scrolling constraints
  assert.match(css, /\.notif-sheet-body\s*\{[^}]*min-height:\s*0;/s, "Body must have min-height: 0");
  assert.match(css, /\.notif-sheet-body\s*\{[^}]*overflow-y:\s*auto;/s, "Body must have overflow-y: auto for smooth touch scrolling");

  // Separate timestamp row below body
  assert.match(css, /\.notif-sheet-item-time/, "Must define .notif-sheet-item-time for timestamp below message");

  // Safe area insets & 44px touch targets
  assert.match(css, /env\(safe-area-inset-bottom/i, "Must account for safe area insets at bottom");
  assert.match(css, /min-height:\s*44px;/, "Must ensure at least 44px touch target on footer action");

  // Dark and light themes
  assert.match(css, /\[data-theme="light"\]/, "Must support data-theme='light'");
  assert.match(css, /body\.light-mode/, "Must support body.light-mode");

  // Narrow screen breakpoint
  assert.match(css, /@media\s*\(max-width:\s*360px\)/, "Must include media query for narrow screens < 360px");
});

test("Dashboard CSS eliminates obsolete compressed mobile panel override", (t) => {
  const dashCss = fs.readFileSync(DASHBOARD_CSS_PATH, "utf8");
  // Ensure the old 64px fixed box was removed from .notif-dropdown-panel
  assert.doesNotMatch(dashCss, /\.notif-dropdown-panel\s*\{[^}]*top:\s*calc\(64px/s);
});

test("NotificationBell component implements mobile bottom sheet with single controller and portal", (t) => {
  assert.ok(fs.existsSync(COMPONENT_PATH), "NotificationBell.tsx should exist");
  const comp = fs.readFileSync(COMPONENT_PATH, "utf8");

  // CSS import
  assert.match(comp, /import "\.\/notifications\/notification-sheet\.css";/, "Must import notification-sheet.css");

  // Single controller state
  assert.match(comp, /const \[unreadCount, setUnreadCount\] = useState/, "Single unreadCount state");
  assert.match(comp, /const \[notifications, setNotifications\] = useState/, "Single notifications state");
  assert.match(comp, /const \[isMobile, setIsMobile\] = useState/, "Tracks responsive mobile state");

  // React portal to document.body
  assert.match(comp, /createPortal\(/, "Must render mobile sheet through createPortal");
  assert.match(comp, /document\.body\s*\)/, "Portal mounts to document.body");

  // Background scroll locking
  assert.match(comp, /document\.body\.style\.overflow\s*=\s*"hidden"/, "Must lock document body scroll when mobile sheet opens");

  // 3-section structure inside mobile portal
  assert.match(comp, /className="notif-sheet-header"/, "Must render notif-sheet-header");
  assert.match(comp, /className="notif-sheet-body"/, "Must render notif-sheet-body");
  assert.match(comp, /className="notif-sheet-footer"/, "Must render notif-sheet-footer");

  // Obvious close button and mark all read
  assert.match(comp, /className="notif-sheet-close-btn"/, "Must have obvious close button");
  assert.match(comp, /className="notif-sheet-mark-all-btn"/, "Must provide Mark all read button");

  // Separate timestamp below message in notification row
  assert.match(comp, /className="notif-sheet-item-time"/, "Row must render separate timestamp below message");

  // Error state with Retry
  assert.match(comp, /className="notif-sheet-retry-btn"/, "Must provide Retry button for error states");

  // Desktop dropdown preserved when !isMobile
  assert.match(comp, /className="notif-dropdown-panel"/, "Must preserve desktop dropdown panel for desktop viewports");
});
