import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  FinancialAccountRow,
  FinancialAccountType,
  FinancialAccountSubtype,
  JournalEntryRow,
  AccountHistoryItem,
} from "./types";

export interface DefaultAccountDefinition {
  code: string;
  name: string;
  type: FinancialAccountType;
  subtype: FinancialAccountSubtype;
  description: string;
}

export const SYSTEM_ACCOUNTS_CATALOGUE: DefaultAccountDefinition[] = [
  { code: "1010", name: "Cash in Hand", type: "ASSET", subtype: "CASH", description: "Physical cash on hand and petty cash" },
  { code: "1020", name: "Main Bank Account", type: "ASSET", subtype: "BANK", description: "Primary operational checking/current account" },
  { code: "1030", name: "UPI / Settlement Account", type: "ASSET", subtype: "UPI", description: "UPI and digital wallet settlement balance" },
  { code: "1200", name: "Accounts Receivable", type: "ASSET", subtype: "RECEIVABLE", description: "Money owed to business by customers (Owed to Me)" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", subtype: "PAYABLE", description: "Money owed by business to suppliers (I Owe)" },
  { code: "2500", name: "Loans & Borrowings", type: "LIABILITY", subtype: "LOAN", description: "Principal balance owed on loans and financing" },
  { code: "3000", name: "Owner's Equity & Capital", type: "EQUITY", subtype: "EQUITY", description: "Owner investment and retained surplus" },
  { code: "4000", name: "Sales & Operating Revenue", type: "REVENUE", subtype: "REVENUE", description: "Gross earned sales and business income" },
  { code: "5000", name: "Operating Expenses", type: "EXPENSE", subtype: "EXPENSE", description: "General and operational expenses" },
  { code: "5100", name: "Interest Expense", type: "EXPENSE", subtype: "EXPENSE", description: "Interest and financing charges on loans" },
];

/**
 * Seed the canonical 10 double-entry system accounts for a new workspace.
 */
export async function seedDefaultChartOfAccounts(workspaceId: string, client?: Queryable): Promise<void> {
  const db = client || pool;
  for (const acc of SYSTEM_ACCOUNTS_CATALOGUE) {
    await db.query(
      `INSERT INTO accounting_financial_accounts
         (workspace_id, code, name, type, subtype, currency, is_system, is_active, description)
       VALUES ($1, $2, $3, $4, $5, 'INR', true, true, $6)
       ON CONFLICT (workspace_id, code) DO UPDATE SET is_active = true`,
      [workspaceId, acc.code, acc.name, acc.type, acc.subtype, acc.description]
    );
  }
}

/**
 * List all financial accounts for a workspace.
 */
export async function listFinancialAccounts(workspaceId: string, client?: Queryable): Promise<FinancialAccountRow[]> {
  const db = client || pool;
  const res = await db.query<FinancialAccountRow>(
    `SELECT * FROM accounting_financial_accounts
     WHERE workspace_id = $1 AND is_active = true
     ORDER BY code ASC`,
    [workspaceId]
  );
  return res.rows;
}

export async function getFinancialAccountByCode(
  workspaceId: string,
  code: string,
  client?: Queryable
): Promise<FinancialAccountRow | null> {
  const db = client || pool;
  const res = await db.query<FinancialAccountRow>(
    `SELECT * FROM accounting_financial_accounts WHERE workspace_id = $1 AND code = $2 LIMIT 1`,
    [workspaceId, code]
  );
  return res.rows[0] || null;
}

export async function getFinancialAccountById(
  workspaceId: string,
  accountId: string,
  client?: Queryable
): Promise<FinancialAccountRow | null> {
  const db = client || pool;
  const res = await db.query<FinancialAccountRow>(
    `SELECT * FROM accounting_financial_accounts WHERE workspace_id = $1 AND id = $2 LIMIT 1`,
    [workspaceId, accountId]
  );
  return res.rows[0] || null;
}

import { postJournalEntry, reverseJournalEntry, type PostJournalLineInput } from "./ledger";

/**
 * Set or adjust opening balance for an account with a balanced journal entry against Equity.
 * Follows atomic double-entry ledger rules and properly signs debits/credits.
 */
export async function setAccountOpeningBalance(
  workspaceId: string,
  accountId: string,
  openingBalanceMinor: number,
  userId: string
): Promise<FinancialAccountRow> {
  return withTransaction(async (client) => {
    const acc = await getFinancialAccountById(workspaceId, accountId, client);
    if (!acc) throw new Error("Account not found");

    const equityAcc = await getFinancialAccountByCode(workspaceId, "3000", client);
    if (!equityAcc) throw new Error("Equity account 3000 (Owner Equity) not found");

    const existingOpening = Number(acc.opening_balance_minor);
    const diffMinor = openingBalanceMinor - existingOpening;
    if (diffMinor === 0) return acc;

    // Prepare properly signed balanced journal lines:
    // If Asset: increasing opening balance => Debit Asset, Credit Equity
    //           decreasing opening balance => Credit Asset, Debit Equity
    // If Liability: increasing opening balance => Credit Liability, Debit Equity
    //               decreasing opening balance => Debit Liability, Credit Equity
    const lines: PostJournalLineInput[] = [];
    const absDiff = Math.abs(diffMinor);

    if (acc.type === "ASSET") {
      if (diffMinor > 0) {
        lines.push(
          { financialAccountId: acc.id, debitMinor: absDiff, creditMinor: 0, description: `Opening balance for ${acc.name}` },
          { financialAccountId: equityAcc.id, debitMinor: 0, creditMinor: absDiff, description: `Opening equity funding for ${acc.name}` }
        );
      } else {
        lines.push(
          { financialAccountId: acc.id, debitMinor: 0, creditMinor: absDiff, description: `Opening balance reduction for ${acc.name}` },
          { financialAccountId: equityAcc.id, debitMinor: absDiff, creditMinor: 0, description: `Equity reduction for ${acc.name}` }
        );
      }
    } else {
      if (diffMinor > 0) {
        lines.push(
          { financialAccountId: acc.id, debitMinor: 0, creditMinor: absDiff, description: `Opening balance for ${acc.name}` },
          { financialAccountId: equityAcc.id, debitMinor: absDiff, creditMinor: 0, description: `Equity allocation for ${acc.name}` }
        );
      } else {
        lines.push(
          { financialAccountId: acc.id, debitMinor: absDiff, creditMinor: 0, description: `Opening balance reduction for ${acc.name}` },
          { financialAccountId: equityAcc.id, debitMinor: 0, creditMinor: absDiff, description: `Equity adjustment for ${acc.name}` }
        );
      }
    }

    // Post immutable balanced journal entry (this automatically updates current_balance_minor)
    await postJournalEntry(
      {
        workspaceId,
        entryType: "OPENING_BALANCE",
        description: `Opening balance adjustment for ${acc.name}`,
        sourceType: "ACCOUNT",
        sourceId: acc.id,
        lines,
        userId,
      },
      client
    );

    // Update opening_balance_minor record on account
    const updatedRes = await client.query<FinancialAccountRow>(
      `UPDATE accounting_financial_accounts
       SET opening_balance_minor = $1,
           updated_at = NOW()
       WHERE id = $2 AND workspace_id = $3
       RETURNING *`,
      [openingBalanceMinor, acc.id, workspaceId]
    );

    return updatedRes.rows[0];
  });
}

/**
 * Get account balance and funding history from General Ledger records.
 */
export async function getAccountBalanceHistory(
  workspaceId: string,
  accountId: string,
  client?: Queryable
): Promise<AccountHistoryItem[]> {
  const db = client || pool;

  const acc = await getFinancialAccountById(workspaceId, accountId, db);
  if (!acc) throw new Error("Account not found");

  const res = await db.query<{
    line_id: string;
    journal_entry_id: string;
    entry_number: string;
    entry_date: string;
    entry_type: string;
    entry_description: string;
    line_description: string | null;
    debit_minor: string;
    credit_minor: string;
    status: string;
    source_type: string;
    source_id: string | null;
    reversed_by_entry_id: string | null;
    reversal_of_entry_id: string | null;
    reversed_by_entry_number: string | null;
    reversal_of_entry_number: string | null;
    created_by_name: string;
    created_at: string;
    counterpart_info: string | null;
  }>(
    `SELECT
       jl.id as line_id,
       je.id as journal_entry_id,
       je.entry_number,
       TO_CHAR(je.entry_date, 'YYYY-MM-DD') as entry_date,
       je.entry_type,
       je.description as entry_description,
       jl.description as line_description,
       jl.debit_minor,
       jl.credit_minor,
       je.status,
       je.source_type,
       je.source_id,
       je.reversed_by_entry_id,
       je.reversal_of_entry_id,
       rev_je.entry_number as reversed_by_entry_number,
       orig_je.entry_number as reversal_of_entry_number,
       COALESCE(u.name, u.email, 'System') as created_by_name,
       je.created_at::text as created_at,
       (
         SELECT STRING_AGG(fa_other.code || ' - ' || fa_other.name, ', ')
         FROM accounting_journal_lines jl_other
         JOIN accounting_financial_accounts fa_other ON fa_other.id = jl_other.financial_account_id
         WHERE jl_other.journal_entry_id = je.id
           AND jl_other.financial_account_id != jl.financial_account_id
       ) as counterpart_info
     FROM accounting_journal_lines jl
     JOIN accounting_journal_entries je ON je.id = jl.journal_entry_id
     LEFT JOIN users u ON u.id = je.created_by
     LEFT JOIN accounting_journal_entries rev_je ON rev_je.id = je.reversed_by_entry_id
     LEFT JOIN accounting_journal_entries orig_je ON orig_je.id = je.reversal_of_entry_id
     WHERE jl.financial_account_id = $1 AND je.workspace_id = $2
     ORDER BY je.entry_date DESC, je.created_at DESC`,
    [accountId, workspaceId]
  );

  return res.rows.map((row) => {
    const debit = Number(row.debit_minor || 0);
    const credit = Number(row.credit_minor || 0);

    let direction: "INFLOW" | "OUTFLOW" = "INFLOW";
    let amount = debit;

    if (acc.type === "ASSET") {
      if (debit > 0) {
        direction = "INFLOW";
        amount = debit;
      } else {
        direction = "OUTFLOW";
        amount = credit;
      }
    } else {
      if (credit > 0) {
        direction = "INFLOW";
        amount = credit;
      } else {
        direction = "OUTFLOW";
        amount = debit;
      }
    }

    let displayType = row.entry_type;
    if (row.entry_type === "OPENING_BALANCE") displayType = "Opening Balance";
    else if (row.entry_type === "REVERSAL") displayType = "Reversal";
    else if (row.entry_type === "CAPITAL_CONTRIBUTION") displayType = "Capital Contribution";
    else if (row.entry_type === "SALE") displayType = "Income / Sale";
    else if (row.entry_type === "EXPENSE") displayType = "Expense";
    else if (row.entry_type === "TRANSFER") displayType = "Transfer";

    let status: "ACTIVE" | "REVERSED" | "REVERSAL" = "ACTIVE";
    if (row.status === "VOIDED" || row.reversed_by_entry_id) {
      status = "REVERSED";
    } else if (row.reversal_of_entry_id || row.entry_type === "REVERSAL") {
      status = "REVERSAL";
    }

    // Eligible for correction or reversal: must be active posted opening balance or funding entry
    const isFundingType =
      row.entry_type === "OPENING_BALANCE" ||
      row.entry_type === "CAPITAL_CONTRIBUTION" ||
      row.source_type === "ACCOUNT" ||
      Boolean(row.counterpart_info && row.counterpart_info.includes("3000"));

    const isEligible = Boolean(status === "ACTIVE" && isFundingType && row.status === "POSTED");

    return {
      id: row.journal_entry_id,
      lineId: row.line_id,
      entryNumber: row.entry_number,
      entryDate: row.entry_date,
      entryType: row.entry_type,
      displayType,
      description: row.line_description || row.entry_description,
      debitMinor: debit,
      creditMinor: credit,
      direction,
      amountMinor: amount,
      counterpartAccount: row.counterpart_info || "General Ledger",
      status,
      isEligibleForCorrection: isEligible,
      isEligibleForReversal: isEligible,
      createdBy: row.created_by_name,
      createdAt: row.created_at,
      reversedByEntryId: row.reversed_by_entry_id,
      reversedByEntryNumber: row.reversed_by_entry_number,
      reversalOfEntryId: row.reversal_of_entry_id,
      reversalOfEntryNumber: row.reversal_of_entry_number,
    };
  });
}

/**
 * Reverse an account funding / opening entry cleanly and atomically.
 */
export async function reverseAccountFundingEntry(
  workspaceId: string,
  entryId: string,
  reason: string,
  userId?: string
): Promise<{ success: boolean; reversalEntryId: string }> {
  return withTransaction(async (client) => {
    // 1. Lock and inspect entry
    const origRes = await client.query<JournalEntryRow>(
      `SELECT * FROM accounting_journal_entries WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [entryId, workspaceId]
    );
    const orig = origRes.rows[0];
    if (!orig) throw new Error("Entry not found.");
    if (orig.status === "VOIDED" || orig.reversed_by_entry_id) {
      throw new Error("This entry has already been reversed.");
    }

    // 2. Perform atomic balanced reversal
    const { reversalEntry } = await reverseJournalEntry(
      workspaceId,
      entryId,
      reason || "Reversal of opening/funding entry",
      userId,
      client
    );

    // 3. If this was an OPENING_BALANCE entry, update account opening_balance_minor
    if (orig.entry_type === "OPENING_BALANCE") {
      const lineRes = await client.query<{ financial_account_id: string; debit_minor: string; credit_minor: string; type: string }>(
        `SELECT jl.financial_account_id, jl.debit_minor, jl.credit_minor, fa.type
         FROM accounting_journal_lines jl
         JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
         WHERE jl.journal_entry_id = $1 AND fa.type IN ('ASSET', 'LIABILITY')
         LIMIT 1`,
        [orig.id]
      );
      if (lineRes.rows.length > 0) {
        const l = lineRes.rows[0];
        const amt = l.type === "ASSET" ? Number(l.debit_minor) : Number(l.credit_minor);
        await client.query(
          `UPDATE accounting_financial_accounts
           SET opening_balance_minor = GREATEST(0, opening_balance_minor - $1),
               updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [amt, l.financial_account_id, workspaceId]
        );
      }
    }

    return { success: true, reversalEntryId: reversalEntry.id };
  });
}

