import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  JournalEntryRow,
  JournalLineRow,
  JournalEntryType,
  FinancialAccountType,
} from "./types";
import { getFinancialAccountById } from "./accounts";

export interface PostJournalLineInput {
  financialAccountId: string;
  debitMinor: number;
  creditMinor: number;
  description?: string;
}

export interface PostJournalEntryInput {
  workspaceId: string;
  entryType: JournalEntryType;
  entryDate?: string; // YYYY-MM-DD
  description: string;
  reference?: string;
  sourceType: string;
  sourceId?: string;
  idempotencyKey?: string;
  lines: PostJournalLineInput[];
  userId?: string;
}

/**
 * Calculates current balance change based on account normal balance.
 * ASSET & EXPENSE: +Debit, -Credit
 * LIABILITY, EQUITY, REVENUE: +Credit, -Debit
 */
function calculateBalanceDelta(accountType: FinancialAccountType, debitMinor: number, creditMinor: number): number {
  if (accountType === "ASSET" || accountType === "EXPENSE") {
    return debitMinor - creditMinor;
  } else {
    return creditMinor - debitMinor;
  }
}

/**
 * Posts an atomic double-entry journal entry to the general ledger.
 * Enforces:
 * 1. Debits == Credits invariant
 * 2. Idempotency on workspace + idempotency_key
 * 3. Atomic account balance updates
 */
