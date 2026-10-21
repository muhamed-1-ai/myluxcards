import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listBudgets, createBudget } from "@/lib/accounting/budgets";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const budgets = await listBudgets(context!.workspace.id);
  return NextResponse.json({ budgets });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const budget = await createBudget({
      workspaceId: context!.workspace.id,
      categoryId: body.categoryId,
      periodType: body.periodType,
      month: body.month,
      periodStart: body.periodStart || body.startDate,
      periodEnd: body.periodEnd || body.endDate,
      amountMinor: body.amountMinor,
      alertThresholdPercent: body.alertThresholdPercent,
    });
    return NextResponse.json({ budget }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create budget" }, { status: 400 });
  }
}
