-- Migration 0043: Transaction Attachments for Zappit Accounts
-- Additive table to store private receipts, bills, images, and PDF documents
-- attached to accounting transactions.

CREATE TABLE IF NOT EXISTS accounting_transaction_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES accounting_transactions(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INT NOT NULL CHECK (file_size > 0),
    file_type TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE accounting_transaction_attachments
    ALTER COLUMN transaction_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acc_tx_attachments_tx ON accounting_transaction_attachments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_acc_tx_attachments_ws ON accounting_transaction_attachments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_acc_tx_attachments_created ON accounting_transaction_attachments(created_at);
