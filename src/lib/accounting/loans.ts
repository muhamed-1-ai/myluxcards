import "server-only";
import { pool, withTransaction } from "@/lib/db";
import type { Queryable } from "@/lib/db/types";
import type { LoanRow, LoanInstallmentRow } from "./types";
import { postJournalEntry } from "./ledger";
import { getFinancialAccountByCode } from "./accounts";

export interface CreateLoanInput {
  workspaceId: string;
  loanName: string;
  lenderContactId?: string | null;
  principalMinor: number;
  interestRatePercent?: number; // annual interest rate
  tenureMonths: number;
  startDate?: string;
  disbursementAccountId: string; // Cash or Bank receiving loan funds
  userId?: string;
}

export interface RecordInstallmentPaymentInput {
  workspaceId: string;
  loanId: string;
  installmentNumber: number;
  paidDate?: string;
  financialAccountId: string; // Source account (Bank/Cash)
  userId?: string;
}

export async function createLoan(
  input: CreateLoanInput,
  client?: Queryable
): Promise<{ loan: LoanRow; installments: LoanInstallmentRow[] }> {
  if (input.principalMinor <= 0) throw new Error("Principal must be greater than zero.");
  if (input.tenureMonths <= 0) throw new Error("Tenure must be at least 1 month.");

  const startDate = input.startDate || new Date().toISOString().slice(0, 10);
  const annualRate = Math.max(0, input.interestRatePercent || 0);

  // Simple / Reducing interest installment calculation
  const totalPrincipal = input.principalMinor;
  const principalPerMonth = Math.round(totalPrincipal / input.tenureMonths);
  const monthlyRate = annualRate / 12 / 100;

  return withTransaction(async (db) => {
    // 1. Resolve Loans Payable account (2500)
    const liabilityAcc = await getFinancialAccountByCode(input.workspaceId, "2500", db);
    if (!liabilityAcc) throw new Error("Loans liability account (2500) not found.");

    // 2. Post loan receipt to ledger:
    // Cash/Bank Dr, Loans Payable Cr (INCREASES CASH AND LIABILITY, NEVER REVENUE!)
    await postJournalEntry(
      {
        workspaceId: input.workspaceId,
        entryType: "LOAN_RECEIPT",
        entryDate: startDate,
        description: `Loan Disbursement: ${input.loanName}`,
        sourceType: "LOAN",
        lines: [
          { financialAccountId: input.disbursementAccountId, debitMinor: totalPrincipal, creditMinor: 0, description: "Loan Funds Received" },
          { financialAccountId: liabilityAcc.id, debitMinor: 0, creditMinor: totalPrincipal, description: "Loan Principal Liability" },
        ],
        userId: input.userId,
      },
      db
    );

    // 3. Create Loan Record
    const approxMonthlyInterest = Math.round(totalPrincipal * monthlyRate);
    const monthlyInstallment = principalPerMonth + approxMonthlyInterest;

    const loanRes = await db.query<LoanRow>(
      `INSERT INTO accounting_loans
         (workspace_id, loan_name, lender_contact_id, liability_account_id, disbursement_account_id,
          principal_minor, interest_rate_percent, tenure_months, start_date, monthly_installment_minor, remaining_principal_minor, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $6, 'ACTIVE')
       RETURNING *`,
      [
        input.workspaceId,
        input.loanName.trim(),
        input.lenderContactId || null,
        liabilityAcc.id,
        input.disbursementAccountId,
        totalPrincipal,
        annualRate,
        input.tenureMonths,
        startDate,
        monthlyInstallment,
      ]
    );
    const loan = loanRes.rows[0];

    // 4. Generate Schedule of Installments
    const installments: LoanInstallmentRow[] = [];
    const baseDate = new Date(startDate);

    for (let i = 1; i <= input.tenureMonths; i++) {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      const dueDateStr = dueDate.toISOString().slice(0, 10);

      // Remaining principal for reducing interest calculation
      const curRemaining = Math.max(0, totalPrincipal - (i - 1) * principalPerMonth);
      const interestMinor = Math.round(curRemaining * monthlyRate);
      const pMinor = i === input.tenureMonths ? totalPrincipal - (input.tenureMonths - 1) * principalPerMonth : principalPerMonth;
      const tMinor = pMinor + interestMinor;

      const instRes = await db.query<LoanInstallmentRow>(
        `INSERT INTO accounting_loan_installments
           (loan_id, installment_number, due_date, principal_minor, interest_minor, total_minor, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
         RETURNING *`,
        [loan.id, i, dueDateStr, pMinor, interestMinor, tMinor]
      );
      installments.push(instRes.rows[0]);
    }

    return { loan, installments };
  });
}

