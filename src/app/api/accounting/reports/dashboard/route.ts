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
    const categoryId = url.searchParams.get("categoryId") || undefined;
    const subcategoryId = url.searchParams.get("subcategoryId") || undefined;

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

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      categoryId &&
      categoryId !== "all" &&
      categoryId !== "uncategorized" &&
      !UUID_REGEX.test(categoryId)
    ) {
      return NextResponse.json(
        {
          error: "INVALID_CATEGORY_ID",
          message: "categoryId must be a valid UUID, 'all', or 'uncategorized'.",
        },
        { status: 400 }
      );
    }

    if (
      subcategoryId &&
      subcategoryId !== "all" &&
      !UUID_REGEX.test(subcategoryId)
    ) {
      return NextResponse.json(
        {
          error: "INVALID_SUBCATEGORY_ID",
          message: "subcategoryId must be a valid UUID or 'all'.",
        },
        { status: 400 }
      );
    }

    if ((!categoryId || categoryId === "all") && subcategoryId && subcategoryId !== "all") {
      return NextResponse.json(
        {
          error: "INVALID_FILTER_COMBINATION",
          message: "A main category must be selected to filter by subcategory.",
        },
        { status: 400 }
      );
    }

    if (categoryId === "uncategorized" && subcategoryId && subcategoryId !== "all") {
      return NextResponse.json(
        {
          error: "INVALID_FILTER_COMBINATION",
          message: "Subcategories are not applicable for uncategorized transactions.",
        },
        { status: 400 }
      );
    }

    const period = (periodParam as PeriodFilter["period"]) || "month";

    const metrics = await getDashboardMetrics(context!.workspace.id, {
      period,
      startDate,
      endDate,
      categoryId,
      subcategoryId,
    });

    return NextResponse.json(metrics);
  } catch (err: any) {
    if (err && typeof err === "object" && typeof err.statusCode === "number") {
      return NextResponse.json(
        {
          error: err.name || "VALIDATION_ERROR",
          message: err.message,
        },
        { status: err.statusCode }
      );
    }

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
