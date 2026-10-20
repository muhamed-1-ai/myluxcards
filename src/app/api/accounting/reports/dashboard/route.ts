import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { getDashboardMetrics } from "@/lib/accounting/reports";
import type { PeriodFilter } from "@/lib/accounting/reports";

const VALID_PERIODS = new Set(["today", "week", "month", "year", "all", "custom"]);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  try {
    const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
    if (errorResponse) return errorResponse;

    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");
    const startDate = url.searchParams.get("startDate") || undefined;
    const endDate = url.searchParams.get("endDate") || undefined;

    if (periodParam && !VALID_PERIODS.has(periodParam)) {
      return NextResponse.json(
        {
          error: "INVALID_PERIOD",
          message: "Invalid period parameter. Must be one of: today, week, month, year, all, custom.",
        },
        { status: 400 }
      );
    }

    if (startDate && (!DATE_REGEX.test(startDate) || isNaN(Date.parse(startDate)))) {
      return NextResponse.json(
        { error: "INVALID_START_DATE", message: "startDate must be a valid date in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    if (endDate && (!DATE_REGEX.test(endDate) || isNaN(Date.parse(endDate)))) {
      return NextResponse.json(
        { error: "INVALID_END_DATE", message: "endDate must be a valid date in YYYY-MM-DD format." },
        { status: 400 }
      );
    }

    const period = (periodParam as PeriodFilter["period"]) || "month";

    const metrics = await getDashboardMetrics(context!.workspace.id, {
      period,
      startDate,
      endDate,
    });

    return NextResponse.json(metrics);
  } catch (err: unknown) {
    console.error("[Accounting Dashboard API] Unexpected error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to load dashboard metrics.",
      },
      { status: 500 }
    );
  }
}
