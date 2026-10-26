import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { updateTransaction, voidTransaction } from "@/lib/accounting/transactions";
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
              CASE
                WHEN parent_cat.id IS NOT NULL THEN parent_cat.name
                ELSE cat.name
              END as main_category_name,
              CASE
                WHEN parent_cat.id IS NOT NULL THEN cat.name
                ELSE NULL
              END as subcategory_name,
              fa.name as account_name, c.name as contact_name,
              COALESCE((
                SELECT COUNT(*)
                FROM accounting_transaction_attachments att
                WHERE att.transaction_id = t.id
              ), 0)::int as attachment_count
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

    const { getTransactionAttachments } = await import("@/lib/accounting/attachments");
    const attachments = await getTransactionAttachments(context!.workspace.id, transactionId);

    return NextResponse.json({
      transaction: {
        ...res.rows[0],
        attachment_count: attachments.length,
        attachments,
      },
    });
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
      mainCategoryId: body.mainCategoryId,
      subcategoryId: body.subcategoryId,
      date: body.date,
      notes: body.notes,
      tags: body.tags,
      attachmentIds: Array.isArray(body.attachmentIds) ? body.attachmentIds : undefined,
    });

    const { getTransactionAttachments } = await import("@/lib/accounting/attachments");
    const attachments = await getTransactionAttachments(context!.workspace.id, transactionId);

    return NextResponse.json({
      transaction: {
        ...transaction,
        attachment_count: attachments.length,
        attachments,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update transaction" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const transactionId = params.id;

  try {
    const url = new URL(req.url);
    const reason = url.searchParams.get("reason") || "Voided from budget details";
    const voided = await voidTransaction(
      context!.workspace.id,
      transactionId,
      reason,
      context!.identity.id
    );
    return NextResponse.json({ transaction: voided, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to void transaction" }, { status: 400 });
  }
}
