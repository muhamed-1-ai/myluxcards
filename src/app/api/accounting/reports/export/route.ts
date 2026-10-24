import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { generateTransactionsExport } from "@/lib/accounting/reports";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const rawStatus = url.searchParams.get("status");
  const status = rawStatus === "VOIDED" ? "VOIDED" : "POSTED";
  const type = url.searchParams.get("type") || undefined;

  const { buffer, filename, contentType } = await generateTransactionsExport(
    context!.workspace.id,
    format,
    { status, type }
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
