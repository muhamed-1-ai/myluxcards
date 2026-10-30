import type {
  InvoiceRow,
  InvoiceLineRow,
  SellerSnapshot,
  CustomerSnapshot,
  InvoicePaymentDetail,
} from "./types";

export interface InvoiceTemplateOptions {
  title?: string;
  isPublic?: boolean;
  showPrintButton?: boolean;
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(amountMinor: number | string | null | undefined, currency = "INR"): string {
  const num = Number(amountMinor ?? 0) / 100;
  if (isNaN(num)) {
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
    return `${symbol}0.00`;
  }
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency === "EUR" ? "€" : `${currency} `;
  return `${symbol}${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateInvoiceHtml(
  invoice: InvoiceRow & { direct_sale_number?: string },
  lines: InvoiceLineRow[],
  seller: SellerSnapshot,
  customer: CustomerSnapshot | null,
  payments: InvoicePaymentDetail[] = [],
  options: InvoiceTemplateOptions = {}
): string {
  const currency = invoice.currency || "INR";
  const isDraft = invoice.status === "DRAFT";
  const isVoid = invoice.status === "VOID";
  const isPaid = invoice.status === "PAID" || Number(invoice.amount_due_minor) === 0;
  const isPartial = invoice.status === "PARTIALLY_PAID";
  const isOverdue = invoice.status === "OVERDUE";

  const totalMinor = Number(invoice.total_minor);
  const paidMinor = Number(invoice.amount_paid_minor);
  const dueMinor = Number(invoice.amount_due_minor);

  // Status badge label and color
  let statusBadgeText: string = invoice.status;
  let statusBadgeColor = "#475569";
  let statusBadgeBg = "#f1f5f9";

  if (isDraft) {
    statusBadgeText = "DRAFT";
    statusBadgeColor = "#64748b";
    statusBadgeBg = "#f8fafc";
  } else if (isVoid) {
    statusBadgeText = "VOIDED";
    statusBadgeColor = "#dc2626";
    statusBadgeBg = "#fef2f2";
  } else if (isPaid) {
    statusBadgeText = "PAID IN FULL";
    statusBadgeColor = "#16a34a";
    statusBadgeBg = "#f0fdf4";
  } else if (isPartial) {
    statusBadgeText = "PARTIALLY PAID";
    statusBadgeColor = "#d97706";
    statusBadgeBg = "#fffbeb";
  } else if (isOverdue) {
    statusBadgeText = "OVERDUE";
    statusBadgeColor = "#dc2626";
    statusBadgeBg = "#fef2f2";
  } else {
    statusBadgeText = "ISSUED";
    statusBadgeColor = "#2563eb";
    statusBadgeBg = "#eff6ff";
  }

  const showPrintBar = options.showPrintButton !== false;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(invoice.invoice_number)} - ${escapeHtml(seller.business_name || "Invoice")}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 14mm 14mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      font-size: 13px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* Print Controls Bar */
    .no-print-bar {
      background: #0f172a;
      color: #fff;
      padding: 0.75rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .no-print-bar .title {
      font-weight: 600;
      font-size: 0.95rem;
      letter-spacing: -0.01em;
    }
    .no-print-bar .actions {
      display: flex;
      gap: 0.5rem;
    }
    .no-print-bar button {
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      transition: background 0.15s ease;
    }
    .no-print-bar button:hover {
      background: #1d4ed8;
    }
    .no-print-bar button.secondary {
      background: #334155;
    }
    .no-print-bar button.secondary:hover {
      background: #475569;
    }

    /* Document Sheet Container */
    .document-wrapper {
      max-width: 820px;
      margin: 2rem auto;
      background: #ffffff;
      padding: 2.5rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      border-radius: 8px;
      position: relative;
    }

    /* Watermark for Draft or Void */
    .watermark {
      position: absolute;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 7rem;
      font-weight: 900;
      color: rgba(148, 163, 184, 0.12);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      pointer-events: none;
      z-index: 1;
      white-space: nowrap;
    }
    .watermark.void {
      color: rgba(239, 68, 68, 0.12);
    }

    /* Header Layout */
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 1.5rem;
      margin-bottom: 1.75rem;
      position: relative;
      z-index: 2;
    }
    .seller-branding {
      max-width: 58%;
    }
    .seller-logo {
      max-height: 60px;
      max-width: 200px;
      object-fit: contain;
      margin-bottom: 0.75rem;
      display: block;
    }
    .business-name {
      font-size: 1.35rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin-bottom: 0.35rem;
    }
    .business-meta {
      color: #475569;
      font-size: 0.825rem;
      line-height: 1.45;
      white-space: pre-line;
    }
    .business-tax {
      margin-top: 0.4rem;
      font-weight: 600;
      color: #334155;
      font-size: 0.825rem;
    }

    .invoice-meta-box {
      text-align: right;
      max-width: 40%;
    }
    .doc-type-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: #1e293b;
      letter-spacing: -0.03em;
      text-transform: uppercase;
    }
    .invoice-number {
      font-size: 1.05rem;
      font-weight: 700;
      color: #2563eb;
      margin-top: 0.15rem;
      letter-spacing: -0.01em;
    }
    .status-badge {
      display: inline-block;
      margin-top: 0.5rem;
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border: 1px solid currentColor;
    }

    /* Billing & Dates Grid */
    .info-grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 1.75rem;
      position: relative;
      z-index: 2;
    }
    .billed-to {
      max-width: 55%;
    }
    .info-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.05em;
      margin-bottom: 0.35rem;
    }
    .customer-name {
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 0.25rem;
    }
    .customer-meta {
      font-size: 0.825rem;
      color: #475569;
      line-height: 1.45;
      white-space: pre-line;
    }

    .dates-table {
      text-align: right;
    }
    .dates-table .date-row {
      margin-bottom: 0.4rem;
    }
    .dates-table .date-val {
      font-weight: 600;
      color: #0f172a;
      font-size: 0.875rem;
    }

    /* Items Table */
    .table-container {
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 2;
    }
    table.invoice-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    table.invoice-table thead {
      display: table-header-group;
    }
    table.invoice-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.725rem;
      letter-spacing: 0.04em;
      padding: 0.65rem 0.75rem;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
    }
    table.invoice-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    table.invoice-table tr {
      page-break-inside: avoid;
    }
    .align-right {
      text-align: right;
    }
    .align-center {
      text-align: center;
    }
    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }

    .item-desc {
      font-weight: 600;
      color: #0f172a;
      font-size: 0.875rem;
    }
    .item-subtext {
      font-size: 0.775rem;
      color: #64748b;
      margin-top: 0.2rem;
    }

    /* Warranty Box inside Item */
    .warranty-callout {
      margin-top: 0.45rem;
      padding: 0.4rem 0.6rem;
      background: #f8fafc;
      border-left: 3px solid #2563eb;
      border-radius: 0 4px 4px 0;
      font-size: 0.75rem;
      color: #334155;
    }
    .warranty-title {
      font-weight: 700;
      color: #1e40af;
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .warranty-detail {
      margin-top: 0.2rem;
      color: #475569;
    }

    /* Financial Summary Box */
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 2rem;
      page-break-inside: avoid;
      position: relative;
      z-index: 2;
    }
    .totals-box {
      width: 320px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem 1.25rem;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.4rem;
      font-size: 0.85rem;
      color: #475569;
    }
    .totals-row.grand-total {
      font-size: 1.05rem;
      font-weight: 800;
      color: #0f172a;
      border-top: 2px solid #cbd5e1;
      padding-top: 0.5rem;
      margin-top: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .totals-row.paid {
      color: #16a34a;
      font-weight: 600;
    }
    .totals-row.balance {
      font-size: 0.95rem;
      font-weight: 800;
      border-top: 1px dashed #cbd5e1;
      padding-top: 0.5rem;
      margin-top: 0.4rem;
      color: ${dueMinor > 0 ? "#dc2626" : "#16a34a"};
    }

    /* Terms, Notes & Warranty Section */
    .bottom-section {
      page-break-inside: avoid;
      margin-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      padding-top: 1.25rem;
      font-size: 0.825rem;
      color: #475569;
      position: relative;
      z-index: 2;
    }
    .notes-block {
      margin-bottom: 1rem;
    }
    .notes-block h4 {
      font-size: 0.775rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #334155;
      margin-bottom: 0.25rem;
    }
    .notes-block p {
      white-space: pre-wrap;
      line-height: 1.45;
    }

    /* Payment History Box */
    .payments-history-block {
      margin-top: 1.5rem;
      page-break-inside: avoid;
    }
    .payments-history-block table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      margin-top: 0.4rem;
    }
    .payments-history-block th {
      background: #f1f5f9;
      color: #475569;
      text-align: left;
      padding: 0.4rem 0.5rem;
      font-weight: 600;
    }
    .payments-history-block td {
      padding: 0.4rem 0.5rem;
      border-bottom: 1px solid #e2e8f0;
    }

    /* Print Specific Rules */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
      }
      .no-print, .no-print-bar {
        display: none !important;
      }
      .document-wrapper {
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        max-width: 100% !important;
        border-radius: 0 !important;
      }
      .header-section {
        border-bottom: 2px solid #000000 !important;
      }
      table.invoice-table th {
        background: #f1f5f9 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .totals-box {
        background: #ffffff !important;
        border: 1px solid #94a3b8 !important;
      }
      .warranty-callout {
        background: #f8fafc !important;
        border-left: 3px solid #2563eb !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .status-badge {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${
    showPrintBar
      ? `<div class="no-print-bar no-print">
          <div class="title">
            📄 ${escapeHtml(invoice.invoice_number)} &bull; ${escapeHtml(seller.business_name || "Invoice")}
          </div>
          <div class="actions">
            <button onclick="window.print()" title="Print this invoice or Save as PDF">
              🖨️ Print / Save as PDF
            </button>
            <button class="secondary" onclick="window.close()" title="Close document preview">
              ✕ Close
            </button>
          </div>
        </div>`
      : ""
  }

  <div class="document-wrapper">
    ${isDraft ? `<div class="watermark">DRAFT</div>` : ""}
    ${isVoid ? `<div class="watermark void">VOID</div>` : ""}

    <!-- Header & Branding -->
    <div class="header-section">
      <div class="seller-branding">
        ${
          seller.logo_url
            ? `<img src="${escapeHtml(seller.logo_url)}" alt="${escapeHtml(seller.business_name || "Logo")}" class="seller-logo" />`
            : ""
        }
        <h1 class="business-name">${escapeHtml(seller.business_name || "Business Name")}</h1>
        <div class="business-meta">
          ${seller.address ? escapeHtml(seller.address) + "<br/>" : ""}
          ${seller.phone ? "Phone: " + escapeHtml(seller.phone) + "<br/>" : ""}
          ${seller.email ? "Email: " + escapeHtml(seller.email) + "<br/>" : ""}
          ${seller.website ? "Website: " + escapeHtml(seller.website) : ""}
        </div>
        ${
          seller.tax_id
            ? `<div class="business-tax">${escapeHtml(seller.tax_label || "GSTIN")}: ${escapeHtml(seller.tax_id)}</div>`
            : ""
        }
      </div>

      <div class="invoice-meta-box">
        <div class="doc-type-title">INVOICE</div>
        <div class="invoice-number">${escapeHtml(invoice.invoice_number)}</div>
        ${
          invoice.direct_sale_number
            ? `<div style="font-size: 0.775rem; color: #64748b; margin-top: 0.2rem;">Ref: Direct Sale ${escapeHtml(invoice.direct_sale_number)}</div>`
            : ""
        }
        <div>
          <span class="status-badge" style="color: ${statusBadgeColor}; background: ${statusBadgeBg};">
            ${statusBadgeText}
          </span>
        </div>
      </div>
    </div>

    <!-- Billed To & Dates -->
    <div class="info-grid">
      <div class="billed-to">
        <div class="info-label">Billed To</div>
        <div class="customer-name">${escapeHtml(customer?.name || invoice.contact_name || "Direct Customer")}</div>
        <div class="customer-meta">
          ${customer?.address || invoice.contact_address ? escapeHtml(customer?.address || invoice.contact_address) + "<br/>" : ""}
          ${customer?.phone || invoice.contact_phone ? "Phone: " + escapeHtml(customer?.phone || invoice.contact_phone) + "<br/>" : ""}
          ${customer?.email || invoice.contact_email ? "Email: " + escapeHtml(customer?.email || invoice.contact_email) : ""}
        </div>
      </div>

      <div class="dates-table">
        <div class="date-row">
          <div class="info-label">Issue Date</div>
          <div class="date-val">${escapeHtml(invoice.issue_date?.slice(0, 10))}</div>
        </div>
        <div class="date-row" style="margin-top: 0.4rem;">
          <div class="info-label">Due Date</div>
          <div class="date-val">${escapeHtml(invoice.due_date?.slice(0, 10))}</div>
        </div>
        ${
          invoice.terms
            ? `<div class="date-row" style="margin-top: 0.4rem;">
                <div class="info-label">Terms</div>
                <div class="date-val" style="font-size: 0.825rem;">${escapeHtml(invoice.terms)}</div>
              </div>`
            : ""
        }
      </div>
    </div>

    <!-- Items Table -->
    <div class="table-container">
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width: 5%;" class="align-center">#</th>
            <th style="width: 48%;">Item &amp; Description</th>
            <th style="width: 12%;" class="align-center">Qty</th>
            <th style="width: 17%;" class="align-right">Unit Price</th>
            <th style="width: 18%;" class="align-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lines
            .map((line, idx) => {
              const hasModel = line.model || line.sku || line.serial_number;
              const hasWarranty = line.warranty_type && line.warranty_type !== "NONE";
              const warrantyLabel =
                line.warranty_type === "MANUFACTURER"
                  ? "Manufacturer Warranty"
                  : line.warranty_type === "SELLER"
                  ? "Seller Warranty"
                  : "Custom Warranty";

              return `
              <tr>
                <td class="align-center" style="color: #64748b; font-size: 0.8rem;">${idx + 1}</td>
                <td>
                  <div class="item-desc">${escapeHtml(line.description)}</div>
                  ${
                    hasModel
                      ? `<div class="item-subtext">
                          ${line.model ? `<span>Model: <strong>${escapeHtml(line.model)}</strong></span> ` : ""}
                          ${line.sku ? `<span>SKU: <strong>${escapeHtml(line.sku)}</strong></span> ` : ""}
                          ${line.serial_number ? `<span>S/N: <strong>${escapeHtml(line.serial_number)}</strong></span>` : ""}
                        </div>`
                      : ""
                  }
                  ${
                    hasWarranty
                      ? `<div class="warranty-callout">
                          <div class="warranty-title">
                            🛡️ ${escapeHtml(warrantyLabel)}${
                              line.warranty_duration_months ? ` &bull; ${line.warranty_duration_months} Months` : ""
                            }
                            ${
                              line.warranty_start_date && line.warranty_end_date
                                ? ` (${escapeHtml(line.warranty_start_date.slice(0, 10))} to ${escapeHtml(line.warranty_end_date.slice(0, 10))})`
                                : ""
                            }
                          </div>
                          ${
                            line.warranty_coverage
                              ? `<div class="warranty-detail"><strong>Coverage:</strong> ${escapeHtml(line.warranty_coverage)}</div>`
                              : ""
                          }
                          ${
                            line.warranty_exclusions
                              ? `<div class="warranty-detail"><strong>Exclusions:</strong> ${escapeHtml(line.warranty_exclusions)}</div>`
                              : ""
                          }
                          ${
                            line.warranty_contact
                              ? `<div class="warranty-detail"><strong>Support:</strong> ${escapeHtml(line.warranty_contact)}</div>`
                              : ""
                          }
                        </div>`
                      : ""
                  }
                </td>
                <td class="align-center tabular-nums">${Number(line.quantity || 1)}</td>
                <td class="align-right tabular-nums">${formatCurrency(line.unit_price_minor, currency)}</td>
                <td class="align-right tabular-nums" style="font-weight: 600; color: #0f172a;">
                  ${formatCurrency(
                    line.total_minor ??
                      (line as any).line_total_minor ??
                      Number(line.unit_price_minor || 0) * Number(line.quantity || 1) -
                        Number(line.discount_minor || 0) +
                        Number(line.tax_minor || 0),
                    currency
                  )}
                </td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>

    <!-- Financial Breakdown -->
    <div class="summary-section">
      <div class="totals-box">
        <div class="totals-row">
          <span>Subtotal:</span>
          <span class="tabular-nums">${formatCurrency(invoice.subtotal_minor, currency)}</span>
        </div>
        ${
          Number(invoice.discount_minor ?? (invoice as any).discount_total_minor ?? 0) > 0
            ? `<div class="totals-row" style="color: #16a34a;">
                <span>Discount:</span>
                <span class="tabular-nums">-${formatCurrency(
                  invoice.discount_minor ?? (invoice as any).discount_total_minor,
                  currency
                )}</span>
              </div>`
            : ""
        }
        ${
          Number(invoice.tax_minor ?? (invoice as any).tax_total_minor ?? 0) > 0
            ? `<div class="totals-row">
                <span>Tax (${escapeHtml(seller.tax_label || "GST")}):</span>
                <span class="tabular-nums">+${formatCurrency(
                  invoice.tax_minor ?? (invoice as any).tax_total_minor,
                  currency
                )}</span>
              </div>`
            : ""
        }
        <div class="totals-row grand-total">
          <span>Total:</span>
          <span class="tabular-nums">${formatCurrency(totalMinor, currency)}</span>
        </div>
        <div class="totals-row paid">
          <span>Amount Paid:</span>
          <span class="tabular-nums">${formatCurrency(paidMinor, currency)}</span>
        </div>
        <div class="totals-row balance">
          <span>Balance Due:</span>
          <span class="tabular-nums">${formatCurrency(dueMinor, currency)}</span>
        </div>
      </div>
    </div>

    <!-- Notes & Terms -->
    <div class="bottom-section">
      ${
        invoice.notes
          ? `<div class="notes-block">
              <h4>Customer Notes &amp; Payment Instructions</h4>
              <p>${escapeHtml(invoice.notes)}</p>
            </div>`
          : ""
      }
      ${
        invoice.warranty_terms
          ? `<div class="notes-block" style="margin-top: 0.75rem;">
              <h4>Warranty Policy &amp; Terms</h4>
              <p>${escapeHtml(invoice.warranty_terms)}</p>
            </div>`
          : ""
      }
      ${
        invoice.terms
          ? `<div class="notes-block" style="margin-top: 0.75rem;">
              <h4>Payment Terms &amp; Conditions</h4>
              <p>${escapeHtml(invoice.terms)}</p>
            </div>`
          : ""
      }

      <!-- Payment Receipts History -->
      ${
        payments.length > 0
          ? `<div class="payments-history-block">
              <h4 style="font-size: 0.775rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; margin-bottom: 0.25rem;">
                Payment Summary (${payments.length} transaction${payments.length > 1 ? "s" : ""})
              </h4>
              <table>
                <thead>
                  <tr>
                    <th>Payment #</th>
                    <th>Date</th>
                    <th>Method / Reference</th>
                    <th>Account</th>
                    <th class="align-right">Allocated Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${payments
                    .map(
                      (p, pIdx) => `
                    <tr>
                      <td style="font-weight: 600;">${escapeHtml(p.payment_number || (p as any).reference || `Payment #${pIdx + 1}`)}</td>
                      <td>${escapeHtml(p.payment_date?.slice(0, 10))}</td>
                      <td>
                        ${escapeHtml(p.payment_method || (p as any).method || "Payment")}
                        ${p.reference_number || (p as any).reference ? ` &bull; Ref: ${escapeHtml(p.reference_number || (p as any).reference)}` : ""}
                      </td>
                      <td>${escapeHtml(p.account_name || "Payment Account")}</td>
                      <td class="align-right tabular-nums" style="font-weight: 600; color: #16a34a;">
                        ${formatCurrency(p.allocated_minor || p.amount_minor, currency)}
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
          : ""
      }

      <div style="margin-top: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.75rem;">
        Thank you for your business!
      </div>
    </div>
  </div>
</body>
</html>`;
}
