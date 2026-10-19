import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { executeRecurringRule } from "@/lib/accounting/recurring";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "STAFF");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const ruleId = params.id;

  try {
    const body = await req.json();
    if (!body.financialAccountId) {
      return NextResponse.json({ error: "financialAccountId required" }, { status: 400 });
    }

    const result = await executeRecurringRule(
      context!.workspace.id,
      ruleId,
      body.financialAccountId,
      context!.identity.id
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to execute recurring rule" }, { status: 400 });
  }
}
