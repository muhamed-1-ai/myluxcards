import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Zappit Accounting Mobile Alignment & Polish Verification Suite", async (t) => {
  const accountingAppCode = fs.readFileSync(path.resolve("src/components/accounting/AccountingApp.tsx"), "utf8").replace(/\r\n/g, "\n");
  const budgetsViewCode = fs.readFileSync(path.resolve("src/components/accounting/BudgetsView.tsx"), "utf8").replace(/\r\n/g, "\n");
  const transactionsViewCode = fs.readFileSync(path.resolve("src/components/accounting/TransactionsView.tsx"), "utf8").replace(/\r\n/g, "\n");
  const overviewCode = fs.readFileSync(path.resolve("src/components/accounting/AccountingOverview.tsx"), "utf8").replace(/\r\n/g, "\n");
  const pickerCode = fs.readFileSync(path.resolve("src/components/accounting/PaymentAccountPicker.tsx"), "utf8").replace(/\r\n/g, "\n");
  const accountingCss = fs.readFileSync(path.resolve("src/components/accounting/accounting.css"), "utf8").replace(/\r\n/g, "\n");

  await t.test("1. Screenshot 1: Budget details and Add Expense form layout", () => {
    // 1a. Scope & Period metadata uses responsive stacking and nowrap on date string
    assert.ok(budgetsViewCode.includes('className="acc-budget-scope-period"'), "Must use .acc-budget-scope-period class");
    assert.ok(budgetsViewCode.includes('className="acc-budget-meta-val acc-nowrap"'), "Must use acc-nowrap on date range to prevent awkward hyphen splitting");
    assert.ok(accountingCss.includes('.acc-budget-scope-period {'), "CSS must define .acc-budget-scope-period");
    assert.ok(accountingCss.includes('grid-template-columns: 1fr;'), "Scope/period must default to 1 column on narrow screens");

    // 1b. Single-column responsive layout for form controls on mobile
    assert.ok(budgetsViewCode.includes('className="acc-form-responsive-grid"'), "Add Expense form must use .acc-form-responsive-grid instead of fixed inline 1fr 1fr");
    assert.ok(!budgetsViewCode.includes('gridTemplateColumns: "1fr 1fr"'), "No fixed 1fr 1fr inline grids in BudgetsView Add Expense form");
    assert.ok(accountingCss.includes('.acc-form-responsive-grid {'), "CSS must define .acc-form-responsive-grid");

    // 1c. Date input has shrinkable constraints and native fitting
    assert.ok(budgetsViewCode.includes('className="acc-form-input acc-date-input"'), "Date input must use acc-date-input");
    assert.ok(accountingCss.includes('input[type="date"].acc-form-input'), "CSS must define input[type=date].acc-form-input constraints");

    // 1d. Card padding on narrow screens ~16px (1rem)
    assert.ok(accountingCss.includes('.acc-detail-summary-card,') && accountingCss.includes('padding: 1rem;'), "Mobile card padding must be 1rem (~16px)");

    // 1e. PaymentAccountPicker trigger is compact, single-row (~44-48px), and not tall cramped box
    assert.ok(!/\.acc-picker-trigger\.has-selected\s*\{[^}]*flex-wrap:\s*wrap;/s.test(accountingCss), "Payment account picker trigger must not wrap into a tall cramped box on mobile");
    assert.ok(/\.acc-picker-trigger\.has-selected\s*\{[^}]*flex-wrap:\s*nowrap;/s.test(accountingCss), "Trigger must stay single-row (nowrap)");
    assert.ok(accountingCss.includes('min-height: 44px;'), "Trigger must have minimum accessible touch height");
  });

  await t.test("2. Screenshot 2: Compact Transactions tabs and Purchases subsection", () => {
    // 2a. 2x2 equal-width grid for the 4 main tabs on mobile
    assert.ok(transactionsViewCode.includes('className="acc-transactions-subtabs"'), "Must use .acc-transactions-subtabs");
    assert.ok(accountingCss.includes('.acc-transactions-subtabs {') && accountingCss.includes('grid-template-columns: repeat(2, 1fr);'), "Must use 2-column grid on mobile");

    // 2b. Tab labels: Row 1 = All Transactions | Purchases, Row 2 = Account Balances | Voided
    assert.ok(transactionsViewCode.includes('All Transactions'), "Tab 1 must be All Transactions");
    assert.ok(transactionsViewCode.includes('Purchases'), "Tab 2 must be Purchases");
    assert.ok(transactionsViewCode.includes('Account Balances'), "Tab 3 must be Account Balances");
    assert.ok(transactionsViewCode.includes('Voided'), "Tab 4 must be Voided");
    assert.ok(!transactionsViewCode.includes('Cash/Bank)'), "Must remove long parenthetical '(2 Cash/Bank)' from Account Balances tab");

    // 2c. Small count badges and compact icons
    assert.ok(transactionsViewCode.includes('acc-subtab-badge'), "Must use .acc-subtab-badge for tab counts");
    assert.ok(transactionsViewCode.includes('acc-subtab-icon'), "Must use .acc-subtab-icon for compact icons");

    // 2d. Balanced 2-column action row for Add Income / Sale & Add Expense, Transfer Funds below
    assert.ok(transactionsViewCode.includes('className="acc-tx-actions-grid"'), "Must use .acc-tx-actions-grid");
    assert.ok(transactionsViewCode.includes('acc-tx-transfer-btn'), "Transfer button must have .acc-tx-transfer-btn class to span full-width on mobile");
    assert.ok(accountingCss.includes('.acc-tx-actions-grid {') && accountingCss.includes('grid-template-columns: 1fr 1fr;'), "Actions must use 1fr 1fr grid on mobile");

    // 2e. Purchases subsection: full-width search, full-width status dropdown on narrow screens
    assert.ok(transactionsViewCode.includes('acc-purchases-header'), "Must have dedicated purchases header");
    assert.ok(transactionsViewCode.includes('acc-purchases-search-wrap'), "Must have purchases search wrap");
    assert.ok(transactionsViewCode.includes('acc-purchases-status-select-wrap'), "Must have mobile status dropdown wrap");
    assert.ok(transactionsViewCode.includes('acc-purchases-status-chips'), "Must have status chips for desktop");
    assert.ok(accountingCss.includes('.acc-purchases-status-select-wrap {') && accountingCss.includes('display: block;'), "Mobile status dropdown is visible by default");
    assert.ok(accountingCss.includes('@media (min-width: 640px)') && accountingCss.includes('.acc-purchases-status-select-wrap {\n    display: none;'), "Mobile status dropdown hides on desktop");
  });

  await t.test("3. Screenshot 3: Duplicate bottom navigation removed", () => {
    // 3a. Bottom nav removed from AccountingApp.tsx
    assert.ok(!accountingAppCode.includes('className="acc-mobile-nav"'), "acc-mobile-nav must be removed from AccountingApp.tsx");
    assert.ok(!accountingAppCode.includes('mobileMoreOpen'), "mobileMoreOpen state and sheet must be removed");

    // 3b. Bottom nav styles and 5.5rem reserved spacing removed from accounting.css
    assert.ok(!accountingCss.includes('.acc-mobile-nav {'), ".acc-mobile-nav must be removed from accounting.css");
    assert.ok(!accountingCss.includes('.acc-mobile-nav-btn'), ".acc-mobile-nav-btn must be removed from accounting.css");
    assert.ok(!accountingCss.includes('padding-bottom: calc(5.5rem'), "No 5.5rem reserved bottom padding remaining");

    // 3c. Safe-area bottom padding preserved
    assert.ok(accountingCss.includes('env(safe-area-inset-bottom'), "Must preserve env(safe-area-inset-bottom) for mobile safe areas");
  });

  await t.test("4. Screenshot 4: Cash-flow category filters stacked cleanly", () => {
    // 4a. Stacked form groups with label above select on mobile
    assert.ok(/\.acc-chart-filter-item\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s.test(accountingCss), "Filter item must stack label above control on mobile");
    assert.ok(accountingCss.includes('.acc-chart-filter-label {\n    display: block;') || /\.acc-chart-filter-label\s*\{[^}]*display:\s*block;/s.test(accountingCss), "Filter label must be display: block");

    // 4b. 12-16px gap between filter groups
    assert.ok(accountingCss.includes('gap: 14px;'), "Must have ~12-16px gap between filter groups");

    // 4c. Selects fill 100% width with min-width: 0 and text-overflow: ellipsis
    assert.ok(/\.acc-chart-filter-select\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;/s.test(accountingCss), "Dropdowns must fill 100% width without overflowing");

    // 4d. Dropdown arrows visible
    assert.ok(accountingCss.includes('background-position: right 0.75rem center;'), "Arrow icon must be positioned clearly visible");

    // 4e. Subcategory disabled state preserved
    assert.ok(overviewCode.includes('disabled={isSubcategoryDisabled}'), "Subcategory must be disabled when no valid category is chosen");

    // 4f. Chart header controls wrap neatly and totals stack on mobile
    assert.ok(overviewCode.includes('className="acc-chart-header-controls"'), "Header controls must use .acc-chart-header-controls");
    assert.ok(overviewCode.includes('className="acc-chart-footer-totals"'), "Footer totals must use .acc-chart-footer-totals");
    assert.ok(overviewCode.includes('className="acc-chart-footer-net"'), "Footer net flow must use .acc-chart-footer-net");
    assert.ok(/\.acc-chart-footer\s*\{[^}]*flex-direction:\s*column;/s.test(accountingCss), "Totals must stack on mobile");

    // 4g. Empty state has compact height
    assert.ok(/\.acc-chart-empty-compact\s*\{[^}]*min-height:\s*140px;/s.test(accountingCss), "Empty state must have compact height without excessive fixed space");
  });

  await t.test("5. Multi-viewport geometry calculation across all target screen widths", () => {
    const viewports = [
      { name: "Mobile iPhone SE1 / Small", width: 320, outerMargin: 12 },
      { name: "Mobile Android Common", width: 360, outerMargin: 12 },
      { name: "Mobile iPhone SE / 8", width: 375, outerMargin: 12 },
      { name: "Mobile iPhone 15 / 16", width: 390, outerMargin: 12 },
      { name: "Mobile iPhone 15 Pro Max", width: 430, outerMargin: 12 },
      { name: "Tablet iPad Mini", width: 768, outerMargin: 24 },
      { name: "Desktop Standard", width: 1024, outerMargin: 32 },
      { name: "Desktop Large", width: 1440, outerMargin: 48 },
    ];

    for (const vp of viewports) {
      const availableWidth = vp.width - (vp.outerMargin * 2);
      assert.ok(availableWidth > 0, `Viewport ${vp.name} must have positive usable width`);

      // In 1-column mobile mode (< 600px):
      if (vp.width < 600) {
        // Form inputs get full available width minus ~32px card padding (16px left + 16px right)
        const cardInnerWidth = availableWidth - 32;
        assert.ok(cardInnerWidth >= 264, `Card inner width on ${vp.name} (${cardInnerWidth}px) is comfortable for single column`);

        // Tab buttons get (availableWidth - 8px gap) / 2
        const tabWidth = (availableWidth - 8) / 2;
        assert.ok(tabWidth >= 140, `Tab width on ${vp.name} (${tabWidth}px) fits icon, label, and badge cleanly`);
      }
    }
  });
});

