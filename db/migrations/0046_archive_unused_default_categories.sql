-- Migration 0046: Safely archive unused default preset categories
-- Preserves categories that have historical transactions, budgets, recurring rules, or active subcategories.
-- Preserves all customer-created categories (where is_system = false).

UPDATE accounting_categories c
SET is_archived = true,
    updated_at = NOW()
WHERE c.is_system = true
  AND c.is_archived = false
  AND c.parent_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounting_transactions t WHERE t.category_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM accounting_budgets b WHERE b.category_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM accounting_recurring_rules r WHERE r.category_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM accounting_categories sub WHERE sub.parent_id = c.id AND sub.is_archived = false
  );
