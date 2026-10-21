import pg from "pg";
import { config } from "dotenv";
import { createRequire } from "node:module";

config({ path: ".env" });

const require = createRequire(import.meta.url);
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
    path: serverOnlyPath,
    children: [],
    paths: [],
  };
} catch (_) {}

const DATABASE_URL = process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: DATABASE_URL });

const { postJournalEntry, reverseJournalEntry } = await import("../src/lib/accounting/ledger.ts");
const { getFinancialAccountByCode } = await import("../src/lib/accounting/accounts.ts");

const isApply = process.argv.includes("--apply");

async function reconcileAndRepair() {
  console.log(`\n======================================================`);
  console.log(`ZAPPIT ACCOUNTING: COLLECTIONS RECONCILIATION & REPAIR`);
  console.log(`Mode: ${isApply ? "APPLY (WRITING AUDITED CORRECTIONS)" : "DRY RUN (READ-ONLY AUDIT)"}`);
  console.log(`======================================================\n`);

  const client = await pool.connect();

  try {
    if (isApply) {
      await client.query("BEGIN");
    }

    // 1. Audit all unallocated payments across the system
    const unallocatedRes = await client.query(`
      SELECT p.id, p.workspace_id, w.name as workspace_name, p.payment_number, p.type, p.amount_minor, p.notes, p.journal_entry_id, p.created_at,
             (SELECT COUNT(*) FROM accounting_payment_allocations a WHERE a.payment_id = p.id) as alloc_count
      FROM accounting_payments p
      LEFT JOIN accounting_workspaces w ON w.id = p.workspace_id
      WHERE (SELECT COUNT(*) FROM accounting_payment_allocations a WHERE a.payment_id = p.id) = 0
      ORDER BY p.created_at ASC
    `);

    console.log(`Found ${unallocatedRes.rows.length} unallocated payment records across the database:\n`);
    for (const p of unallocatedRes.rows) {
      console.log(` - Payment: ${p.payment_number} | Amount: ₹${(Number(p.amount_minor) / 100).toFixed(2)} | Notes: "${p.notes}" | Workspace: ${p.workspace_name}`);
    }

    // 2. Identify the target affected records in workspace 456282b7-3c7e-4986-a7ea-6a204e906a76
    const wsId = "456282b7-3c7e-4986-a7ea-6a204e906a76";
    const accountsBefore = await client.query(
      `SELECT code, name, current_balance_minor FROM accounting_financial_accounts WHERE workspace_id = $1 ORDER BY code ASC`,
      [wsId]
    );

    console.log(`\n--- Workspace Financial Account Balances (BEFORE) ---`);
    for (const a of accountsBefore.rows) {
      console.log(` [${a.code}] ${a.name}: ₹${(Number(a.current_balance_minor) / 100).toFixed(2)}`);
    }

    const test01InvRes = await client.query(
      `SELECT * FROM accounting_invoices WHERE workspace_id = $1 AND invoice_number = 'INV-2026-TEST01'`,
      [wsId]
    );
    const inv0002Res = await client.query(
      `SELECT * FROM accounting_invoices WHERE workspace_id = $1 AND invoice_number = 'INV-2026-0002'`,
      [wsId]
    );

    const test01Inv = test01InvRes.rows[0];
    const inv0002 = inv0002Res.rows[0];

    console.log(`\n--- Target Invoices State (BEFORE) ---`);
    if (test01Inv) {
      console.log(` INV-2026-TEST01: Total ₹${(Number(test01Inv.total_minor) / 100).toFixed(2)} | Paid ₹${(Number(test01Inv.amount_paid_minor) / 100).toFixed(2)} | Due ₹${(Number(test01Inv.amount_due_minor) / 100).toFixed(2)} | Status: ${test01Inv.status}`);
    }
    if (inv0002) {
      console.log(` INV-2026-0002:   Total ₹${(Number(inv0002.total_minor) / 100).toFixed(2)} | Paid ₹${(Number(inv0002.amount_paid_minor) / 100).toFixed(2)} | Due ₹${(Number(inv0002.amount_due_minor) / 100).toFixed(2)} | Status: ${inv0002.status}`);
    }

    if (isApply) {
      console.log(`\n--- EXECUTING TRACEABLE AUDITED REPAIR ---`);

      // 1. Repair INV-2026-TEST01: link the unallocated ₹6,000 payment (PAY-IN-2026-0002)
      const payTest01 = unallocatedRes.rows.find((p) => p.payment_number === "PAY-IN-2026-0002");
      if (payTest01 && test01Inv && Number(test01Inv.amount_due_minor) === 600000) {
        console.log(`\n1. Linking Payment ${payTest01.payment_number} (₹6,000) to INV-2026-TEST01...`);
        await client.query(
          `INSERT INTO accounting_payment_allocations (payment_id, invoice_id, allocated_minor)
           VALUES ($1, $2, $3)`,
          [payTest01.id, test01Inv.id, 600000]
        );
        await client.query(
          `UPDATE accounting_invoices
           SET amount_paid_minor = total_minor, amount_due_minor = 0, status = 'PAID', updated_at = NOW()
           WHERE id = $1`,
          [test01Inv.id]
        );
        console.log(`   -> Linked allocation created. INV-2026-TEST01 status updated to PAID (Due: ₹0.00).`);
      }

      // 2. Repair INV-2026-0002:
      // a) Atomically issue DRAFT invoice (post SALE entry: AR Dr 1200, Revenue Cr 4000)
      if (inv0002 && inv0002.status === "DRAFT") {
        console.log(`\n2a. Atomically issuing DRAFT invoice INV-2026-0002 (₹12,00,000)...`);
        const arAcc = await getFinancialAccountByCode(wsId, "1200", client);
        const revAcc = await getFinancialAccountByCode(wsId, "4000", client);

        const { entry: saleEntry } = await postJournalEntry(
          {
            workspaceId: wsId,
            entryType: "SALE",
            entryDate: inv0002.issue_date || "2026-10-20",
            description: `Invoice ${inv0002.invoice_number} issued upon collection`,
            reference: inv0002.invoice_number,
            sourceType: "INVOICE",
            sourceId: inv0002.id,
            lines: [
              { financialAccountId: arAcc.id, debitMinor: Number(inv0002.total_minor), creditMinor: 0, description: "Accounts Receivable" },
              { financialAccountId: revAcc.id, debitMinor: 0, creditMinor: Number(inv0002.total_minor), description: "Sales Revenue" },
            ],
          },
          client
        );

        await client.query(
          `UPDATE accounting_invoices
           SET status = 'ISSUED', posted_journal_entry_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [saleEntry.id, inv0002.id]
        );
        console.log(`    -> Accrual SALE entry posted: ${saleEntry.entry_number}. AR Debited ₹12,00,000, Revenue Credited ₹12,00,000.`);
      }

      // b) Link the first valid payment (PAY-IN-2026-0003) for ₹12,00,000
      const validPay0003 = unallocatedRes.rows.find((p) => p.payment_number === "PAY-IN-2026-0003");
      if (validPay0003 && inv0002) {
        console.log(`\n2b. Linking valid collection payment ${validPay0003.payment_number} (₹12,00,000) to INV-2026-0002...`);
        await client.query(
          `INSERT INTO accounting_payment_allocations (payment_id, invoice_id, allocated_minor)
           VALUES ($1, $2, $3)`,
          [validPay0003.id, inv0002.id, 120000000]
        );
        await client.query(
          `UPDATE accounting_invoices
           SET amount_paid_minor = 120000000, amount_due_minor = 0, status = 'PAID', updated_at = NOW()
           WHERE id = $1`,
          [inv0002.id]
        );
        console.log(`    -> Linked allocation created. INV-2026-0002 status updated to PAID (Due: ₹0.00).`);
      }

      // c) Traceably reverse the 3 duplicate payments (PAY-IN-2026-0004, 0005, 0006)
      const duplicatePayments = unallocatedRes.rows.filter((p) =>
        ["PAY-IN-2026-0004", "PAY-IN-2026-0005", "PAY-IN-2026-0006"].includes(p.payment_number)
      );

      console.log(`\n2c. Traceably reversing 3 duplicate payments...`);
      for (const dup of duplicatePayments) {
        if (dup.journal_entry_id) {
          const { reversalEntry } = await reverseJournalEntry(
            wsId,
            dup.journal_entry_id,
            `Duplicate collection submission on ${inv0002.invoice_number}`,
            undefined,
            client
          );
          await client.query(
            `UPDATE accounting_payments
             SET notes = COALESCE(notes, '') || ' [REVERSED: Duplicate collection on ${inv0002.invoice_number}]', updated_at = NOW()
             WHERE id = $1`,
            [dup.id]
          );
          console.log(`    -> Payment ${dup.payment_number} (₹12,00,000): Reversal Entry ${reversalEntry.entry_number} posted. Bank Credited ₹12,00,000, AR Debited ₹12,00,000.`);
        }
      }

      await client.query("COMMIT");
      console.log(`\n=== TRANSACTION COMMITTED SUCCESSFULLY ===`);

      // Verify post-repair state
      const accountsAfter = await client.query(
        `SELECT code, name, current_balance_minor FROM accounting_financial_accounts WHERE workspace_id = $1 ORDER BY code ASC`,
        [wsId]
      );
      console.log(`\n--- Workspace Financial Account Balances (AFTER REPAIR) ---`);
      for (const a of accountsAfter.rows) {
        console.log(` [${a.code}] ${a.name}: ₹${(Number(a.current_balance_minor) / 100).toFixed(2)}`);
      }

      const invAfter = await client.query(
        `SELECT invoice_number, total_minor, amount_paid_minor, amount_due_minor, status FROM accounting_invoices WHERE workspace_id = $1 ORDER BY invoice_number ASC`,
        [wsId]
      );
      console.log(`\n--- Target Invoices State (AFTER REPAIR) ---`);
      for (const inv of invAfter.rows) {
        console.log(` ${inv.invoice_number}: Total ₹${(Number(inv.total_minor) / 100).toFixed(2)} | Paid ₹${(Number(inv.amount_paid_minor) / 100).toFixed(2)} | Due ₹${(Number(inv.amount_due_minor) / 100).toFixed(2)} | Status: ${inv.status}`);
      }
    } else {
      console.log(`\nTo execute these repairs with full transactional safety and traceable reversals, run with --apply flag.`);
    }
  } catch (err) {
    if (isApply) {
      await client.query("ROLLBACK");
      console.error("\n❌ Transaction rolled back due to error:", err);
    } else {
      console.error("\n❌ Error during audit:", err);
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

reconcileAndRepair().catch(console.error);
