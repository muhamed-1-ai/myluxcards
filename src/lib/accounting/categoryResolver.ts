/**
 * Category & Subcategory Resolver for Zappit Accounts
 * 
 * Accurately decomposes hierarchical categories into separate main category
 * and subcategory display values, following double-entry presentation rules.
 */

export interface TransactionCategoryInfo {
  category: string;
  subcategory: string;
  hasCategory: boolean;
  hasSubcategory: boolean;
}

/**
 * Resolves main category and subcategory for a transaction based on stored hierarchy.
 *
 * Rules:
 * - Category displays the main/parent category.
 * - Subcategory displays the selected child category.
 * - Main category only: show its name under Category and "—" under Subcategory.
 * - No category: show "Uncategorized" under Category and "—" under Subcategory.
 * - Do not duplicate the main category into both columns.
 * - Relies on actual stored hierarchy, never inferring relationships from names.
 */
export function resolveTransactionCategory(tx?: {
  main_category_name?: string | null;
  subcategory_name?: string | null;
  category_name?: string | null;
  parent_category_name?: string | null;
} | null): TransactionCategoryInfo {
  if (!tx) {
    return {
      category: "Uncategorized",
      subcategory: "—",
      hasCategory: false,
      hasSubcategory: false,
    };
  }

  // 1. Explicit main_category_name and subcategory_name from SQL
  if (tx.main_category_name !== undefined || tx.subcategory_name !== undefined) {
    const main = tx.main_category_name?.trim() || null;
    const sub = tx.subcategory_name?.trim() || null;

    if (main && sub) {
      return {
        category: main,
        subcategory: sub,
        hasCategory: true,
        hasSubcategory: true,
      };
    }

    if (main) {
      return {
        category: main,
        subcategory: "—",
        hasCategory: true,
        hasSubcategory: false,
      };
    }

    return {
      category: "Uncategorized",
      subcategory: "—",
      hasCategory: false,
      hasSubcategory: false,
    };
  }

  // 2. Relational join fields: parent_category_name (parent) & category_name (leaf)
  if (tx.parent_category_name && tx.category_name) {
    return {
      category: tx.parent_category_name.trim(),
      subcategory: tx.category_name.trim(),
      hasCategory: true,
      hasSubcategory: true,
    };
  }

  if (tx.category_name && tx.category_name.trim()) {
    return {
      category: tx.category_name.trim(),
      subcategory: "—",
      hasCategory: true,
      hasSubcategory: false,
    };
  }

  return {
    category: "Uncategorized",
    subcategory: "—",
    hasCategory: false,
    hasSubcategory: false,
  };
}
