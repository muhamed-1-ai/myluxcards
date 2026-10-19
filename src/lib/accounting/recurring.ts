import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { RecurringRuleRow } from "./types";
import { createTransaction } from "./transactions";

export interface CreateRecurringRuleInput {
  workspaceId: string;
  title: string;
  type: "INCOME" | "EXPENSE" | "BILL" | "SALARY" | "SUBSCRIPTION";
  categoryId?: string | null;
  amountMinor: number;
  frequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  nextDueDate: string;
  financialAccountId?: string | null;
  autoPost?: boolean;
}

export function advanceDateByFrequency(dateStr: string, frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"): string {
  const d = new Date(dateStr);
  if (frequency === "DAILY") d.setDate(d.getDate() + 1);
  else if (frequency === "WEEKLY") d.setDate(d.getDate() + 7);
  else if (frequency === "MONTHLY") d.setMonth(d.getMonth() + 1);
  else if (frequency === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export async function createRecurringRule(input: CreateRecurringRuleInput): Promise<RecurringRuleRow> {
  if (input.amountMinor <= 0) throw new Error("Amount must be greater than zero.");

  const res = await pool.query<RecurringRuleRow>(
    `INSERT INTO accounting_recurring_rules
       (workspace_id, title, type, category_id, amount_minor, frequency, next_due_date, financial_account_id, auto_post, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')
     RETURNING *`,
    [
      input.workspaceId,
      input.title.trim(),
      input.type,
      input.categoryId || null,
      input.amountMinor,
      input.frequency || "MONTHLY",
      input.nextDueDate,
      input.financialAccountId || null,
      Boolean(input.autoPost),
    ]
  );
  return res.rows[0];
}

export async function listRecurringRules(workspaceId: string): Promise<RecurringRuleRow[]> {
  const query = `
    SELECT r.*, c.name as category_name
    FROM accounting_recurring_rules r
    LEFT JOIN accounting_categories c ON c.id = r.category_id
    WHERE r.workspace_id = $1
    ORDER BY r.next_due_date ASC
  `;
  const res = await pool.query<RecurringRuleRow>(query, [workspaceId]);
  return res.rows;
}

/**
 * Execute an instance of a recurring rule upon user confirmation.
 * Posts transaction and advances next_due_date.
 */
export async function executeRecurringRule(
  workspaceId: string,
  ruleId: string,
  financialAccountId: string,
  userId?: string
): Promise<{ success: boolean; nextDueDate: string }> {
  return withTransaction(async (client) => {
    const ruleRes = await client.query<RecurringRuleRow>(
      `SELECT * FROM accounting_recurring_rules WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [ruleId, workspaceId]
    );
    const rule = ruleRes.rows[0];
    if (!rule) throw new Error("Recurring rule not found.");

    const txType = rule.type === "INCOME" ? "INCOME" : "EXPENSE";

    // 1. Post transaction
    await createTransaction(
      {
        workspaceId,
        type: txType,
        amountMinor: Number(rule.amount_minor),
        date: rule.next_due_date,
        categoryId: rule.category_id,
        financialAccountId,
        notes: `Recurring: ${rule.title}`,
        isRecurring: true,
        userId,
      },
      client
    );

    // 2. Advance next due date
    const nextDate = advanceDateByFrequency(rule.next_due_date, rule.frequency);

    await client.query(
      `UPDATE accounting_recurring_rules
       SET next_due_date = $1, updated_at = NOW()
       WHERE id = $2`,
      [nextDate, rule.id]
    );

    return { success: true, nextDueDate: nextDate };
  });
}