export async function postJournalEntry(
  input: PostJournalEntryInput,
  client?: Queryable
): Promise<{ entry: JournalEntryRow; lines: JournalLineRow[]; isDuplicate?: boolean }> {
  const runner = async (db: Queryable) => {
    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const existing = (
        await db.query<JournalEntryRow>(
          `SELECT * FROM accounting_journal_entries
           WHERE workspace_id = $1 AND idempotency_key = $2
           LIMIT 1`,
          [input.workspaceId, input.idempotencyKey]
        )
      ).rows[0];

      if (existing) {
        const lines = (
          await db.query<JournalLineRow>(
            `SELECT jl.*, fa.name as account_name, fa.code as account_code, fa.type as account_type
             FROM accounting_journal_lines jl
             JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
             WHERE jl.journal_entry_id = $1`,
            [existing.id]
          )
        ).rows;
        return { entry: existing, lines, isDuplicate: true };
      }
    }

    // 2. Validate Debits == Credits
    let totalDebit = 0;
    let totalCredit = 0;

    if (!input.lines || input.lines.length < 2) {
      throw new Error("Journal entry must have at least two balanced lines.");
    }

    for (const line of input.lines) {
      if (line.debitMinor < 0 || line.creditMinor < 0) {
        throw new Error("Debit and credit amounts must be non-negative.");
      }
      if (line.debitMinor === 0 && line.creditMinor === 0) {
        throw new Error("Journal line must have a non-zero debit or credit amount.");
      }
      if (line.debitMinor > 0 && line.creditMinor > 0) {
        throw new Error("Journal line cannot have both debit and credit amounts.");
      }
      totalDebit += line.debitMinor;
      totalCredit += line.creditMinor;
    }

    if (totalDebit !== totalCredit) {
      throw new Error(
        `Journal entry out of balance: Debits (₹${(totalDebit / 100).toFixed(2)}) != Credits (₹${(totalCredit / 100).toFixed(2)})`
      );
    }

    // 3. Generate Sequential Entry Number
    const entryDate = input.entryDate || new Date().toISOString().slice(0, 10);
    const datePrefix = entryDate.replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const entryNumber = `JE-${datePrefix}-${randomSuffix}`;

    // 4. Insert Journal Entry Header
    const entryRes = await db.query<JournalEntryRow>(
      `INSERT INTO accounting_journal_entries
         (workspace_id, entry_number, entry_date, entry_type, description, reference, source_type, source_id, idempotency_key, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'POSTED', $10)
       RETURNING *`,
      [
        input.workspaceId,
        entryNumber,
        entryDate,
        input.entryType,
        input.description,
        input.reference || null,
        input.sourceType,
        input.sourceId || null,
        input.idempotencyKey || null,
        input.userId || null,
      ]
    );
    const entry = entryRes.rows[0];

    // 5. Insert Lines and Update Account Balances
    const postedLines: JournalLineRow[] = [];

    for (const line of input.lines) {
      const acc = await getFinancialAccountById(input.workspaceId, line.financialAccountId, db);
      if (!acc) {
        throw new Error(`Financial account ${line.financialAccountId} not found in workspace.`);
      }

      const lRes = await db.query<JournalLineRow>(
        `INSERT INTO accounting_journal_lines
           (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [entry.id, line.financialAccountId, line.debitMinor, line.creditMinor, line.description || null]
      );
      postedLines.push({
        ...lRes.rows[0],
        account_name: acc.name,
        account_code: acc.code,
        account_type: acc.type,
      });

      const delta = calculateBalanceDelta(acc.type, line.debitMinor, line.creditMinor);
      await db.query(
        `UPDATE accounting_financial_accounts
         SET current_balance_minor = current_balance_minor + $1,
             updated_at = NOW()
         WHERE id = $2 AND workspace_id = $3`,
        [delta, line.financialAccountId, input.workspaceId]
      );
    }

    return { entry, lines: postedLines, isDuplicate: false };
  };

  if (client) {
    return runner(client);
  }
  return withTransaction(runner);
}

/**
 * Creates a balanced reversal for an existing posted journal entry.
 * Traceable correction: original entry is marked VOIDED and linked to the reversal entry.
 */
export async function reverseJournalEntry(
  workspaceId: string,
  entryId: string,
  reason: string,
  userId?: string,
  client?: Queryable
): Promise<{ reversalEntry: JournalEntryRow; originalEntry: JournalEntryRow }> {
  const runner = async (client: Queryable) => {
    // 1. Fetch original entry and its lines
    const origRes = await client.query<JournalEntryRow>(
      `SELECT * FROM accounting_journal_entries WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [entryId, workspaceId]
    );
    const original = origRes.rows[0];
    if (!original) throw new Error("Journal entry not found.");
    if (original.status === "VOIDED") throw new Error("Journal entry is already voided/reversed.");

    const linesRes = await client.query<JournalLineRow>(
      `SELECT * FROM accounting_journal_lines WHERE journal_entry_id = $1`,
      [entryId]
    );
    const lines = linesRes.rows;

    // 2. Prepare opposite lines (swapping debits and credits)
    const reversalLines: PostJournalLineInput[] = lines.map((l) => ({
      financialAccountId: l.financial_account_id,
      debitMinor: Number(l.credit_minor),
      creditMinor: Number(l.debit_minor),
      description: `Reversal: ${l.description || original.description}`,
    }));

    // 3. Post reversal entry
    const { entry: reversal } = await postJournalEntry(
      {
        workspaceId,
        entryType: "REVERSAL",
        description: `Reversal of ${original.entry_number}: ${reason}`,
        reference: original.entry_number,
        sourceType: "REVERSAL",
        sourceId: original.id,
        lines: reversalLines,
        userId,
      },
      client
    );

    // 4. Link reversal entries and update status
    await client.query(
      `UPDATE accounting_journal_entries
       SET status = 'VOIDED',
           reversed_by_entry_id = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [reversal.id, original.id]
    );

    await client.query(
      `UPDATE accounting_journal_entries
       SET reversal_of_entry_id = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [original.id, reversal.id]
    );

    // 5. Audit Log (ensure non-null actor_id)
    let actorId = userId || original.created_by;
    if (!actorId) {
      const wsOwner = await client.query<{ owner_user_id: string }>(
        `SELECT owner_user_id FROM accounting_workspaces WHERE id = $1`,
        [workspaceId]
      );
      actorId = wsOwner.rows[0]?.owner_user_id || null;
    }

    if (actorId) {
      await client.query(
        `INSERT INTO accounting_audit_logs
           (workspace_id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
         VALUES ($1, $2, 'STAFF', 'JOURNAL_REVERSED', 'accounting_journal_entries', $3, $4, $5)`,
        [
          workspaceId,
          actorId,
          original.id,
          JSON.stringify({ status: original.status }),
          JSON.stringify({ status: "VOIDED", reversed_by: reversal.id, reason }),
        ]
      );
    }

    return {
      reversalEntry: reversal,
      originalEntry: { ...original, status: "VOIDED" as const, reversed_by_entry_id: reversal.id },
    };
  };

  if (client) {
    return runner(client);
  }
  return withTransaction(runner);
}
