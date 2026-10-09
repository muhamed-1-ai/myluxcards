import { currentIdentity } from "@/lib/adminAuth";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const errors = body.errors || [];
    const fileName = body.fileName || "leads_import";

    if (!Array.isArray(errors) || errors.length === 0) {
      return Response.json({ message: "No validation errors to generate report." }, { status: 400 });
    }

    const reportHeaders = ["Row Number", "Field Name", "Original Submitted Value", "Validation Error Message"];
    const reportRows = errors.map((e: any) => [
      e.row || "—",
      e.field || "—",
      e.value != null ? String(e.value) : "—",
      e.message || "Invalid data",
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([reportHeaders, ...reportRows]);
    worksheet["!cols"] = [{ wch: 14 }, { wch: 25 }, { wch: 30 }, { wch: 50 }];

    const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
    const bomCsv = "\uFEFF" + csvOutput;

    const exportFileName = `error_report_${fileName.replace(/[^a-z0-9_-]/gi, "_")}.csv`;

    return new Response(bomCsv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFileName}"`,
      },
    });
  } catch (error: any) {
    console.error("[Error Report Generation Error]", error);
    return Response.json({ message: error.message || "Failed to generate error report." }, { status: 500 });
  }
}
