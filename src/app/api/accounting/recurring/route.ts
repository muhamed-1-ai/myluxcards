import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listRecurringRules, createRecurringRule } from "@/lib/accounting/recurring";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const rules = await listRecurringRules(context!.workspace.id);
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const rule = await createRecurringRule({
      workspaceId: context!.workspace.id,
      title: body.title,
      type: body.type,
      categoryId: body.categoryId,
      amountMinor: body.amountMinor,
      frequency: body.frequency,
      nextDueDate: body.nextDueDate,
      financialAccountId: body.financialAccountId,
      autoPost: body.autoPost,
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create recurring rule" }, { status: 400 });
  }
}
