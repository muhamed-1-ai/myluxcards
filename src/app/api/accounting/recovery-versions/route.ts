import { NextResponse } from "next/server";
import { requireAccountingApi } from "../authHelper";
import { listRecoveryVersions } from "@/lib/accounting/recovery";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "VIEWER");
  if (errorResponse) return errorResponse;

  try {
    const versions = await listRecoveryVersions(context!.workspace.id);
    return NextResponse.json({
      success: true,
      versions,
      canRestore: context!.workspace.role === "OWNER",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "LIST_VERSIONS_FAILED",
        message: err.message || "Failed to list accounting recovery versions",
      },
      { status: 500 }
    );
  }
}
