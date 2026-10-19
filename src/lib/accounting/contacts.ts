import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type { ContactRow, ContactType } from "./types";
import { normalizePhoneNumber } from "@/lib/phone";
import { postJournalEntry } from "./ledger";
import { getFinancialAccountByCode } from "./accounts";

export interface CreateContactInput {
  workspaceId: string;
  name: string;
  type: ContactType;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  leadId?: string | null;
}

export async function createContact(
  input: CreateContactInput,
  client?: Queryable
): Promise<ContactRow> {
  const db = client || pool;
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Contact name must be at least 2 characters.");

  let phoneNormalized: string | null = null;
  if (input.phone) {
    const parsed = normalizePhoneNumber(input.phone);
    if (parsed.isValid) phoneNormalized = parsed.normalized;
  }

  const res = await db.query<ContactRow>(
    `INSERT INTO accounting_contacts
       (workspace_id, name, type, email, phone, phone_normalized, address, notes, lead_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.workspaceId,
      name,
      input.type,
      input.email?.trim().toLowerCase() || null,
      input.phone || null,
      phoneNormalized,
      input.address || null,
      input.notes || null,
      input.leadId || null,
    ]
  );
  return res.rows[0];
}

export async function listContacts(
  workspaceId: string,
  options?: { type?: ContactType; search?: string; onlyWithBalances?: boolean }
): Promise<ContactRow[]> {
  let sql = `SELECT * FROM accounting_contacts WHERE workspace_id = $1 AND is_active = true`;
  const params: unknown[] = [workspaceId];

  if (options?.type) {
    params.push(options.type);
    sql += ` AND type = $${params.length}`;
  }
  if (options?.onlyWithBalances) {
    sql += ` AND (total_receivable_minor > 0 OR total_payable_minor > 0)`;
  }
  if (options?.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(email, '')) LIKE $${params.length} OR COALESCE(phone, '') LIKE $${params.length})`;
  }

  sql += ` ORDER BY name ASC`;
  const res = await pool.query<ContactRow>(sql, params);
  return res.rows;
}

export async function getContactById(workspaceId: string, contactId: string): Promise<ContactRow | null> {
  const res = await pool.query<ContactRow>(
    `SELECT * FROM accounting_contacts WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
    [contactId, workspaceId]
  );
  return res.rows[0] || null;
}

/**
 * Record a Personal IOU without issuing a commercial business invoice.
 * Lend money to friend: Debit Accounts Receivable (1200), Credit Cash/Bank (1010/1020).
 * Borrow money from friend: Debit Cash/Bank (1010/1020), Credit Accounts Payable (2000).
 */
export async function recordPersonalIOU(
  workspaceId: string,
  input: {
    contactId: string;
    direction: "LENT_OUT" | "BORROWED"; // LENT_OUT = Owed to Me, BORROWED = I Owe
    amountMinor: number;
    financialAccountId: string;
    date?: string;
    notes?: string;
    userId?: string;
  }
): Promise<{ contact: ContactRow }> {
  if (input.amountMinor <= 0) throw new Error("Amount must be greater than zero.");
  const date = input.date || new Date().toISOString().slice(0, 10);

  return withTransaction(async (client) => {
    const contact = await getContactById(workspaceId, input.contactId);
    if (!contact) throw new Error("Contact not found.");

    if (input.direction === "LENT_OUT") {
      // Money given out to friend/contact: Debit AR (1200), Credit Cash/Bank
      const arAcc = await getFinancialAccountByCode(workspaceId, "1200", client);
      if (!arAcc) throw new Error("Receivables account 1200 not found.");

      await postJournalEntry(
        {
          workspaceId,
          entryType: "MANUAL",
          entryDate: date,
          description: input.notes || `Personal IOU: Lent to ${contact.name}`,
          sourceType: "PERSONAL_IOU",
          sourceId: contact.id,
          lines: [
            { financialAccountId: arAcc.id, debitMinor: input.amountMinor, creditMinor: 0, description: `Owed by ${contact.name}` },
            { financialAccountId: input.financialAccountId, debitMinor: 0, creditMinor: input.amountMinor, description: "Cash Paid" },
          ],
          userId: input.userId,
        },
        client
      );

      const updated = (
        await client.query<ContactRow>(
          `UPDATE accounting_contacts
           SET total_receivable_minor = total_receivable_minor + $1, updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3
           RETURNING *`,
          [input.amountMinor, contact.id, workspaceId]
        )
      ).rows[0];

      return { contact: updated };
    } else {
      // Money borrowed from friend/contact: Debit Cash/Bank, Credit AP (2000)
      const apAcc = await getFinancialAccountByCode(workspaceId, "2000", client);
      if (!apAcc) throw new Error("Payables account 2000 not found.");

      await postJournalEntry(
        {
          workspaceId,
          entryType: "MANUAL",
          entryDate: date,
          description: input.notes || `Personal IOU: Borrowed from ${contact.name}`,
          sourceType: "PERSONAL_IOU",
          sourceId: contact.id,
          lines: [
            { financialAccountId: input.financialAccountId, debitMinor: input.amountMinor, creditMinor: 0, description: "Cash Received" },
            { financialAccountId: apAcc.id, debitMinor: 0, creditMinor: input.amountMinor, description: `Owed to ${contact.name}` },
          ],
          userId: input.userId,
        },
        client
      );

      const updated = (
        await client.query<ContactRow>(
          `UPDATE accounting_contacts
           SET total_payable_minor = total_payable_minor + $1, updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3
           RETURNING *`,
          [input.amountMinor, contact.id, workspaceId]
        )
      ).rows[0];

      return { contact: updated };
    }
  });
}
