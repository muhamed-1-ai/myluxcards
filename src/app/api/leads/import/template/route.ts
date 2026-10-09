import { currentIdentity } from "@/lib/adminAuth";
import { getWorkspaceImportContext, STANDARD_IMPORT_FIELDS } from "@/lib/leads-import";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "xlsx").toLowerCase();

  try {
    const context = await getWorkspaceImportContext(identity.id);

    // Build headers list
    const headers: string[] = [];
    const sampleRow: Record<string, any> = {};

    // Standard fields
    STANDARD_IMPORT_FIELDS.forEach((f) => {
      headers.push(f.header);
      switch (f.key) {
        case "name": sampleRow[f.header] = "John Doe"; break;
        case "companyName": sampleRow[f.header] = "Acme Corp"; break;
        case "address": sampleRow[f.header] = "123 Business Way, Suite 100"; break;
        case "contactNumber": sampleRow[f.header] = "+91 98765 43210"; break;
        case "email": sampleRow[f.header] = "john.doe@acme.com"; break;
        case "assignedTo": sampleRow[f.header] = identity.email || "sales@zappit.com"; break;
        case "source": sampleRow[f.header] = "NFC Tap"; break;
        case "lifecycle": sampleRow[f.header] = "Lead"; break;
        case "stage": sampleRow[f.header] = "NEW"; break;
        case "lastRemark": sampleRow[f.header] = "Interested in smart NFC cards"; break;
        case "totalAmount": sampleRow[f.header] = 50000; break;
        case "advanceAmount": sampleRow[f.header] = 15000; break;
        case "balanceAmount": sampleRow[f.header] = 35000; break;
        case "paymentInformation": sampleRow[f.header] = "UPI / NetBanking"; break;
        case "products": sampleRow[f.header] = "Smart Executive Card"; break;
        case "nextFollowUpAt": sampleRow[f.header] = "2026-10-15"; break;
        case "nextFollowUpTime": sampleRow[f.header] = "10:00 AM"; break;
        case "nextFollowUpType": sampleRow[f.header] = "Call"; break;
        case "nextFollowUpNote": sampleRow[f.header] = "Discuss custom branding options"; break;
      }
    });

    // Dynamic fields from Master Configuration
    context.dynamicFields.forEach((df) => {
      headers.push(df.name);
      if (df.inputType === "NUMBER") sampleRow[df.name] = 100;
      else if (df.inputType === "DATE") sampleRow[df.name] = "2026-10-20";
      else sampleRow[df.name] = `Sample ${df.name}`;
    });

    if (format === "csv") {
      // Build CSV with BOM for Unicode/special character compatibility
      const sheetData = [headers, headers.map((h) => sampleRow[h] ?? "")];
      const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      const bomCsv = "\uFEFF" + csvOutput;

      return new Response(bomCsv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="zappit_leads_import_template.csv"`,
        },
      });
    }

    // Excel workbook creation (.xlsx)
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Import Data
    const sheetData = [headers, headers.map((h) => sampleRow[h] ?? "")];
    const dataSheet = XLSX.utils.aoa_to_sheet(sheetData);

    // Freeze header row
    dataSheet["!views"] = [{ state: "frozen", xSplit: 0, ySplit: 1, activeCell: "A2" }];

    // Auto-fit column widths
    const colWidths = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
    dataSheet["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(workbook, dataSheet, "Leads Import");

    // Sheet 2: Instructions & Reference
    const instructionHeaders = ["Field Name", "Group", "Expected Format / Values", "Description"];
    const instructionRows = STANDARD_IMPORT_FIELDS.map((f) => [
      f.header,
      f.group.toUpperCase(),
      f.key === "nextFollowUpAt"
        ? "YYYY-MM-DD (e.g. 2026-10-15)"
        : f.key === "nextFollowUpType"
        ? "Call, Meeting, Email, WhatsApp, Demo"
        : f.key === "stage"
        ? "NEW, CONTACTED, INTERESTED, PROPOSAL, WON, LOST"
        : "Text / Number",
      f.description || "",
    ]);

    context.dynamicFields.forEach((df) => {
      instructionRows.push([
        df.name,
        "DYNAMIC FIELD (MASTER CONFIG)",
        df.inputType,
        `Custom field configured in Master Configuration (${df.name})`,
      ]);
    });

    const instructionSheet = XLSX.utils.aoa_to_sheet([instructionHeaders, ...instructionRows]);
    instructionSheet["!cols"] = [
      { wch: 26 },
      { wch: 22 },
      { wch: 35 },
      { wch: 45 },
    ];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instructions");

    const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new Response(xlsxBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="zappit_leads_import_template.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("[Template Download GET Error]", error);
    return Response.json({ message: error.message || "Failed to generate import template." }, { status: 500 });
  }
}
