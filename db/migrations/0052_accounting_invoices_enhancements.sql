-- Migration: 0052_accounting_invoices_enhancements.sql
-- Invoice branding, snapshots, warranty details, and direct sale links

-- 1. Invoice settings table for workspace branding, notes, terms, and numbering
CREATE TABLE IF NOT EXISTS accounting_invoice_settings (
  workspace_id UUID PRIMARY KEY REFERENCES accounting_workspaces(id) ON DELETE CASCADE,
  business_name TEXT,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  tax_id TEXT,
  tax_label TEXT DEFAULT 'GSTIN',
  default_notes TEXT,
  default_terms TEXT DEFAULT 'Net 30',
  default_warranty_terms TEXT,
  invoice_prefix TEXT DEFAULT 'INV',
  next_sequence INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acc_inv_settings_ws ON accounting_invoice_settings(workspace_id);

-- 2. Enhance accounting_invoices with seller & customer snapshots and direct sale reference
ALTER TABLE accounting_invoices
  ADD COLUMN IF NOT EXISTS seller_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS customer_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS direct_sale_id UUID REFERENCES accounting_sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warranty_terms TEXT;

CREATE INDEX IF NOT EXISTS idx_acc_inv_direct_sale ON accounting_invoices(direct_sale_id);

-- 3. Enhance accounting_invoice_lines with model, SKU, serial number, and per-item warranty
ALTER TABLE accounting_invoice_lines
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS warranty_type TEXT CHECK (warranty_type IN ('NONE', 'MANUFACTURER', 'SELLER', 'CUSTOM')) DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS warranty_duration_months INT,
  ADD COLUMN IF NOT EXISTS warranty_start_date DATE,
  ADD COLUMN IF NOT EXISTS warranty_end_date DATE,
  ADD COLUMN IF NOT EXISTS warranty_coverage TEXT,
  ADD COLUMN IF NOT EXISTS warranty_exclusions TEXT,
  ADD COLUMN IF NOT EXISTS warranty_contact TEXT;

-- 4. Enhance accounting_products with catalog default warranty fields
ALTER TABLE accounting_products
  ADD COLUMN IF NOT EXISTS default_warranty_type TEXT CHECK (default_warranty_type IN ('NONE', 'MANUFACTURER', 'SELLER', 'CUSTOM')) DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS default_warranty_duration_months INT,
  ADD COLUMN IF NOT EXISTS default_warranty_coverage TEXT,
  ADD COLUMN IF NOT EXISTS default_warranty_exclusions TEXT,
  ADD COLUMN IF NOT EXISTS default_warranty_contact TEXT;
