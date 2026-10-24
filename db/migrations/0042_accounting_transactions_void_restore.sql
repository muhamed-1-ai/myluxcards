-- Migration 0042: Void and Restore Audit Columns for Accounting Transactions
-- Additive columns for auditing who voided/restored each transaction and when,
-- along with performance indexes for voided/active expense filtering.

ALTER TABLE accounting_transactions
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restored_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_acc_tx_ws_status_type
  ON accounting_transactions(workspace_id, status, type);

CREATE INDEX IF NOT EXISTS idx_acc_tx_ws_status
  ON accounting_transactions(workspace_id, status);

-- Backfill already-voided transactions so voided_at and voided_by are populated
UPDATE accounting_transactions t
SET voided_at = COALESCE(t.updated_at, t.created_at),
    voided_by = COALESCE(
      (
        SELECT actor_id
        FROM accounting_audit_logs al
        WHERE (al.entity_id = t.journal_entry_id OR al.entity_id = t.id)
        ORDER BY al.created_at DESC
        LIMIT 1
      ),
      t.created_by
    )
WHERE t.status = 'VOIDED' AND t.voided_at IS NULL;
