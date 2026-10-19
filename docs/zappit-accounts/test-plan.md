# Zappit Accounts: Automated Test Plan & Acceptance Matrix

## 1. Test Suite Architecture

All automated test suites are implemented in `tests/` using Node.js native test runner (`node:test` and `node:assert/strict`) to integrate with the project's existing test commands.

## 2. Critical Acceptance Criteria Test Specifications

| Case # | Scenario | Expected Invariant & Verification | Test File |
|---|---|---|---|
| **Case 1** | ₹10,000 credit sale with ₹4,000 partial collection | Revenue: ₹10,000; Cash: +₹4,000; Accounts Receivable: ₹6,000. Never ₹10,000 cash. | `tests/accounting-ledger.test.mjs` |
| **Case 2** | Walk-in direct sale with no lead | Creates sale, posts balanced journal (Cash Dr, Sales Revenue Cr), updates reports without requiring Leads. | `tests/accounting-sales-invoices.test.mjs` |
| **Case 3** | ₹1,500 school expense in dynamic category | Category created on-the-fly, appears in search, expense entry posts (Expense Dr, Cash Cr), visible in budget and reports. | `tests/accounting-categories.test.mjs` |
| **Case 4** | Duplicate Leads event or retried API request | Same `idempotency_key` submitted twice; second attempt returns 200 with original IDs without duplicate journal/sale. | `tests/accounting-leads-sync.test.mjs` |
| **Case 5** | Invoice paid in 2 installments, then fully paid | Installment 1 (₹3,000) -> status PARTIALLY_PAID, balance ₹7,000; Installment 2 (₹7,000) -> status PAID, balance ₹0, reminders cancelled. | `tests/accounting-invoices-payments.test.mjs` |
| **Case 6** | ₹20,000 loan receipt & repayment | Receipt: Cash +₹20,000, Liability +₹20,000 (Revenue is 0). Repayment: Principal reduces Liability, Interest posts to Interest Expense. | `tests/accounting-loans.test.mjs` |
| **Case 7** | Account-to-account transfer & workspace isolation | Transfer between Cash and Bank changes balances; net revenue/expense unchanged. User in Workspace A cannot access Workspace B. | `tests/accounting-transfers-workspaces.test.mjs` |
| **Case 8** | Staff permission least-privilege enforcement | Staff cannot view personal workspace, cannot modify settings, cannot reverse posted journals, cannot export restricted reports. | `tests/accounting-rbac.test.mjs` |
| **Case 9** | Concurrent payment & overpayment prevention | Attempting to allocate ₹11,000 to ₹10,000 invoice rejected. Correction generates balanced reversal entry with audit log. | `tests/accounting-allocations-reversals.test.mjs` |
| **Case 10** | Currency precision, date filters, archived categories | Integer minor units verified, timezone-safe date queries, archived category remains in historical reports but hidden from new entries. | `tests/accounting-precision-filters.test.mjs` |
| **Case 11** | General Ledger Balances Invariant | In every posted journal entry: `SUM(debits) === SUM(credits)`. Reports reconcile to underlying account balances. | `tests/accounting-ledger.test.mjs` |
| **Case 12** | Platform Admin Entitlement (`accounting_access`) | OFF by default for new/existing users. Only admin can grant. Revocation blocks API & UI immediately without logout. | `tests/accounting-entitlement.test.mjs` |

## 3. Execution Commands
```bash
node tests/accounting-entitlement.test.mjs
node tests/accounting-ledger.test.mjs
node tests/accounting-sales-invoices.test.mjs
node tests/accounting-categories.test.mjs
node tests/accounting-invoices-payments.test.mjs
node tests/accounting-loans.test.mjs
node tests/accounting-transfers-workspaces.test.mjs
node tests/accounting-rbac.test.mjs
node tests/accounting-leads-sync.test.mjs
```