/**
 * Record an installment EMI payment.
 * Debits Loans Payable (reduces liability by principal)
 * Debits Interest Expense (5100, recognizes interest expense)
 * Credits Cash/Bank (total payment outflow)
 */
export async function recordLoanInstallmentPayment(
  input: RecordInstallmentPaymentInput,
  client?: Queryable
): Promise<{ installment: LoanInstallmentRow; loan: LoanRow }> {
  const paidDate = input.paidDate || new Date().toISOString().slice(0, 10);

  return withTransaction(async (db) => {
    // 1. Fetch loan and installment
    const loanRes = await db.query<LoanRow>(
      `SELECT * FROM accounting_loans WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
      [input.loanId, input.workspaceId]
    );
    const loan = loanRes.rows[0];
    if (!loan) throw new Error("Loan not found.");

    const instRes = await db.query<LoanInstallmentRow>(
      `SELECT * FROM accounting_loan_installments WHERE loan_id = $1 AND installment_number = $2 FOR UPDATE`,
      [input.loanId, input.installmentNumber]
    );
    const inst = instRes.rows[0];
    if (!inst) throw new Error("Installment not found.");
    if (inst.status === "PAID") throw new Error("Installment is already paid.");

    const principalMinor = Number(inst.principal_minor);
    const interestMinor = Number(inst.interest_minor);
    const totalMinor = principalMinor + interestMinor;

    // 2. Resolve Interest Expense (5100) and Loans Payable (2500)
    const interestAcc = await getFinancialAccountByCode(input.workspaceId, "5100", db);
    if (!interestAcc) throw new Error("Interest expense account (5100) not found.");

    const lines = [
      { financialAccountId: loan.liability_account_id, debitMinor: principalMinor, creditMinor: 0, description: `Loan Principal Repayment (EMI #${inst.installment_number})` },
      { financialAccountId: input.financialAccountId, debitMinor: 0, creditMinor: totalMinor, description: `EMI Payment for ${loan.loan_name}` },
    ];

    if (interestMinor > 0) {
      lines.splice(1, 0, {
        financialAccountId: interestAcc.id,
        debitMinor: interestMinor,
        creditMinor: 0,
        description: `Loan Interest Expense (EMI #${inst.installment_number})`,
      });
    }

    // 3. Post Journal Entry
    const { entry } = await postJournalEntry(
      {
        workspaceId: input.workspaceId,
        entryType: "LOAN_REPAYMENT",
        entryDate: paidDate,
        description: `Loan Repayment: ${loan.loan_name} (EMI #${inst.installment_number})`,
        sourceType: "LOAN_INSTALLMENT",
        sourceId: inst.id,
        lines,
        userId: input.userId,
      },
      db
    );

    // 4. Update Installment
    const updatedInst = (
      await db.query<LoanInstallmentRow>(
        `UPDATE accounting_loan_installments
         SET status = 'PAID', paid_date = $1, journal_entry_id = $2
         WHERE id = $3
         RETURNING *`,
        [paidDate, entry.id, inst.id]
      )
    ).rows[0];

    // 5. Update Loan remaining principal
    const newRemaining = Math.max(0, Number(loan.remaining_principal_minor) - principalMinor);
    const newStatus = newRemaining === 0 ? "PAID_OFF" : "ACTIVE";

    const updatedLoan = (
      await db.query<LoanRow>(
        `UPDATE accounting_loans
         SET remaining_principal_minor = $1, status = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [newRemaining, newStatus, loan.id]
      )
    ).rows[0];

    return { installment: updatedInst, loan: updatedLoan };
  });
}

export async function listLoans(
  workspaceId: string
): Promise<Array<LoanRow & { lender_name?: string }>> {
  const query = `
    SELECT l.*, c.name as lender_name
    FROM accounting_loans l
    LEFT JOIN accounting_contacts c ON c.id = l.lender_contact_id
    WHERE l.workspace_id = $1
    ORDER BY l.created_at DESC
  `;
  const res = await pool.query<LoanRow & { lender_name?: string }>(query, [workspaceId]);
  return res.rows;
}

export async function getLoanDetails(
  workspaceId: string,
  loanId: string
): Promise<{ loan: LoanRow; installments: LoanInstallmentRow[] } | null> {
  const loanRes = await pool.query<LoanRow>(
    `SELECT * FROM accounting_loans WHERE id = $1 AND workspace_id = $2 LIMIT 1`,
    [loanId, workspaceId]
  );
  const loan = loanRes.rows[0];
  if (!loan) return null;

  const instRes = await pool.query<LoanInstallmentRow>(
    `SELECT * FROM accounting_loan_installments WHERE loan_id = $1 ORDER BY installment_number ASC`,
    [loanId]
  );
  return { loan, installments: instRes.rows };
}
