-- 0034_zappit_accounts_foundation.sql
-- Production schema for Zappit Accounts financial module

-- 1. Workspaces
CREATE TABLE IF NOT EXISTS accounting_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('PERSONAL', 'BUSINESS')) DEFAULT 'BUSINESS',
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    profile_template TEXT NOT NULL DEFAULT 'BUSINESS_OWNER',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_workspaces_owner ON accounting_workspaces(owner_user_id);

-- 2. Workspace Members & Roles
CREATE TABLE IF NOT EXISTS accounting_workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'STAFF', 'VIEWER')),
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_acc_members_user ON accounting_workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_acc_members_workspace ON accounting_workspace_members(workspace_id);

-- 3. Financial Accounts (Double-Entry Chart of Accounts)
CREATE TABLE IF NOT EXISTS accounting_financial_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    subtype TEXT NOT NULL CHECK (subtype IN ('CASH', 'BANK', 'UPI', 'RECEIVABLE', 'PAYABLE', 'REVENUE', 'EXPENSE', 'LOAN', 'EQUITY')),
    currency TEXT NOT NULL DEFAULT 'INR',
    account_number_mask TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    opening_balance_minor BIGINT NOT NULL DEFAULT 0,
    current_balance_minor BIGINT NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_fin_account_code UNIQUE (workspace_id, code)
);

CREATE INDEX IF NOT EXISTS idx_acc_fin_accounts_ws ON accounting_financial_accounts(workspace_id, is_active);

-- 4. Dynamic Categories
CREATE TABLE IF NOT EXISTS accounting_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES accounting_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    icon TEXT,
    color TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_category_name UNIQUE (workspace_id, type, name)
);

CREATE INDEX IF NOT EXISTS idx_acc_categories_ws ON accounting_categories(workspace_id, is_archived);

-- 5. Contacts (Customers, Vendors, Personal)
CREATE TABLE IF NOT EXISTS accounting_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('CUSTOMER', 'VENDOR', 'PERSONAL')),
    email TEXT,
    phone TEXT,
    phone_normalized TEXT,
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    total_receivable_minor BIGINT NOT NULL DEFAULT 0,
    total_payable_minor BIGINT NOT NULL DEFAULT 0,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_contacts_ws ON accounting_contacts(workspace_id, type, is_active);
CREATE INDEX IF NOT EXISTS idx_acc_contacts_lead ON accounting_contacts(lead_id);

-- 6. Products & Services Catalog
CREATE TABLE IF NOT EXISTS accounting_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'pcs',
    default_price_minor BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    catalog_product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_products_ws ON accounting_products(workspace_id, is_active);

-- 7. Journal Entries (General Ledger Core)
CREATE TABLE IF NOT EXISTS accounting_journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    entry_number TEXT NOT NULL,
    entry_date DATE NOT NULL,
    entry_type TEXT NOT NULL,
    description TEXT NOT NULL,
    reference TEXT,
    source_type TEXT NOT NULL,
    source_id TEXT,
    idempotency_key TEXT,
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'VOIDED')) DEFAULT 'POSTED',
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    reversal_of_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
    reversed_by_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_journal_entry_num UNIQUE (workspace_id, entry_number),
    CONSTRAINT uq_acc_journal_idempotency UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_acc_journal_ws_date ON accounting_journal_entries(workspace_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_acc_journal_source ON accounting_journal_entries(workspace_id, source_type, source_id);

-- 8. Journal Lines (Atomic Double-Entry lines)
CREATE TABLE IF NOT EXISTS accounting_journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
    financial_account_id UUID NOT NULL REFERENCES accounting_financial_accounts(id) ON DELETE RESTRICT,
    debit_minor BIGINT NOT NULL DEFAULT 0 CHECK (debit_minor >= 0),
    credit_minor BIGINT NOT NULL DEFAULT 0 CHECK (credit_minor >= 0),
    description TEXT,
    CONSTRAINT chk_acc_journal_line_nonzero CHECK (debit_minor > 0 OR credit_minor > 0)
);

