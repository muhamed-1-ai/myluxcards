import "server-only";
import { pool } from "@/lib/db";
import type { BudgetRow } from "./types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONTH_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Deterministically compute the calendar start and end dates of a month (YYYY-MM).
 * Avoids toISOString() timezone shifting.
 */
export function getMonthDateRange(monthStr: string): { periodStart: string; periodEnd: string } {
  const match = MONTH_REGEX.exec(monthStr.trim());
  if (!match) {
    throw new Error("Invalid budget month format. Expected YYYY-MM.");
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  // In UTC, day 0 of month (M+1) is the last day of month M
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const periodStart = `${match[1]}-${match[2]}-01`;
  const periodEnd = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`;
  return { periodStart, periodEnd };
}

export function formatPeriodDate(d: any): string {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  if (d instanceof Date) {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  }
  return String(d).slice(0, 10);
}

/**
 * Format a budget database record to guarantee frontend contract compatibility.
 */
export function formatBudgetRecord(b: any): any {
  const amountMinor = Number(b.amount_minor || 0);
  const spentMinor = Number(b.spent_minor || 0);
  const remainingMinor = amountMinor - spentMinor;
  const percentUsed = amountMinor > 0 ? Math.round((spentMinor / amountMinor) * 100) : 0;
  const isExceeded = spentMinor > amountMinor;

  const startDate = formatPeriodDate(b.period_start || b.start_date);
  const endDate = formatPeriodDate(b.period_end || b.end_date);

  let formattedCategoryName = b.category_name || (b.category_id ? "Unknown Category" : "Overall Workspace Budget");
  if (b.parent_category_name && b.category_name) {
    formattedCategoryName = `${b.parent_category_name} → ${b.category_name}`;
  }

  const budgetName = (b.name && String(b.name).trim()) || formattedCategoryName;
  const budgetIcon = (b.icon && String(b.icon).trim()) || (b.category_id ? "📊" : "💰");

  return {
    ...b,
    name: budgetName,
    icon: budgetIcon,
    period_type: b.period_type || "MONTHLY",
    period: b.period_type || "MONTHLY",
    period_start: startDate,
    period_end: endDate,
    start_date: startDate,
    end_date: endDate,
    amount_minor: amountMinor,
    spent_minor: spentMinor,
    remaining_minor: remainingMinor,
    percent_used: percentUsed,
    is_exceeded: isExceeded,
    category_name: formattedCategoryName,
    transaction_count: Number(b.transaction_count || 0),
  };
}

export interface CreateBudgetInput {
  workspaceId: string;
  name?: string | null;
  icon?: string | null;
  categoryId?: string | null;
  periodType?: "MONTHLY" | "QUARTERLY" | "YEARLY";
  month?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  amountMinor: number;
  alertThresholdPercent?: number;
}

export async function createBudget(input: CreateBudgetInput): Promise<BudgetRow> {
  const workspaceId = input.workspaceId;
  if (!workspaceId) throw new Error("Workspace ID is required.");

  // 1. Validate monetary limit
  const amountMinor = Math.round(Number(input.amountMinor));
  if (isNaN(amountMinor) || amountMinor <= 0) {
    throw new Error("Budget limit must be a positive monetary amount greater than zero.");
  }

  // 2. Canonical period_start & period_end derivation
  let periodStart: string;
  let periodEnd: string;

  const rawMonth = typeof input.month === "string" ? input.month.trim() : null;
  const rawStart = (input.periodStart || input.startDate || "").trim();
  const rawEnd = (input.periodEnd || input.endDate || "").trim();

  if (rawMonth) {
    const range = getMonthDateRange(rawMonth);
    periodStart = range.periodStart;
    periodEnd = range.periodEnd;
  } else if (rawStart && rawEnd) {
    if (!DATE_REGEX.test(rawStart) || !DATE_REGEX.test(rawEnd)) {
      throw new Error("Invalid budget dates. Expected YYYY-MM-DD.");
    }
    if (rawStart > rawEnd) {
      throw new Error("Budget period start date cannot be after end date.");
    }
    periodStart = rawStart;
    periodEnd = rawEnd;
  } else {
    throw new Error("Budget month or period dates (periodStart and periodEnd) are required.");
  }

  // 3. Category validation (optional)
  let categoryId: string | null = null;
  let categoryName = "Overall Workspace Budget";
  let parentCategoryName: string | null = null;
  const rawCat = typeof input.categoryId === "string" ? input.categoryId.trim() : null;
  if (rawCat) {
    if (!UUID_REGEX.test(rawCat)) {
      throw new Error("Invalid category identifier format.");
    }
    const catRes = await pool.query<{ id: string; name: string; type: string; is_archived: boolean; parent_name: string | null; parent_archived: boolean | null }>(
      `SELECT c.id, c.name, c.type, c.is_archived, p.name as parent_name, p.is_archived as parent_archived
       FROM accounting_categories c
       LEFT JOIN accounting_categories p ON p.id = c.parent_id
       WHERE c.id = $1 AND c.workspace_id = $2
       LIMIT 1`,
      [rawCat, workspaceId]
    );
    if (catRes.rows.length === 0) {
      throw new Error("Selected category does not exist in this workspace.");
    }
    const cat = catRes.rows[0];
    if (cat.is_archived) {
      throw new Error(`Cannot set a budget for archived category "${cat.name}".`);
    }
    if (cat.parent_archived) {
      throw new Error(`Cannot set a budget for subcategory "${cat.name}" because its parent category is archived.`);
    }
    if (cat.type !== "EXPENSE") {
      throw new Error(`Budgets can only be set for Expense categories. Category "${cat.name}" is an ${cat.type} category.`);
    }
    categoryId = cat.id;
    categoryName = cat.name;
    parentCategoryName = cat.parent_name;
  }

  const periodType = input.periodType || "MONTHLY";
  const finalName = (input.name && input.name.trim()) || categoryName;
  const finalIcon = (input.icon && input.icon.trim()) || (categoryId ? "📊" : "💰");

  // 4. Duplicate prevention & double-submit idempotency
  const dupRes = await pool.query<BudgetRow>(
    `SELECT * FROM accounting_budgets
     WHERE workspace_id = $1
       AND ((category_id IS NULL AND $2::uuid IS NULL) OR category_id = $2)
       AND period_start = $3
     LIMIT 1`,
    [workspaceId, categoryId, periodStart]
  );

  if (dupRes.rows.length > 0) {
    const existing = dupRes.rows[0];
    const ageSeconds = (Date.now() - new Date(existing.created_at).getTime()) / 1000;
    if (ageSeconds < 10 && Number(existing.amount_minor) === amountMinor) {
      return formatBudgetRecord({ ...existing, name: finalName, icon: finalIcon, category_name: categoryName, parent_category_name: parentCategoryName });
    }
    const monthLabel = periodStart.slice(0, 7);
    if (categoryId) {
      const displayLabel = parentCategoryName ? `${parentCategoryName} → ${categoryName}` : categoryName;
      throw new Error(`A budget for category "${displayLabel}" already exists for ${monthLabel}.`);
    } else {
      throw new Error(`An overall workspace budget already exists for ${monthLabel}.`);
    }
  }

  // 5. Insert budget
  const res = await pool.query<BudgetRow>(
    `INSERT INTO accounting_budgets
       (workspace_id, category_id, name, icon, period_type, period_start, period_end, amount_minor, alert_threshold_percent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      workspaceId,
      categoryId,
      finalName,
      finalIcon,
      periodType,
      periodStart,
      periodEnd,
      amountMinor,
      input.alertThresholdPercent || 80,
    ]
  );

  return formatBudgetRecord({ ...res.rows[0], name: finalName, icon: finalIcon, category_name: categoryName, parent_category_name: parentCategoryName, transaction_count: 0 });
}

