import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getReceivablesAging } from "@/lib/accounting/reports";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const aging = await getReceivablesAging(context!.workspace.id);
  return NextResponse.json({ aging });
}
