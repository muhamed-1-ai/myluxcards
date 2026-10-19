import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listLoans, createLoan } from "@/lib/accounting/loans";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const loans = await listLoans(context!.workspace.id);
  return NextResponse.json({ loans });
}

export async function POST(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const result = await createLoan({
      workspaceId: context!.workspace.id,
      loanName: body.loanName,
      lenderContactId: body.lenderContactId,
      principalMinor: body.principalMinor,
      interestRatePercent: body.interestRatePercent,
      tenureMonths: body.tenureMonths,
      startDate: body.startDate,
      disbursementAccountId: body.disbursementAccountId,
      userId: context!.identity.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create loan" }, { status: 400 });
  }
}
