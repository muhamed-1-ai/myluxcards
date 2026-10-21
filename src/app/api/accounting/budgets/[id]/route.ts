import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getBudgetDetails, updateBudget, deleteBudget } from "@/lib/accounting/budgets";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const budgetId = params.id;

  try {
    const details = await getBudgetDetails(context!.workspace.id, budgetId);
    if (!details) {
      return NextResponse.json({ error: "Budget not found" }, { status: 404 });
    }
    return NextResponse.json(details);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load budget details" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const budgetId = params.id;

  try {
    const body = await req.json();
    const updated = await updateBudget(context!.workspace.id, budgetId, {
      name: body.name,
      icon: body.icon,
      amountMinor: body.amountMinor,
      alertThresholdPercent: body.alertThresholdPercent,
    });
    return NextResponse.json({ budget: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update budget" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const budgetId = params.id;

  try {
    const ok = await deleteBudget(context!.workspace.id, budgetId);
    if (!ok) {
      return NextResponse.json({ error: "Budget not found or already deleted" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete budget" }, { status: 500 });
  }
}
