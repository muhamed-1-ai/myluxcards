import { NextResponse } from "next/server";
import { requireAccountingApi } from "../../authHelper";
import { generateTransactionsExport } from "@/lib/accounting/reports";

export async function GET(req: Request) {
  const { errorResponse, context } = await requireAccountingApi(req, "MANAGER");
  if (errorResponse) return errorResponse;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const { buffer, filename, contentType } = await generateTransactionsExport(context!.workspace.id, format);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
