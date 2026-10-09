import { currentIdentity } from "@/lib/adminAuth";
import {
  getWorkspaceImportContext,
  normalizeHeader,
  STANDARD_IMPORT_FIELDS,
  validateImportRow,
  RowValidationResult,
  DynamicFieldDefinition,
} from "@/lib/leads-import";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return Response.json({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ success: false, error: "Please select a CSV or XLSX file to upload." }, { status: 400 });
    }

    const fileName = file.name || "leads_import";
    const lowerName = fileName.toLowerCase();
    if (!lowerName.endsWith(".csv") && !lowerName.endsWith(".xlsx")) {
      return Response.json({ success: false, error: "Unsupported file format. Please upload an official .csv or .xlsx template." }, { status: 400 });
    }

    // Max 10MB file size limit
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ success: false, error: "File size exceeds the 10MB limit." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Read spreadsheet using XLSX
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch (err) {
      return Response.json({ success: false, error: "This file could not be read. Please upload a valid Zappit CSV or XLSX spreadsheet." }, { status: 400 });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return Response.json({ success: false, error: "No worksheet found in file." }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

    if (!rawRows || rawRows.length === 0) {
      return Response.json({ success: false, error: "No lead data found in this file." }, { status: 400 });
    }

    // Load multi-tenant workspace context (owner user, workspace users, active dynamic fields)
    const context = await getWorkspaceImportContext(identity.id);

    // Extract headers from first row
    const firstRow = rawRows[0];
    const fileHeaders = Object.keys(firstRow);

    // Build Header Mapping: Map file headers to canonical standard fields or dynamic field definitions
    const headerMapping: Record<
      string,
      { type: "standard" | "dynamic"; key: string; def?: DynamicFieldDefinition }
    > = {};

    const unknownHeaders: string[] = [];
    const detectedStandardHeaders: string[] = [];
    const detectedDynamicHeaders: string[] = [];

    fileHeaders.forEach((rawH) => {
      const norm = normalizeHeader(rawH);
      if (!norm) return;

      // 1. Try matching standard field headers or aliases
      const matchStd = STANDARD_IMPORT_FIELDS.find(
        (sf) => normalizeHeader(sf.header) === norm || sf.aliases.some((a) => normalizeHeader(a) === norm)
      );

      if (matchStd) {
        headerMapping[rawH] = { type: "standard", key: matchStd.key };
        detectedStandardHeaders.push(matchStd.header);
        return;
      }

      // 2. Try matching active Dynamic Field definitions for workspace
      const matchDyn = context.dynamicFields.find(
        (df) => normalizeHeader(df.name) === norm || normalizeHeader(df.id) === norm
      );

      if (matchDyn) {
        headerMapping[rawH] = { type: "dynamic", key: matchDyn.id, def: matchDyn };
        detectedDynamicHeaders.push(matchDyn.name);
        return;
      }

      unknownHeaders.push(rawH);
    });

    // Validate row limit (max 5,000 rows per import)
    if (rawRows.length > 5000) {
      return Response.json({ success: false, error: "Maximum limit is 5,000 leads per import file." }, { status: 400 });
    }

    // Process & Validate Rows
    const rowResults: RowValidationResult[] = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    let emptyCount = 0;

    const allErrors: { row: number; field: string; message: string; value: any }[] = [];
    const allWarnings: { row: number; field: string; message: string; value: any }[] = [];

    // Include unknown header warning if any exist
    if (unknownHeaders.length > 0) {
      allWarnings.push({
        row: 1,
        field: "File Headers",
        message: `Unknown columns found: ${unknownHeaders.map((u) => `"${u}"`).join(", ")}. These columns will be ignored.`,
        value: unknownHeaders,
      });
    }

    rawRows.forEach((rowObj, index) => {
      const rowNum = index + 2; // Row 1 is header
      const res = validateImportRow(rowObj, rowNum, headerMapping, context);

      if (res.isEmpty) {
        emptyCount++;
        return;
      }

      if (res.isValid) {
        validCount++;
        if (res.warnings.length > 0) {
          warningCount++;
          res.warnings.forEach((w) => allWarnings.push({ row: rowNum, ...w }));
        }
      } else {
        errorCount++;
        res.errors.forEach((e) => allErrors.push({ row: rowNum, ...e }));
        res.warnings.forEach((w) => allWarnings.push({ row: rowNum, ...w }));
      }

      rowResults.push(res);
    });

    // Extract first 50 rows for frontend preview table
    const previewRows = rowResults.slice(0, 50).map((r) => ({
      rowNumber: r.rowNumber,
      isValid: r.isValid,
      errorsCount: r.errors.length,
      warningsCount: r.warnings.length,
      leadName: r.data.name || "—",
      contactNumber: r.data.contactNumber || "—",
      email: r.data.email || "—",
      companyName: r.data.companyName || "—",
      stage: r.data.stage || "—",
      assignedTo: r.data.assignedUserName || "—",
      nextFollowUpAt: r.data.nextFollowUpAt || "—",
      dynamicValues: r.data.dynamicValues,
      errorMessages: r.errors.map((e) => `${e.field}: ${e.message}`),
    }));

    // Retain full validated data in memory for commit payload
    const validRowsToCommit = rowResults.filter((r) => r.isValid).map((r) => r.data);

    return Response.json({
      success: true,
      fileName,
      totalRows: rawRows.length,
      validCount,
      warningCount,
      errorCount,
      emptyCount,
      columnsDetected: Object.keys(headerMapping),
      dynamicFieldsDetected: detectedDynamicHeaders,
      unknownHeaders,
      previewRows,
      errors: allErrors,
      warnings: allWarnings,
      validRows: validRowsToCommit,
    });
  } catch (error: any) {
    console.error("[Import Validation Error]", error);
    return Response.json({ success: false, error: error.message || "Failed to validate import spreadsheet." }, { status: 500 });
  }
}
