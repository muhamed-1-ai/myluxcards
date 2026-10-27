import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../../authHelper";
import { previewRestoreImpact } from "@/lib/accounting/recovery";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
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
    const preview = await previewRestoreImpact(context!.workspace.id, versionId);
    return NextResponse.json({
      success: true,
      preview,
      canRestore: context!.workspace.role === "OWNER" && preview.canRestore,
    });
  } catch (err: any) {
    const status = err.message?.includes("not found") ? 404 : 500;
    return NextResponse.json(
      {
        error: "RESTORE_PREVIEW_FAILED",
        message: err.message || "Failed to generate restore preview",
      },
      { status }
    );
  }
}
