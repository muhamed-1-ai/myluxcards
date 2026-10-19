# Zappit Accounts: Architecture & Technical Design

## 1. High-Level Architecture

Zappit Accounts is integrated directly into the existing Next.js App Router and PostgreSQL architecture. It does not run as a disjoint microservice or substitute application shell.

```text
Browser Client (Desktop / Mobile)
   │
   ▼
Next.js App Router (/dashboard?tab=accounting-* and /dashboard/accounting/*)
   │
   ├─► Server-Side Authentication & Platform Entitlement Gate
   │     ├─ Auth: currentIdentity(req) via NextAuth JWT + DB session verification
   │     └─ Module Entitlement: requireAccountingAccess(identity)
   │
   ├─► Workspace Tenancy & Role-Based Access Control (RBAC)
   │     ├─ Multi-Tenant Isolation: Workspace boundary enforced on EVERY query
   │     └─ Role Gate: OWNER, MANAGER, STAFF, VIEWER least-privilege checks
   │
   ├─► Application & Ledger Services (src/lib/accounting/*)
   │     ├─ LedgerService: Atomic double-entry journal postings (Debits = Credits)
   │     ├─ TransactionService: Cash vs Accrual entry creation & reversals
   │     ├─ InvoiceService: Invoicing, direct sales, immutable numbering, allocations
   │     ├─ LeadsSyncAdapter: Idempotent integration with existing Leads module
   │     ├─ LoanService: Principal vs interest split & installment schedules
   │     ├─ BudgetService: Period tracking & threshold notifications
   │     └─ ReportService: Cash Flow, Income Statement, Aging, Ledger Reconciliation
   │
   ▼
PostgreSQL Database (Direct Pool & Prisma ORM)
   └─ Tables: accounting_workspaces, accounting_workspace_members, accounting_financial_accounts,
              accounting_categories, accounting_contacts, accounting_products, accounting_sales,
              accounting_invoices, accounting_invoice_lines, accounting_payments,
              accounting_payment_allocations, accounting_journal_entries, accounting_journal_lines,
              accounting_transactions, accounting_loans, accounting_loan_installments,
              accounting_budgets, accounting_recurring_rules, accounting_reminders,
              accounting_audit_logs, accounting_outbox_events
```

## 2. Authentication & Authorization Flow

1. **Authentication**: Reuses `src/lib/auth/currentIdentity.ts`. The session token contains `userId`, verified against the `users` table for `status = 'ACTIVE'`, `disabled = false`, and `session_version` consistency.
2. **Platform Module Entitlement (`accounting_access`)**:
   - `users.feature_permissions.accounting_access` is evaluated.
   - For `SUPER_ADMIN` and `ADMIN`, access is universally permitted.
   - For ordinary users (`CUSTOMER` / `USER`), access is strictly DENIED unless `accounting_access === true`.
   - New signups (Google OAuth and manual credential registration) and newly invited users receive `ZERO_FEATURE_PERMISSIONS`, ensuring Accounting is **OFF by default**.
   - Grants and revocations are performed strictly by platform administrators in `Admin Portal -> Users -> Permissions` modal, which increments `session_version` and writes to `admin_audit_logs`.
3. **Workspace Tenancy & Permissions**:
   - A user belongs to one or more Workspaces (Personal or Business).
   - Roles within a workspace:
     - `OWNER`: Full administrative and financial control.
     - `MANAGER`: All transactional and reporting operations, excluding ownership transfer.
     - `STAFF`: Fast transaction creation, contact viewing, payment recording. Restricted from viewing sensitive owner equity or modifying settings.
     - `VIEWER`: Read-only access to authorized reports and records. Cannot mutate state.
   - Personal workspaces are strictly private to their owner; team members cannot access them.

## 3. Financial Model & Ledger Invariants

- **Exact Integer Arithmetic**: All monetary fields are stored as integer minor units (`bigint` paise in INR; ₹100.50 is stored as `10050`). No floating-point rounding errors.
- **Atomic Double-Entry Posting**: Every financial transaction generates a balanced journal entry with lines where `SUM(debits) === SUM(credits)`.
- **Accrual vs Cash Distinctness**:
  - Credit Sale: Debits Accounts Receivable (Asset), Credits Sales Revenue (Income). Cash is unaffected.
  - Payment Collection: Debits Bank/Cash (Asset), Credits Accounts Receivable (Asset). Revenue is unaffected.
  - Expense Incurred on Credit: Debits Expense, Credits Accounts Payable.
  - Expense Payment: Debits Accounts Payable, Credits Cash/Bank.
- **Traceable Corrections**: Posted ledger entries are never silently modified or deleted. Reversals create explicit offset journal entries linked via `reversal_of_entry_id`.
- **Payment Allocations**: Collections apply to specific invoices. Payments cannot exceed invoice balance due.

## 4. UI Shell & Design System Integration

- **Left Sidebar**: Integrates a single expandable "Accounting" group inside `DashboardDemo.tsx` located under the Management section near "Master Config".
- **Navigation Children**:
  1. Overview
  2. Transactions
  3. People (Contacts, Owed to Me, I Owe)
  4. Sales & Invoices (Direct Sales, Invoices, Receipts)
  5. Accounts & Transfers (Cash, Bank, UPI, Transfers)
  6. Budgets
  7. Loans & EMIs
  8. Recurring Items
  9. Reports (Income vs Expense, Cash Flow, Aging)
  10. Reminders
  11. Settings (Categories, Workspaces, Team, Export)
- **Scoped Color Tokens**:
  - Light mode: Page `#F7F9FC`, Surface `#FFFFFF`, Border `#E2E8F0`, Text `#0F172A`, Muted `#475569`, Primary `#2563EB`, Selection `#EFF6FF`.
  - Dark mode: Page `#0B1018`, Surface `#121A26`, Border `#293548`, Text `#F1F5F9`, Muted `#A8B5C7`, Primary `#3B82F6`, Selection `#142B4F`.
- **Mobile-First Experience**:
  - Dedicated bottom navigation on mobile viewport: Home, Transactions, People, Reports, More.
  - Minimum 44px touch targets, responsive sheet modals, zero horizontal overflow.