export async function listBudgets(workspaceId: string, month?: string): Promise<BudgetRow[]> {
  let query = `
    SELECT b.*, c.name as category_name, p.name as parent_category_name
    FROM accounting_budgets b
    LEFT JOIN accounting_categories c ON c.id = b.category_id
    LEFT JOIN accounting_categories p ON p.id = c.parent_id
    WHERE b.workspace_id = $1
  `;
  const params: unknown[] = [workspaceId];

  if (month && MONTH_REGEX.test(month.trim())) {
    const range = getMonthDateRange(month);
    params.push(range.periodStart, range.periodEnd);
    query += ` AND b.period_start <= $3 AND b.period_end >= $2`;
  }

  query += ` ORDER BY b.period_start DESC, b.created_at DESC`;

  const res = await pool.query<BudgetRow>(query, params);

  // Dynamically recalculate spent and transaction_count for each budget in its period
  const refreshed: BudgetRow[] = [];
  for (const b of res.rows) {
    let spentQuery = `
      SELECT COALESCE(SUM(amount_minor), 0) as spent, COUNT(*)::int as tx_count
      FROM accounting_transactions
      WHERE workspace_id = $1
        AND type = 'EXPENSE'
        AND status = 'POSTED'
        AND date >= $2
        AND date <= $3
    `;
    const startDate = formatPeriodDate(b.period_start);
    const endDate = formatPeriodDate(b.period_end);
    const queryParams: unknown[] = [workspaceId, startDate, endDate];

    if (b.category_id) {
      queryParams.push(b.category_id);
      spentQuery += ` AND category_id IN (
        SELECT id FROM accounting_categories WHERE id = $${queryParams.length} OR parent_id = $${queryParams.length}
      )`;
    }

    const spentRes = await pool.query<{ spent: string; tx_count: number }>(spentQuery, queryParams);
    const spentMinor = parseInt(spentRes.rows[0]?.spent || "0", 10);
    const txCount = Number(spentRes.rows[0]?.tx_count || 0);

    if (spentMinor !== Number(b.spent_minor)) {
      await pool.query(
        `UPDATE accounting_budgets SET spent_minor = $1, updated_at = NOW() WHERE id = $2`,
        [spentMinor, b.id]
      );
    }
    refreshed.push(formatBudgetRecord({ ...b, spent_minor: spentMinor, transaction_count: txCount }));
  }

  return refreshed;
}

