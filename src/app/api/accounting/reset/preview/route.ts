import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { previewResetImpact } from "@/lib/accounting/recovery";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  try {
    const preview = await previewResetImpact(context!.workspace.id);
    return NextResponse.json({
      success: true,
      preview,
      canReset: context!.workspace.role === "OWNER",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "RESET_PREVIEW_FAILED", message: err.message || "Failed to generate reset preview" },
      { status: 500 }
    );
  }
}
