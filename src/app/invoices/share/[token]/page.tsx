import React from "react";
import { notFound } from "next/navigation";
import { getPublicInvoiceByShareToken } from "@/lib/accounting/invoices";
import { generateInvoiceHtml } from "@/lib/accounting/invoicePdfTemplate";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicInvoiceSharePage(props: Props) {
  const { token } = await props.params;
  const data = await getPublicInvoiceByShareToken(token);

  if (!data) {
    notFound();
  }

  const { invoice, lines, contact, seller, payments } = data;
  const html = generateInvoiceHtml(invoice as any, lines, seller, contact, payments, {
    isPublic: true,
    showPrintButton: true,
  });

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ minHeight: "100vh" }}
    />
  );
}
