-- 0051_accounting_purchases.sql
-- Production schema for Zappit Accounts Purchases and Supplier Bill Tracking
-- Supports Draft, Unpaid, Partially Paid, and Fully Paid purchases with authoritative
-- double-entry ledger linking, payment tracking, and supplier payable reconciliation.

-- 1. Purchases Table
CREATE TABLE IF NOT EXISTS accounting_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    purchase_number TEXT NOT NULL,
    supplier_id UUID REFERENCES accounting_contacts(id) ON DELETE SET NULL,
    supplier_name TEXT,
    supplier_bill_number TEXT,
    purchase_date DATE NOT NULL,
    due_date DATE,
    category_id UUID REFERENCES accounting_categories(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOIDED')) DEFAULT 'DRAFT',
    purchase_type TEXT NOT NULL CHECK (purchase_type IN ('EXPENSE', 'INVENTORY', 'ASSET')) DEFAULT 'EXPENSE',
    currency TEXT NOT NULL DEFAULT 'INR',
    subtotal_minor BIGINT NOT NULL DEFAULT 0,
    discount_minor BIGINT NOT NULL DEFAULT 0,
    tax_minor BIGINT NOT NULL DEFAULT 0,
    total_minor BIGINT NOT NULL DEFAULT 0,
    amount_paid_minor BIGINT NOT NULL DEFAULT 0,
    amount_due_minor BIGINT NOT NULL DEFAULT 0,
    notes TEXT,
    posted_journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES accounting_transactions(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    voided_at TIMESTAMPTZ,
    voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
    void_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_acc_purchase_number UNIQUE (workspace_id, purchase_number)
);

CREATE INDEX IF NOT EXISTS idx_acc_purchases_ws_status_date
  ON accounting_purchases(workspace_id, status, purchase_date);

CREATE INDEX IF NOT EXISTS idx_acc_purchases_supplier
  ON accounting_purchases(supplier_id);

CREATE INDEX IF NOT EXISTS idx_acc_purchases_bill_num
  ON accounting_purchases(workspace_id, supplier_bill_number);

-- 2. Purchase Line Items
CREATE TABLE IF NOT EXISTS accounting_purchase_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES accounting_purchases(id) ON DELETE CASCADE,
    product_id UUID REFERENCES accounting_products(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit_price_minor BIGINT NOT NULL DEFAULT 0,
    discount_minor BIGINT NOT NULL DEFAULT 0,
    tax_minor BIGINT NOT NULL DEFAULT 0,
    total_minor BIGINT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_acc_purchase_lines_purch
  ON accounting_purchase_lines(purchase_id);

-- 3. Purchase Number Sequences (Yearly Sequential Numbering)
CREATE TABLE IF NOT EXISTS accounting_purchase_sequences (
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    period TEXT NOT NULL,
    next_seq INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, period)
);

-- 4. Purchase Payments Tracking
CREATE TABLE IF NOT EXISTS accounting_purchase_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES accounting_purchases(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES accounting_payments(id) ON DELETE CASCADE,
    financial_account_id UUID NOT NULL REFERENCES accounting_financial_accounts(id) ON DELETE RESTRICT,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    payment_date DATE NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    reference_number TEXT,
    notes TEXT,
    journal_entry_id UUID REFERENCES accounting_journal_entries(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('POSTED', 'VOIDED')) DEFAULT 'POSTED',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_purch_payments_purch
  ON accounting_purchase_payments(purchase_id);

CREATE INDEX IF NOT EXISTS idx_acc_purch_payments_ws
  ON accounting_purchase_payments(workspace_id, payment_date);

-- 5. Link Purchases in Transactions Table
ALTER TABLE accounting_transactions
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES accounting_purchases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_acc_tx_purchase
  ON accounting_transactions(purchase_id);

-- 6. Link Purchases in Transaction Attachments Table
ALTER TABLE accounting_transaction_attachments
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES accounting_purchases(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_acc_attachments_purchase
  ON accounting_transaction_attachments(purchase_id);
