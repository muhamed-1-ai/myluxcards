-- Migration 0044: Index for cash flow category filtering
CREATE INDEX IF NOT EXISTS idx_acc_tx_ws_je ON accounting_transactions(workspace_id, journal_entry_id);
