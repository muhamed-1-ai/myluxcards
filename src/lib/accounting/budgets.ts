import "server-only";
import { pool } from "@/lib/db";
import type { BudgetRow } from "./types";

export interface CreateBudgetInput {
  workspaceId: string;
  categoryId?: string | null;
  periodType?: "MONTHLY" | "QUARTERLY" | "YEARLY";
  periodStart: string;
  periodEnd: string;
  amountMinor: number;
  alertThresholdPercent?: number;
}

export async function createBudget(input: CreateBudgetInput): Promise<BudgetRow> {
  if (input.amountMinor <= 0) throw new Error("Budget limit must be greater than zero.");

  const res = await pool.query<BudgetRow>(
    `INSERT INTO accounting_budgets
       (workspace_id, category_id, period_type, period_start, period_end, amount_minor, alert_threshold_percent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.workspaceId,
      input.categoryId || null,
      input.periodType || "MONTHLY",
      input.periodStart,
      input.periodEnd,
      input.amountMinor,
      input.alertThresholdPercent || 80,
    ]
  );
  return res.rows[0];
}

export async function listBudgets(workspaceId: string): Promise<BudgetRow[]> {
  const query = `
    SELECT b.*, c.name as category_name
    FROM accounting_budgets b
    LEFT JOIN accounting_categories c ON c.id = b.category_id
    WHERE b.workspace_id = $1
    ORDER BY b.period_start DESC
  `;
  const res = await pool.query<BudgetRow>(query, [workspaceId]);

  // Dynamically recalculate spent for each budget in its period
  const refreshed: BudgetRow[] = [];
  for (const b of res.rows) {
    let spentQuery = `
      SELECT COALESCE(SUM(amount_minor), 0) as spent
      FROM accounting_transactions
      WHERE workspace_id = $1
        AND type = 'EXPENSE'
        AND status = 'POSTED'
        AND date >= $2
        AND date <= $3
    `;
    const params: unknown[] = [workspaceId, b.period_start, b.period_end];

    if (b.category_id) {
      params.push(b.category_id);
      spentQuery += ` AND category_id = $4`;
    }

    const spentRes = await pool.query<{ spent: string }>(spentQuery, params);
    const spentMinor = parseInt(spentRes.rows[0]?.spent || "0", 10);

    if (spentMinor !== Number(b.spent_minor)) {
      await pool.query(
        `UPDATE accounting_budgets SET spent_minor = $1, updated_at = NOW() WHERE id = $2`,
        [spentMinor, b.id]
      );
    }
    refreshed.push({ ...b, spent_minor: spentMinor });
  }

  return refreshed;
}
