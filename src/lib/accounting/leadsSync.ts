import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { InvoiceRow, DirectSaleRow } from "./types";
import { createInvoice } from "./invoices";
import { recordPayment } from "./payments";
import { createContact, listContacts } from "./contacts";
import { getFinancialAccountByCode } from "./accounts";

export interface SyncLeadInput {
  workspaceId: string;
  leadId: string;
  idempotencyKey: string;
  financialAccountId?: string;
  userId?: string;
}

export interface SyncLeadResult {
  isDuplicate: boolean;
  leadId: string;
  invoiceId?: string;
  invoiceNumber?: string;
  saleId?: string;
  advancePaymentId?: string;
  amountMinor: number;
  advanceMinor: number;
}

/**
 * Idempotently sync a won lead from Zappit Leads into Zappit Accounts.
 * Deal Won != Payment Received:
 * Creates an Issued Invoice for totalAmountMinor, and if advanceAmountMinor > 0, records
 * a partial payment allocation into the selected financial account.
 */
export async function syncLeadToAccounts(input: SyncLeadInput): Promise<SyncLeadResult> {
  const { workspaceId, leadId, idempotencyKey, userId } = input;

  return withTransaction(async (db) => {
    // 1. Check Outbox for previous execution of this idempotency key
    const existingEvent = (
      await db.query<{ id: string; payload: any }>(
        `SELECT id, payload FROM accounting_outbox_events
         WHERE idempotency_key = $1
         LIMIT 1`,
        [idempotencyKey]
      )
    ).rows[0];

    if (existingEvent) {
      return {
        ...existingEvent.payload,
        isDuplicate: true,
      };
    }

    // 2. Fetch Lead from database
    const leadRes = await db.query<{
      id: string;
      name: string;
      company_name: string | null;
      email: string | null;
      contact_number: string;
      contact_number_normalized: string;
      total_amount: string | null;
      advance_amount: string | null;
      products: any;
      remarks: string | null;
    }>(
      `SELECT id, name, company_name, email, contact_number, contact_number_normalized,
              total_amount, advance_amount, products, remarks
       FROM leads
       WHERE id = $1
       LIMIT 1`,
      [leadId]
    );

    const lead = leadRes.rows[0];
    if (!lead) throw new Error(`Lead with ID ${leadId} not found.`);

    const totalMinor = Math.round(Number(lead.total_amount || 0) * 100);
    const advanceMinor = Math.round(Number(lead.advance_amount || 0) * 100);

    if (totalMinor <= 0) {
      throw new Error("Lead has zero or invalid total amount; cannot sync financial invoice.");
    }

    // 3. Find or Create Contact in Accounts linked to this Lead
    let contactId: string;
    const existingContact = (
      await db.query<{ id: string }>(
        `SELECT id FROM accounting_contacts
         WHERE workspace_id = $1 AND (lead_id = $2 OR phone_normalized = $3)
         LIMIT 1`,
        [workspaceId, lead.id, lead.contact_number_normalized]
      )
    ).rows[0];

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const newContact = await createContact(
        {
          workspaceId,
          name: lead.name,
          type: "CUSTOMER",
          email: lead.email,
          phone: lead.contact_number,
          notes: lead.company_name ? `Company: ${lead.company_name}` : null,
          leadId: lead.id,
        },
        db
      );
      contactId = newContact.id;
    }

    // 4. Resolve Products / Line Items
    let lines = [];
    const rawProducts = Array.isArray(lead.products) ? lead.products : [];

    if (rawProducts.length > 0) {
      lines = rawProducts.map((p: any) => ({
        description: p.name || p.title || "Custom Service/Product",
        quantity: Number(p.quantity || p.qty || 1),
        unitPriceMinor: Math.round(Number(p.price || p.unit_price || totalMinor / 100) * 100),
      }));
    } else {
      lines = [
        {
          description: `Zappit Lead Delivery (${lead.name})`,
          quantity: 1,
          unitPriceMinor: totalMinor,
        },
      ];
    }

    // 5. Create Issued Invoice in Accounts
    const today = new Date().toISOString().slice(0, 10);
    const { invoice } = await createInvoice(
      {
        workspaceId,
        contactId,
        issueDate: today,
        dueDate: today,
        status: "ISSUED",
        notes: `Converted from Zappit Lead #${lead.id.slice(0, 8)}. ${lead.remarks || ""}`.trim(),
        leadId: lead.id,
        lines,
        userId,
      },
      db
    );

    // 6. Record Advance Payment if any
    let advancePaymentId: string | undefined;

    if (advanceMinor > 0) {
      // Resolve bank or cash account
      let finAccountId = input.financialAccountId;
      if (!finAccountId) {
        const bankAcc = await getFinancialAccountByCode(workspaceId, "1020", db);
        finAccountId = bankAcc?.id;
      }

      if (finAccountId) {
        const paymentRes = await recordPayment(
          {
            workspaceId,
            type: "IN",
            contactId,
            financialAccountId: finAccountId,
            amountMinor: advanceMinor,
            notes: `Advance payment for Lead Invoice ${invoice.invoice_number}`,
            allocations: [
              {
                invoiceId: invoice.id,
                amountMinor: Math.min(advanceMinor, totalMinor),
              },
            ],
            userId,
          },
          db
        );
        advancePaymentId = paymentRes.payment.id;
      }
    }

    const payload: SyncLeadResult = {
      isDuplicate: false,
      leadId: lead.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      advancePaymentId,
      amountMinor: totalMinor,
      advanceMinor,
    };

    // 7. Store in Outbox for idempotency
    await db.query(
      `INSERT INTO accounting_outbox_events
         (event_type, source_id, idempotency_key, payload, status, processed_at)
       VALUES ('LEAD_SYNCED_TO_ACCOUNTS', $1, $2, $3::jsonb, 'PROCESSED', NOW())`,
      [lead.id, idempotencyKey, JSON.stringify(payload)]
    );

    return payload;
  });
}
