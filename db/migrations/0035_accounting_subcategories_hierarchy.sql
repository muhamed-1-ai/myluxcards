-- Migration 0035: Accounting Subcategories Hierarchy & Safe Uniqueness
-- Allows subcategories under parents, allows identical subcategory names across different parents,
-- enforces case/whitespace-normalized uniqueness within the same parent or root, and indexes parent_id.

ALTER TABLE accounting_categories DROP CONSTRAINT IF EXISTS uq_acc_category_name;

ALTER TABLE accounting_categories
  ADD CONSTRAINT uq_acc_category_parent_name
  UNIQUE NULLS NOT DISTINCT (workspace_id, type, parent_id, name);

CREATE INDEX IF NOT EXISTS idx_acc_categories_parent_id ON accounting_categories(parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_category_root_lower
  ON accounting_categories (workspace_id, type, LOWER(TRIM(name)))
  WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_acc_category_sub_lower
  ON accounting_categories (workspace_id, parent_id, LOWER(TRIM(name)))
  WHERE parent_id IS NOT NULL;
