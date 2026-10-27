import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { executeRestore } from "@/lib/accounting/recovery";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  // Strictly enforce OWNER role
  const { errorResponse, context } = await requireAccountingApi(req, "OWNER");
  if (errorResponse) return errorResponse;

  const params = await props.params;
  const versionId = params.id;

  if (!versionId) {
    return NextResponse.json(
      { error: "VERSION_ID_REQUIRED", message: "Recovery version identifier required" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { confirmed } = body;

    if (confirmed !== true) {
      return NextResponse.json(
        {
          error: "CONFIRMATION_REQUIRED",
          message: "Explicit confirmation required to restore Accounting data.",
        },
        { status: 400 }
      );
    }

    const restoreResult = await executeRestore(
      context!.workspace.id,
      versionId,
      context!.identity.id
    );

    return NextResponse.json({
      success: true,
      message: "Accounting workspace data has been restored successfully.",
      restoredVersionId: restoreResult.restoredVersionId,
      preRestoreBackupId: restoreResult.preRestoreBackupId,
      financialSummary: restoreResult.financialSummary,
    });
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404 : 400;
    return NextResponse.json(
      {
        error: "RESTORE_EXECUTION_FAILED",
        message: err.message || "Failed to execute accounting restore",
      },
      { status }
    );
  }
}
