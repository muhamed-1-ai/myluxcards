import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getDashboardMetrics } from "@/lib/accounting/reports";
import type { PeriodFilter } from "@/lib/accounting/reports";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const period = (url.searchParams.get("period") as PeriodFilter["period"]) || "month";
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;

  const metrics = await getDashboardMetrics(context!.workspace.id, {
    period,
    startDate,
    endDate,
  });

  return NextResponse.json(metrics);
}