CREATE INDEX IF NOT EXISTS idx_acc_jlines_entry ON accounting_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_acc_jlines_account ON accounting_journal_lines(financial_account_id);

-- 9. Invoices & Invoice Lines
CREATE TABLE IF NOT EXISTS accounting_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    contact_id UUID REFERENCES accounting_contacts(id) ON DELETE SET NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID', 'OVERDUE')) DEFAULT 'DRAFT',
    currency TEXT NOT NULL DEFAULT 'INR',
    subtotal_minor BIGINT NOT NULL DEFAULT 0,
    discount_minor BIGINT NOT NULL DEFAULT 0,
    tax_minor BIGINT NOT NULL DEFAULT 0,
    total_minor BIGINT NOT NULL DEFAULT 0,
    amount_paid_minor BIGINT NOT NULL DEFAULT 0,
    amount_due_minor BIGINT NOT NULL DEFAULT 0,
    notes TEXT,
    terms TEXT,
    share_token TEXT UNIQUE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    posted_journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_invoice_number UNIQUE (workspace_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_acc_invoices_ws ON accounting_invoices(workspace_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_acc_invoices_contact ON accounting_invoices(contact_id);

CREATE TABLE IF NOT EXISTS accounting_invoice_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES accounting_invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES accounting_products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit_price_minor BIGINT NOT NULL DEFAULT 0,
    discount_minor BIGINT NOT NULL DEFAULT 0,
    tax_minor BIGINT NOT NULL DEFAULT 0,
    total_minor BIGINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_acc_inv_lines_inv ON accounting_invoice_lines(invoice_id);

-- 10. Direct Sales
CREATE TABLE IF NOT EXISTS accounting_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    sale_number TEXT NOT NULL,
    contact_id UUID REFERENCES accounting_contacts(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    total_minor BIGINT NOT NULL DEFAULT 0,
    paid_minor BIGINT NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    financial_account_id UUID REFERENCES accounting_financial_accounts(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES accounting_invoices(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    notes TEXT,
    status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'PARTIAL', 'REFUNDED', 'VOID')) DEFAULT 'COMPLETED',
    posted_journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_sale_number UNIQUE (workspace_id, sale_number)
);

CREATE INDEX IF NOT EXISTS idx_acc_sales_ws ON accounting_sales(workspace_id, date);

-- 11. Payments & Payment Allocations
CREATE TABLE IF NOT EXISTS accounting_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    payment_number TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    contact_id UUID REFERENCES accounting_contacts(id) ON DELETE SET NULL,
    financial_account_id UUID NOT NULL REFERENCES accounting_financial_accounts(id) ON DELETE RESTRICT,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    reference_number TEXT,
    notes TEXT,
    journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_payment_num UNIQUE (workspace_id, payment_number)
);

CREATE INDEX IF NOT EXISTS idx_acc_payments_ws ON accounting_payments(workspace_id, payment_date);

CREATE TABLE IF NOT EXISTS accounting_payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES accounting_payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES accounting_invoices(id) ON DELETE CASCADE,
    allocated_minor BIGINT NOT NULL CHECK (allocated_minor > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_payment_allocation UNIQUE (payment_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_acc_alloc_invoice ON accounting_payment_allocations(invoice_id);

-- 12. User Transactions (Quick UI view)
CREATE TABLE IF NOT EXISTS accounting_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    journal_entry_id UUID NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER', 'COLLECTION', 'PAYMENT', 'LOAN')),
    category_id UUID REFERENCES accounting_categories(id) ON DELETE SET NULL,
    financial_account_id UUID NOT NULL REFERENCES accounting_financial_accounts(id) ON DELETE RESTRICT,
    destination_account_id UUID REFERENCES accounting_financial_accounts(id) ON DELETE RESTRICT,
    contact_id UUID REFERENCES accounting_contacts(id) ON DELETE SET NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    date DATE NOT NULL,
    notes TEXT,
    status TEXT NOT NULL CHECK (status IN ('POSTED', 'VOIDED')) DEFAULT 'POSTED',
    attachment_url TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_tx_ws_date ON accounting_transactions(workspace_id, date);
CREATE INDEX IF NOT EXISTS idx_acc_tx_category ON accounting_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_acc_tx_account ON accounting_transactions(financial_account_id);

-- 13. Loans & Installments
CREATE TABLE IF NOT EXISTS accounting_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    loan_name TEXT NOT NULL,
    lender_contact_id UUID REFERENCES accounting_contacts(id) ON DELETE SET NULL,
    liability_account_id UUID NOT NULL REFERENCES accounting_financial_accounts(id) ON DELETE RESTRICT,
    disbursement_account_id UUID NOT NULL REFERENCES accounting_financial_accounts(id) ON DELETE RESTRICT,
    principal_minor BIGINT NOT NULL CHECK (principal_minor > 0),
    interest_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tenure_months INT NOT NULL CHECK (tenure_months > 0),
    start_date DATE NOT NULL,
    monthly_installment_minor BIGINT NOT NULL DEFAULT 0,
    remaining_principal_minor BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAID_OFF', 'DEFAULTED')) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_loans_ws ON accounting_loans(workspace_id, status);

CREATE TABLE IF NOT EXISTS accounting_loan_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES accounting_loans(id) ON DELETE CASCADE,
    installment_number INT NOT NULL,
    due_date DATE NOT NULL,
    principal_minor BIGINT NOT NULL CHECK (principal_minor >= 0),
    interest_minor BIGINT NOT NULL CHECK (interest_minor >= 0),
    total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'OVERDUE')) DEFAULT 'PENDING',
    paid_date DATE,
    payment_id UUID REFERENCES accounting_payments(id) ON DELETE SET NULL,
    journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
    CONSTRAINT uq_acc_loan_inst_num UNIQUE (loan_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_acc_loan_inst_due ON accounting_loan_installments(loan_id, due_date, status);

-- 14. Budgets
CREATE TABLE IF NOT EXISTS accounting_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    category_id UUID REFERENCES accounting_categories(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('MONTHLY', 'QUARTERLY', 'YEARLY')) DEFAULT 'MONTHLY',
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    spent_minor BIGINT NOT NULL DEFAULT 0,
    alert_threshold_percent INT NOT NULL DEFAULT 80,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_budgets_ws ON accounting_budgets(workspace_id, period_start, period_end);

-- 15. Recurring Rules
CREATE TABLE IF NOT EXISTS accounting_recurring_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'BILL', 'SALARY', 'SUBSCRIPTION')),
    category_id UUID REFERENCES accounting_categories(id) ON DELETE SET NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')) DEFAULT 'MONTHLY',
    next_due_date DATE NOT NULL,
    financial_account_id UUID REFERENCES accounting_financial_accounts(id) ON DELETE SET NULL,
    auto_post BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED')) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_recurring_ws ON accounting_recurring_rules(workspace_id, next_due_date, status);

-- 16. Reminders
CREATE TABLE IF NOT EXISTS accounting_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('INVOICE_DUE', 'BILL_DUE', 'LOAN_EMI', 'BUDGET_EXCEEDED', 'CUSTOM')),
    due_date DATE NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'TRIGGERED', 'DISMISSED', 'CANCELLED')) DEFAULT 'PENDING',
    dismissed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_reminders_user ON accounting_reminders(user_id, status, due_date);

-- 17. Audit Logs
CREATE TABLE IF NOT EXISTS accounting_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    previous_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_audit_ws ON accounting_audit_logs(workspace_id, created_at);

-- 18. Outbox Events (Idempotent Event Sync)
CREATE TABLE IF NOT EXISTS accounting_outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    payload JSONB NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')) DEFAULT 'PENDING',
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_outbox_status ON accounting_outbox_events(status, created_at);
