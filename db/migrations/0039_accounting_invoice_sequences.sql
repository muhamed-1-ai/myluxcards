-- Migration: 0039_accounting_invoice_sequences.sql
-- Safe transactional invoice numbering counter and sequence tracking

-- 1. Ensure internal_notes column exists on accounting_invoices
ALTER TABLE accounting_invoices ADD COLUMN IF NOT EXISTS internal_notes text;

-- 2. Create accounting_invoice_sequences table
CREATE TABLE IF NOT EXISTS accounting_invoice_sequences (
  workspace_id uuid NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
  period text NOT NULL,
  next_seq integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, period)
);

CREATE INDEX IF NOT EXISTS idx_acc_inv_seq_ws ON accounting_invoice_sequences(workspace_id);

-- 3. Safely initialize sequences from valid existing numeric invoice numbers without casting non-numeric suffixes
INSERT INTO accounting_invoice_sequences (workspace_id, period, next_seq, updated_at)
SELECT 
  workspace_id,
  '2026' AS period,
  COALESCE(
    MAX(
      CASE 
        WHEN invoice_number ~ '^INV-2026-([0-9]{1,8})$'
        THEN (regexp_match(invoice_number, '^INV-2026-([0-9]{1,8})$'))[1]::integer
        ELSE 0
      END
    ), 0
  ) + 1 AS next_seq,
  NOW() AS updated_at
FROM accounting_invoices
GROUP BY workspace_id
ON CONFLICT (workspace_id, period)
DO UPDATE SET next_seq = GREATEST(accounting_invoice_sequences.next_seq, EXCLUDED.next_seq);
