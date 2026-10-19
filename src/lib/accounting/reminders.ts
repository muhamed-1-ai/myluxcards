import "server-only";
import { pool } from "@/lib/db";
import type { ReminderRow } from "./types";

export interface CreateReminderInput {
  workspaceId: string;
  userId: string;
  title: string;
  description?: string | null;
  type: "INVOICE_DUE" | "BILL_DUE" | "LOAN_EMI" | "BUDGET_EXCEEDED" | "CUSTOM";
  dueDate: string;
  entityType?: string | null;
  entityId?: string | null;
}

export async function createReminder(input: CreateReminderInput): Promise<ReminderRow> {
  const res = await pool.query<ReminderRow>(
    `INSERT INTO accounting_reminders
       (workspace_id, user_id, title, description, type, due_date, entity_type, entity_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
     RETURNING *`,
    [
      input.workspaceId,
      input.userId,
      input.title.trim(),
      input.description || null,
      input.type,
      input.dueDate,
      input.entityType || null,
      input.entityId || null,
    ]
  );
  return res.rows[0];
}

export async function listReminders(
  workspaceId: string,
  options?: { onlyPending?: boolean }
): Promise<ReminderRow[]> {
  let sql = `SELECT * FROM accounting_reminders WHERE workspace_id = $1`;
  const params: unknown[] = [workspaceId];

  if (options?.onlyPending !== false) {
    sql += ` AND status = 'PENDING'`;
  }

  sql += ` ORDER BY due_date ASC, created_at DESC`;
  const res = await pool.query<ReminderRow>(sql, params);
  return res.rows;
}

export async function dismissReminder(workspaceId: string, reminderId: string): Promise<ReminderRow> {
  const res = await pool.query<ReminderRow>(
    `UPDATE accounting_reminders
     SET status = 'DISMISSED', dismissed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING *`,
    [reminderId, workspaceId]
  );
  if (!res.rows[0]) throw new Error("Reminder not found.");
  return res.rows[0];
}