/**
 * Correct an account funding / opening entry:
 * Reverses the mistaken entry and posts a balanced replacement in the correct account atomically.
 */
export async function correctAccountFundingEntry(
  workspaceId: string,
  entryId: string,
  input: {
    correctAmountMinor: number;
    correctAccountId: string;
    reason: string;
    userId?: string;
  }
): Promise<{ success: boolean; reversalEntryId: string; replacementEntryId: string }> {
  if (input.correctAmountMinor <= 0) {
    throw new Error("Correct amount must be greater than zero.");
  }
  if (!input.correctAccountId) {
    throw new Error("Target destination account is required.");
  }

  return withTransaction(async (client) => {
    // 1. Lock and verify original entry
    const origRes = await client.query<JournalEntryRow>(
      `SELECT * FROM accounting_journal_entries WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [entryId, workspaceId]
    );
    const orig = origRes.rows[0];
    if (!orig) throw new Error("Entry not found.");
    if (orig.status === "VOIDED" || orig.reversed_by_entry_id) {
      throw new Error("This entry has already been reversed or superseded.");
    }

    // 2. Verify destination account
    const targetAcc = await getFinancialAccountById(workspaceId, input.correctAccountId, client);
    if (!targetAcc) throw new Error("Destination account not found in this workspace.");
    if (!targetAcc.is_active) throw new Error("Destination account is inactive.");

    const equityAcc = await getFinancialAccountByCode(workspaceId, "3000", client);
    if (!equityAcc) throw new Error("Equity account 3000 (Owner Equity) not found.");

    // 3. Reverse the mistaken entry
    const { reversalEntry } = await reverseJournalEntry(
      workspaceId,
      entryId,
      `Correction: ${input.reason}`,
      input.userId,
      client
    );

    // If original was OPENING_BALANCE, subtract from original account's opening_balance_minor
    if (orig.entry_type === "OPENING_BALANCE") {
      const origLineRes = await client.query<{ financial_account_id: string; debit_minor: string; credit_minor: string; type: string }>(
        `SELECT jl.financial_account_id, jl.debit_minor, jl.credit_minor, fa.type
         FROM accounting_journal_lines jl
         JOIN accounting_financial_accounts fa ON fa.id = jl.financial_account_id
         WHERE jl.journal_entry_id = $1 AND fa.type IN ('ASSET', 'LIABILITY')
         LIMIT 1`,
        [orig.id]
      );
      if (origLineRes.rows.length > 0) {
        const l = origLineRes.rows[0];
        const amt = l.type === "ASSET" ? Number(l.debit_minor) : Number(l.credit_minor);
        await client.query(
          `UPDATE accounting_financial_accounts
           SET opening_balance_minor = GREATEST(0, opening_balance_minor - $1),
               updated_at = NOW()
           WHERE id = $2 AND workspace_id = $3`,
          [amt, l.financial_account_id, workspaceId]
        );
      }
    }

    // 4. Post the replacement entry in the correct account against Owner Equity
    const replacementLines: PostJournalLineInput[] = [];
    if (targetAcc.type === "ASSET") {
      replacementLines.push(
        {
          financialAccountId: targetAcc.id,
          debitMinor: input.correctAmountMinor,
          creditMinor: 0,
          description: `Corrected opening balance for ${targetAcc.name}`,
        },
        {
          financialAccountId: equityAcc.id,
          debitMinor: 0,
          creditMinor: input.correctAmountMinor,
          description: `Corrected equity funding for ${targetAcc.name}`,
        }
      );
    } else {
      replacementLines.push(
        {
          financialAccountId: targetAcc.id,
          debitMinor: 0,
          creditMinor: input.correctAmountMinor,
          description: `Corrected opening balance for ${targetAcc.name}`,
        },
        {
          financialAccountId: equityAcc.id,
          debitMinor: input.correctAmountMinor,
          creditMinor: 0,
          description: `Corrected equity allocation for ${targetAcc.name}`,
        }
      );
    }

    const { entry: replacementEntry } = await postJournalEntry(
      {
        workspaceId,
        entryType: "OPENING_BALANCE",
        description: `Correction replacement for ${orig.entry_number}: ${input.reason}`,
        reference: orig.entry_number,
        sourceType: "ACCOUNT",
        sourceId: targetAcc.id,
        lines: replacementLines,
        userId: input.userId,
      },
      client
    );

    // Update target account opening_balance_minor
    await client.query(
      `UPDATE accounting_financial_accounts
       SET opening_balance_minor = opening_balance_minor + $1,
           updated_at = NOW()
       WHERE id = $2 AND workspace_id = $3`,
      [input.correctAmountMinor, targetAcc.id, workspaceId]
    );

    // Record audit log
    let actorId = input.userId || orig.created_by;
    if (actorId) {
      await client.query(
        `INSERT INTO accounting_audit_logs
           (workspace_id, actor_id, actor_role, action, entity_type, entity_id, previous_state, new_state)
         VALUES ($1, $2, 'STAFF', 'JOURNAL_CORRECTED', 'accounting_journal_entries', $3, $4, $5)`,
        [
          workspaceId,
          actorId,
          orig.id,
          JSON.stringify({ status: orig.status, entry_number: orig.entry_number }),
          JSON.stringify({
            status: "VOIDED",
            reversed_by: reversalEntry.id,
            replaced_by: replacementEntry.id,
            reason: input.reason,
            target_account_id: targetAcc.id,
            target_account_name: targetAcc.name,
            amount_minor: input.correctAmountMinor,
          }),
        ]
      );
    }

    return {
      success: true,
      reversalEntryId: reversalEntry.id,
      replacementEntryId: replacementEntry.id,
    };
  });
}
