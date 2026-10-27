import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { executeCompleteReset } from "@/lib/accounting/recovery";

export async function POST(req: Request) {
  // Strictly enforce OWNER role
  const { errorResponse, context } = await requireAccountingApi(req, "OWNER");
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json().catch(() => ({}));
    const { confirmed, reason } = body;

    if (confirmed !== true) {
      return NextResponse.json(
        {
          error: "CONFIRMATION_REQUIRED",
          message: "Explicit confirmation required to reset Accounting data.",
        },
        { status: 400 }
      );
    }

    const resetResult = await executeCompleteReset(
      context!.workspace.id,
      context!.identity.id,
      typeof reason === "string" && reason.trim() ? reason.trim() : undefined
    );

    return NextResponse.json({
      success: true,
      message: "Accounting workspace has been reset successfully. A reversible recovery version has been archived.",
      recoveryVersionId: resetResult.recoveryVersionId,
      versionNumber: resetResult.versionNumber,
      recordCounts: resetResult.recordCounts,
      financialSummary: resetResult.financialSummary,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "RESET_EXECUTION_FAILED",
        message: err.message || "Failed to execute complete accounting reset",
      },
      { status: 500 }
    );
  }
}
