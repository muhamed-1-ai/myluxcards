import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const CSS_PATH = path.resolve("src/components/dashboard/config/products-modal.css");
const COMPONENT_PATH = path.resolve("src/components/dashboard/config/ProductsConfig.tsx");

test("Products modal CSS exists and has required responsive architecture", (t) => {
  assert.ok(fs.existsSync(CSS_PATH), "products-modal.css should exist");
  const css = fs.readFileSync(CSS_PATH, "utf8");

  // Viewport and bounded sizing
  assert.match(css, /max-height:\s*min\(760px,\s*calc\(100vh - 32px\)\)/, "Should have 100vh fallback for max-height");
  assert.match(css, /max-height:\s*min\(760px,\s*calc\(100dvh - 32px\)\)/, "Should have 100dvh dynamic viewport sizing");
  assert.match(css, /display:\s*flex;\s*flex-direction:\s*column;\s*overflow:\s*hidden;/, "Modal card must be flex column with overflow hidden");

  // 3-section layout
  assert.match(css, /\.prod-modal-header/, "Must define .prod-modal-header");
  assert.match(css, /\.prod-modal-body/, "Must define .prod-modal-body");
  assert.match(css, /\.prod-modal-footer/, "Must define .prod-modal-footer");

  // Body scrolling constraints
  assert.match(css, /\.prod-modal-body\s*\{[^}]*flex:\s*1\s*1\s*auto;/s, "Body must have flex: 1 1 auto");
  assert.match(css, /\.prod-modal-body\s*\{[^}]*min-height:\s*0;/s, "Body must have min-height: 0 to allow flex shrinking");
  assert.match(css, /\.prod-modal-body\s*\{[^}]*overflow-y:\s*auto;/s, "Body must have overflow-y: auto for internal scrolling");

  // Mobile breakpoint & safe areas
  assert.match(css, /@media\s*\(max-width:\s*640px\)/, "Must have mobile breakpoint <= 640px");
  assert.match(css, /env\(safe-area-inset-bottom/i, "Must account for safe-area-inset-bottom");
  assert.match(css, /font-size:\s*16px;/, "Must set 16px font-size on mobile inputs to prevent iOS auto-zoom");

  // Ultra-narrow screen support
  assert.match(css, /@media\s*\(max-width:\s*360px\)/, "Must support ultra-narrow mobile screens <= 360px");
});

test("ProductsConfig component correctly connects 3-section layout, scroll locking, and form submission", (t) => {
  assert.ok(fs.existsSync(COMPONENT_PATH), "ProductsConfig.tsx should exist");
  const comp = fs.readFileSync(COMPONENT_PATH, "utf8");

  // CSS import
  assert.match(comp, /import "\.\/products-modal\.css";/, "ProductsConfig must import products-modal.css");

  // 3-tier structure in JSX
  assert.match(comp, /className="prod-modal-overlay"/, "Must render prod-modal-overlay");
  assert.match(comp, /className="prod-modal-card"/, "Must render prod-modal-card");
  assert.match(comp, /className="prod-modal-header"/, "Must render fixed header");
  assert.match(comp, /className="prod-modal-body"/, "Must render scrollable body");
  assert.match(comp, /className="prod-modal-footer"/, "Must render fixed footer");

  // Background scroll lock & visualViewport handling
  assert.match(comp, /document\.body\.style\.overflow\s*=\s*"hidden"/, "Must lock background scroll when modal opens");
  assert.match(comp, /window\.visualViewport/, "Must handle window.visualViewport adjustments");

  // Form connectivity & all 6 required fields
  assert.match(comp, /id="product-modal-form"/, "Must have product-modal-form");
  assert.match(comp, /formData\.name/, "Must include Product Name field");
  assert.match(comp, /formData\.code/, "Must include Product Code field");
  assert.match(comp, /formData\.category/, "Must include Category field");
  assert.match(comp, /formData\.price/, "Must include Unit Price field");
  assert.match(comp, /formData\.status/, "Must include Status field");
  assert.match(comp, /formData\.description/, "Must include Description field");

  // Footer action buttons
  assert.match(comp, /className="prod-btn-cancel"/, "Must have Cancel button");
  assert.match(comp, /className="prod-btn-save"/, "Must have Save Product button");
  assert.match(comp, /type="submit"/, "Save button must trigger form submit");
});
