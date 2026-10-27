-- Migration 0045: Accounting Recovery Versions for Reversible Reset and Safe Restore
-- Provides production-safe, versioned recovery datasets for isolated workspace accounting data.

CREATE TABLE IF NOT EXISTS accounting_recovery_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    name TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('PRE_RESET', 'PRE_RESTORE', 'MANUAL')),
    status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'RESTORED', 'EXPIRED', 'CORRUPTED')) DEFAULT 'AVAILABLE',
    checksum TEXT NOT NULL,
    data_payload JSONB NOT NULL,
    record_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    financial_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
    restored_at TIMESTAMPTZ,
    restored_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_acc_rec_vers_ws_created ON accounting_recovery_versions(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_acc_rec_vers_ws_status ON accounting_recovery_versions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_acc_rec_vers_expires ON accounting_recovery_versions(expires_at);
