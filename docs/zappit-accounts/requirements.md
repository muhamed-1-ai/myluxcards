# Zappit Accounts: Requirements & Requirements Coverage Matrix

## Overview
Zappit Accounts is a production-grade, mobile-first financial management module built within the existing Zappit platform.
Descriptor: "Every Rupee, Clearly Managed."
Principle: Simple by default, dynamic by design, financially correct underneath.

## Core Target Audience
Microbusiness owners, tiny shops, solopreneurs, freelancers, consultants, small teams, employees, households, and individuals.

## Requirements Coverage Matrix

| Req ID | Requirement Description | Target Screen / Component | API / Service | Permission / Auth Gate | Data Model | Verification Test |
|---|---|---|---|---|---|---|
| **REQ-01** | Platform Admin Entitlement: Zappit Accounts OFF by default for all users | Admin Portal -> Users -> Edit Permissions Modal | `GET /api/admin/managed-users/[id]`, `PATCH /api/admin/managed-users/[id]` | Platform Admin only (`ADMIN`, `SUPER_ADMIN`); stored in `users.feature_permissions.accounting_access` | `users.feature_permissions` JSONB | `tests/accounting-entitlement.test.mjs` |
| **REQ-02** | Unentitled User Restriction: Hidden navigation, 403 API responses, no data leak | Sidebar, Mobile Drawer, `/dashboard/accounting/*` | `requireAccountingAccess()` server middleware & helper | Denied without `accounting_access: true` or Admin role | `users.feature_permissions` | `tests/accounting-entitlement.test.mjs` |
| **REQ-03** | Expandable Sidebar Group: Single "Accounting" group near Master Config matching shell | `DashboardDemo.tsx` Left Sidebar | Client-side active route / tab matcher | Entitled users only | Client State (`accountingOpen`, tab) | Visual audit, sidebar test |
| **REQ-04** | Dual Theme Support: White/blue light mode & near-black/blue dark mode | All Accounting views & scoped tokens | CSS Variables (`--acc-page`, `--acc-surface`, etc.) | Inherits global theme toggle (`light` / `dark`) | Theme tokens in `accounting.css` | Light/Dark theme test |
| **REQ-05** | Workspace Architecture: Personal & Business workspaces, isolation, no cross-tenant leakage | Workspace Selector, Settings | `GET/POST /api/accounting/workspaces` | Workspace membership & role checks | `accounting_workspaces`, `accounting_workspace_members` | Multi-tenant isolation test |
| **REQ-06** | Workspace Roles: Owner, Manager, Staff, Viewer with least-privilege enforcement | Team Management, Action gates | `requireWorkspaceRole(role)` | Server-side role check per mutation/action | `accounting_workspace_members.role` | RBAC test |
| **REQ-07** | Double-Entry General Ledger: Immutable debits=credits, atomic posting, traceable reversals | Transactions, Account detail | `LedgerService.postJournalEntry()` | `OWNER`, `MANAGER`, `STAFF` (create); `OWNER`, `MANAGER` (reverse) | `accounting_journal_entries`, `accounting_journal_lines` | Balanced ledger test |
| **REQ-08** | Financial Accounts: Cash, Bank, UPI Settlement, Receivables, Payables, Revenue, Expense, Loans, Equity | Accounts & Transfers screen | `GET/POST /api/accounting/accounts` | `OWNER`, `MANAGER` | `accounting_financial_accounts` | Account balance test |
| **REQ-09** | Fast Transactions: Quick entry (amount first, visible labels), Income, Expense, Transfer, Opening balance | Quick Entry Modal, Transactions view | `GET/POST /api/accounting/transactions` | `OWNER`, `MANAGER`, `STAFF` | `accounting_transactions`, `accounting_journal_entries` | Fast transaction test |
| **REQ-10** | Dynamic Categories: User-created nested subcategories, onboarding seeds, archive protection | Settings -> Categories | `GET/POST/PATCH /api/accounting/categories` | `OWNER`, `MANAGER` | `accounting_categories` | Category integrity test |
| **REQ-11** | Contacts & Money Owed: Customers, Vendors, Personal. "Owed to Me" & "I Owe" balances, aging | People screen (Tabs: Contacts, Owed to Me, I Owe) | `GET/POST /api/accounting/contacts` | `OWNER`, `MANAGER`, `STAFF` | `accounting_contacts` | Receivables/Payables test |
| **REQ-12** | Direct Sales & Invoicing: Items, taxes, discounts, draft/issued/paid states, PDF & share links | Sales & Invoices screen | `GET/POST /api/accounting/invoices`, `GET/POST /api/accounting/sales` | `OWNER`, `MANAGER`, `STAFF` | `accounting_invoices`, `accounting_invoice_lines`, `accounting_sales` | Invoice & partial payment test |
| **REQ-13** | Payment Allocations: Partial collections, preventing overpayment, installment reconciliation | Record Payment Modal | `POST /api/accounting/payments` | `OWNER`, `MANAGER`, `STAFF` | `accounting_payments`, `accounting_payment_allocations` | Overpayment prevention test |
| **REQ-14** | Zappit Leads Integration: Canonical mapping, Deal Won != Payment Received, Idempotency | Leads sync adapter / Status monitor | `POST /api/accounting/integrations/leads-sync` | System / Authorized workspace user | `accounting_outbox_events`, `leads` | Leads idempotency test |
| **REQ-15** | Loans & EMIs: Principal vs interest expense separation, repayment schedules | Loans & EMIs screen | `GET/POST /api/accounting/loans` | `OWNER`, `MANAGER` | `accounting_loans`, `accounting_loan_installments` | Loan accounting test |
| **REQ-16** | Budgets & Planning: Category & workspace limits, threshold alerts (80%, 100%) | Budgets screen | `GET/POST /api/accounting/budgets` | `OWNER`, `MANAGER` | `accounting_budgets` | Budget tracking test |
| **REQ-17** | Recurring Items: Bills, salaries, subscriptions with approval/confirmation | Recurring Items screen | `GET/POST /api/accounting/recurring` | `OWNER`, `MANAGER` | `accounting_recurring_rules` | Recurring rules test |
| **REQ-18** | Reports & Analytics: Income vs Expense (earned & cash basis), Cash Flow, Aging, CSV/XLSX export | Reports screen & sub-reports | `GET /api/accounting/reports/*`, `GET /api/accounting/reports/export` | `OWNER`, `MANAGER` (and `VIEWER` where allowed) | Consolidated ledger aggregates | Financial reconciliation test |
| **REQ-19** | Reminders & Notifications: Overdue invoices, upcoming EMIs/bills, settled balance dismissal | Reminders screen, In-app modal | `GET/POST /api/accounting/reminders` | Workspace member | `accounting_reminders`, `notifications` | Reminders lifecycle test |
| **REQ-20** | Mobile-First UI: Bottom nav (Home, Transactions, People, Reports, More), responsive sheets | Mobile shell on screens <= 1024px | Client responsive layout | Entitled users only | UI components | Mobile layout & touch target test |
