-- Migration: 0037_budget_enhancements.sql
-- Add custom name and icon to accounting_budgets table

ALTER TABLE accounting_budgets
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT;

-- Populate existing budgets with category name or 'Overall Workspace Budget'
UPDATE accounting_budgets b
SET name = c.name
FROM accounting_categories c
WHERE b.category_id = c.id AND (b.name IS NULL OR TRIM(b.name) = '');

UPDATE accounting_budgets
SET name = 'Overall Workspace Budget'
WHERE category_id IS NULL AND (name IS NULL OR TRIM(name) = '');

UPDATE accounting_budgets
SET icon = '💰'
WHERE icon IS NULL OR TRIM(icon) = '';

CREATE INDEX IF NOT EXISTS idx_accounting_budgets_ws_period 
  ON accounting_budgets(workspace_id, period_start, period_end);
