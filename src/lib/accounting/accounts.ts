import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type {
  FinancialAccountRow,
  FinancialAccountType,
  FinancialAccountSubtype,
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

/**
 * Set opening balance for an account with a balanced journal entry against Equity.
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
    if (!equityAcc) throw new Error("Equity account 3000 not found");

    const diffMinor = openingBalanceMinor - Number(acc.opening_balance_minor);
    if (diffMinor === 0) return acc;

    // Create Opening Balance Journal Entry
    const entryNum = `OB-${acc.code}-${Date.now().toString().slice(-6)}`;
    const desc = `Opening balance adjustment for ${acc.name}`;

    const jRes = await client.query<{ id: string }>(
      `INSERT INTO accounting_journal_entries
         (workspace_id, entry_number, entry_date, entry_type, description, source_type, source_id, status, created_by)
       VALUES ($1, $2, CURRENT_DATE, 'OPENING_BALANCE', $3, 'ACCOUNT', $4, 'POSTED', $5)
       RETURNING id`,
      [workspaceId, entryNum, desc, acc.id, userId]
    );
    const entryId = jRes.rows[0].id;

    if (acc.type === "ASSET") {
      // Debit Asset, Credit Equity
      await client.query(
        `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
         VALUES ($1, $2, $3, 0, $4), ($1, $5, 0, $3, $4)`,
        [entryId, acc.id, Math.abs(diffMinor), `Opening balance for ${acc.name}`, equityAcc.id]
      );
    } else {
      // Credit Liability/Equity, Debit Equity/Asset
      await client.query(
        `INSERT INTO accounting_journal_lines (journal_entry_id, financial_account_id, debit_minor, credit_minor, description)
         VALUES ($1, $2, 0, $3, $4), ($1, $5, $3, 0, $4)`,
        [entryId, acc.id, Math.abs(diffMinor), `Opening balance for ${acc.name}`, equityAcc.id]
      );
    }

    // Update balances
    const updatedRes = await client.query<FinancialAccountRow>(
      `UPDATE accounting_financial_accounts
       SET opening_balance_minor = $1,
           current_balance_minor = current_balance_minor + $2,
           updated_at = NOW()
       WHERE id = $3 AND workspace_id = $4
       RETURNING *`,
      [openingBalanceMinor, diffMinor, acc.id, workspaceId]
    );

    await client.query(
      `UPDATE accounting_financial_accounts
       SET current_balance_minor = current_balance_minor + $1,
           updated_at = NOW()
       WHERE id = $2 AND workspace_id = $3`,
      [acc.type === "ASSET" ? diffMinor : -diffMinor, equityAcc.id, workspaceId]
    );

    return updatedRes.rows[0];
  });
}
