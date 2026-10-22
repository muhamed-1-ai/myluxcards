import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import helpers from PaymentAccountPicker
const {
  formatAccountBalance,
  getAccountIcon,
  getAccountTypeLabel,
} = await import("../src/components/accounting/PaymentAccountPicker.tsx");

// Shared formatMoney mock replicating AccountingContext
function mockFormatMoney(amountMinor, currency = "INR") {
  const major = (amountMinor || 0) / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `₹${major.toFixed(2)}`;
  }
}

test("PaymentAccountPicker: Functional & Visual Architecture Verification", async (t) => {
  await t.test("1. Balance formatting: Negative balance has explicit minus sign and negative flag", () => {
    // Negative balance of -₹1,004.00 (-100400 minor units)
    const result = formatAccountBalance(-100400, mockFormatMoney, "INR");
    assert.equal(result.isNegative, true, "Should be marked negative");
    assert.equal(result.isZero, false, "Should not be marked zero");
    assert.equal(result.isPositive, false, "Should not be marked positive");
    
    // Explicit minus sign
    assert.match(result.formatted, /^[−-]/, "Formatted string must start with an explicit minus sign");
    assert.ok(result.formatted.includes("1,004.00"), "Must format amount with grouping");
    assert.ok(!result.formatted.includes("("), "Must NOT contain parentheses around negative balance");
    assert.ok(!result.formatted.includes(")"), "Must NOT contain parentheses around negative balance");
  });

  await t.test("2. Balance formatting: Positive balance has clean amount and positive flag", () => {
    // Positive balance of ₹12,00,000.00 (120000000 minor units)
    const result = formatAccountBalance(120000000, mockFormatMoney, "INR");
    assert.equal(result.isNegative, false, "Should not be negative");
    assert.equal(result.isZero, false, "Should not be zero");
    assert.equal(result.isPositive, true, "Should be marked positive");
    assert.ok(result.formatted.includes("12,00,000.00"), "Must match Indian grouping for ₹12,00,000.00");
    assert.ok(!result.formatted.includes("-"), "Positive amount must not contain minus");
    assert.ok(!result.formatted.includes("−"), "Positive amount must not contain minus");
    assert.ok(!result.formatted.includes("("), "Must NOT contain parentheses");
  });

  await t.test("3. Balance formatting: Zero balance has readable secondary treatment flag", () => {
    const result = formatAccountBalance(0, mockFormatMoney, "INR");
    assert.equal(result.isNegative, false, "Zero is not negative");
    assert.equal(result.isZero, true, "Should be marked zero");
    assert.equal(result.isPositive, false, "Zero is not positive");
    assert.ok(result.formatted.includes("0.00"), "Zero balance must show decimals");
  });

  await t.test("4. Balance formatting: Sign is derived from numeric/decimal value, never stripped", () => {
    // Test small negative decimal like -₹0.50 (-50 minor units)
    const negCents = formatAccountBalance(-50, mockFormatMoney, "INR");
    assert.equal(negCents.isNegative, true, "Must flag negative for -50 minor");
    assert.match(negCents.formatted, /[−-]/, "Must preserve minus sign for cents");

    // Test large negative number like -₹50,00,000.00
    const negLarge = formatAccountBalance(-500000000, mockFormatMoney, "INR");
    assert.equal(negLarge.isNegative, true);
    assert.ok(negLarge.formatted.includes("50,00,000.00"));
  });

  await t.test("5. Account Subtype Labels: Clear human-readable types", () => {
    assert.equal(getAccountTypeLabel({ subtype: "CASH", name: "Cash in Hand", type: "ASSET" }), "Cash in Hand");
    assert.equal(getAccountTypeLabel({ subtype: "BANK", name: "Main Bank Account", type: "ASSET" }), "Bank Account");
    assert.equal(getAccountTypeLabel({ subtype: "PAYMENT_PROCESSOR", name: "HDFC UPI QR", type: "ASSET" }), "UPI / Digital Wallet");
    assert.equal(getAccountTypeLabel({ subtype: "OTHER", name: "Petty Cash", type: "ASSET" }), "Cash in Hand");
  });

  await t.test("6. CSS Verification: Theme matching and dialog overlay integration", () => {
    const cssPath = path.resolve(__dirname, "../src/components/accounting/accounting.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // 1. Portal popover z-index must exceed modal backdrop (z-index: 9999)
    assert.ok(
      cssContent.includes("z-index: 10050"),
      "Popover z-index must be 10050 (above modal backdrop z-index 9999)"
    );

    // 2. High contrast negative badge styling
    assert.ok(
      cssContent.includes(".acc-picker-badge-negative"),
      "Must define .acc-picker-badge-negative class"
    );
    assert.ok(
      cssContent.includes("var(--acc-danger)"),
      "Must use theme danger token"
    );
    assert.ok(
      cssContent.includes("var(--acc-danger-soft)"),
      "Must use theme danger soft token"
    );

    // 3. Negative text color class
    assert.ok(
      cssContent.includes(".acc-picker-balance-val.negative"),
      "Must define balance value negative color class"
    );

    // 4. Mobile responsive layout
    assert.ok(
      cssContent.includes("@media (max-width: 480px)"),
      "Must include narrow mobile media query"
    );
    assert.ok(
      cssContent.includes("flex-wrap: wrap"),
      "Must wrap on mobile screens to prevent balance overlap"
    );

    // 5. Light/Dark theme token compatibility
    assert.ok(
      cssContent.includes('[data-theme="dark"] .acc-picker-badge-negative'),
      "Must have explicit dark mode rule for negative badge"
    );
  });

  await t.test("7. Integration Verification: Replaced across all accounting views", () => {
    const peopleViewPath = path.resolve(__dirname, "../src/components/accounting/PeopleView.tsx");
    const peopleContent = fs.readFileSync(peopleViewPath, "utf-8");
    assert.ok(
      peopleContent.includes("<PaymentAccountPicker"),
      "PeopleView must use PaymentAccountPicker"
    );
    assert.ok(
      peopleContent.includes('id="pay-account"'),
      "PeopleView settlement modal must bind pay-account to PaymentAccountPicker"
    );

    const fastModalPath = path.resolve(__dirname, "../src/components/accounting/FastTransactionModal.tsx");
    const fastContent = fs.readFileSync(fastModalPath, "utf-8");
    assert.ok(
      fastContent.includes("<PaymentAccountPicker"),
      "FastTransactionModal must use PaymentAccountPicker"
    );

    const loansPath = path.resolve(__dirname, "../src/components/accounting/LoansView.tsx");
    const loansContent = fs.readFileSync(loansPath, "utf-8");
    assert.ok(
      loansPath && loansContent.includes("<PaymentAccountPicker"),
      "LoansView must use PaymentAccountPicker"
    );

    const budgetsPath = path.resolve(__dirname, "../src/components/accounting/BudgetsView.tsx");
    const budgetsContent = fs.readFileSync(budgetsPath, "utf-8");
    assert.ok(
      budgetsContent.includes("<PaymentAccountPicker"),
      "BudgetsView must use PaymentAccountPicker"
    );

    const salesPath = path.resolve(__dirname, "../src/components/accounting/SalesInvoicesView.tsx");
    const salesContent = fs.readFileSync(salesPath, "utf-8");
    assert.ok(
      salesContent.includes("<PaymentAccountPicker"),
      "SalesInvoicesView must use PaymentAccountPicker"
    );

    const recurringPath = path.resolve(__dirname, "../src/components/accounting/RecurringView.tsx");
    const recurringContent = fs.readFileSync(recurringPath, "utf-8");
    assert.ok(
      recurringContent.includes("<PaymentAccountPicker"),
      "RecurringView must use PaymentAccountPicker"
    );
  });
});
