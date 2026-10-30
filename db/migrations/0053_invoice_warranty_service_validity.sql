-- Migration: 0053_invoice_warranty_service_validity.sql
-- Add warranty provider, service validity dates, structured address, and return terms

-- 1. Enhance accounting_invoice_lines with warranty_provider, service_start_date, service_end_date
ALTER TABLE accounting_invoice_lines
  ADD COLUMN IF NOT EXISTS warranty_provider TEXT,
  ADD COLUMN IF NOT EXISTS service_start_date DATE,
  ADD COLUMN IF NOT EXISTS service_end_date DATE;

-- 2. Enhance accounting_products with default_warranty_provider
ALTER TABLE accounting_products
  ADD COLUMN IF NOT EXISTS default_warranty_provider TEXT;

-- 3. Enhance accounting_invoice_settings with structured address fields and return terms
ALTER TABLE accounting_invoice_settings
  ADD COLUMN IF NOT EXISTS default_return_terms TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;