export async function getBudgetDetails(
  workspaceId: string,
  budgetId: string
): Promise<{ budget: any; transactions: any[] } | null> {
  const query = `
    SELECT b.*, c.name as category_name, p.name as parent_category_name
    FROM accounting_budgets b
    LEFT JOIN accounting_categories c ON c.id = b.category_id
    LEFT JOIN accounting_categories p ON p.id = c.parent_id
    WHERE b.id = $1 AND b.workspace_id = $2
    LIMIT 1
  `;
  const res = await pool.query(query, [budgetId, workspaceId]);
  if (res.rows.length === 0) return null;

  const b = res.rows[0];
  const startDate = formatPeriodDate(b.period_start);
  const endDate = formatPeriodDate(b.period_end);

  // Fetch all matching expense transactions
  let txQuery = `
    SELECT t.*, c.name as category_name, p.name as parent_category_name,
           fa.name as account_name, ct.name as contact_name
    FROM accounting_transactions t
    LEFT JOIN accounting_categories c ON c.id = t.category_id
    LEFT JOIN accounting_categories p ON p.id = c.parent_id
    LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
    LEFT JOIN accounting_contacts ct ON ct.id = t.contact_id
    WHERE t.workspace_id = $1
      AND t.type = 'EXPENSE'
      AND t.status = 'POSTED'
      AND t.date >= $2
      AND t.date <= $3
  `;
  const txParams: unknown[] = [workspaceId, startDate, endDate];

  if (b.category_id) {
    txParams.push(b.category_id);
    txQuery += ` AND t.category_id IN (
      SELECT id FROM accounting_categories WHERE id = $${txParams.length} OR parent_id = $${txParams.length}
    )`;
  }

  txQuery += ` ORDER BY t.date DESC, t.created_at DESC`;

  const txRes = await pool.query(txQuery, txParams);
  const matchingTransactions = txRes.rows;

  const spentMinor = matchingTransactions.reduce((acc, t) => acc + Number(t.amount_minor), 0);
  const txCount = matchingTransactions.length;

  if (spentMinor !== Number(b.spent_minor)) {
    await pool.query(
      `UPDATE accounting_budgets SET spent_minor = $1, updated_at = NOW() WHERE id = $2`,
      [spentMinor, b.id]
    );
  }

  const formattedBudget = formatBudgetRecord({
    ...b,
    spent_minor: spentMinor,
    transaction_count: txCount,
  });

  return {
    budget: formattedBudget,
    transactions: matchingTransactions,
  };
}

export async function updateBudget(
  workspaceId: string,
  budgetId: string,
  input: {
    name?: string;
    icon?: string;
    amountMinor?: number;
    alertThresholdPercent?: number;
  }
): Promise<any> {
  const fields: string[] = [];
  const params: unknown[] = [budgetId, workspaceId];

  if (input.name !== undefined) {
    params.push(input.name.trim() || null);
    fields.push(`name = $${params.length}`);
  }

  if (input.icon !== undefined) {
    params.push(input.icon.trim() || null);
    fields.push(`icon = $${params.length}`);
  }

  if (input.amountMinor !== undefined) {
    const amt = Math.round(Number(input.amountMinor));
    if (isNaN(amt) || amt <= 0) {
      throw new Error("Budget limit must be greater than zero.");
    }
    params.push(amt);
    fields.push(`amount_minor = $${params.length}`);
  }

  if (input.alertThresholdPercent !== undefined) {
    params.push(input.alertThresholdPercent);
    fields.push(`alert_threshold_percent = $${params.length}`);
  }

  if (fields.length === 0) {
    throw new Error("No fields provided to update.");
  }

  fields.push(`updated_at = NOW()`);

  const updateQuery = `
    UPDATE accounting_budgets
    SET ${fields.join(", ")}
    WHERE id = $1 AND workspace_id = $2
    RETURNING *
  `;
  const res = await pool.query(updateQuery, params);
  if (res.rows.length === 0) {
    throw new Error("Budget not found or unauthorized.");
  }

  return formatBudgetRecord(res.rows[0]);
}

export async function deleteBudget(workspaceId: string, budgetId: string): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM accounting_budgets WHERE id = $1 AND workspace_id = $2`,
    [budgetId, workspaceId]
  );
  return (res.rowCount ?? 0) > 0;
}
