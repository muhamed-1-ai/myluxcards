import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { updateTransaction } from "@/lib/accounting/transactions";
import { pool } from "@/lib/db";
import type { UserTransactionRow } from "@/lib/accounting/types";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const transactionId = params.id;

  try {
    const res = await pool.query<UserTransactionRow>(
      `SELECT t.*, cat.name as category_name, parent_cat.name as parent_category_name,
              fa.name as account_name, c.name as contact_name
       FROM accounting_transactions t
       LEFT JOIN accounting_categories cat ON cat.id = t.category_id
       LEFT JOIN accounting_categories parent_cat ON parent_cat.id = cat.parent_id
       LEFT JOIN accounting_financial_accounts fa ON fa.id = t.financial_account_id
       LEFT JOIN accounting_contacts c ON c.id = t.contact_id
       WHERE t.id = $1 AND t.workspace_id = $2`,
      [transactionId, context!.workspace.id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    return NextResponse.json({ transaction: res.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch transaction" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const transactionId = params.id;

  try {
    const body = await req.json();
    const transaction = await updateTransaction(context!.workspace.id, transactionId, {
      categoryId: body.categoryId,
      date: body.date,
      notes: body.notes,
      tags: body.tags,
    });

    return NextResponse.json({ transaction });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update transaction" }, { status: 400 });
  }
}
