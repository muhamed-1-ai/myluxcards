import assert from "node:assert/strict";
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

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/myluxcards";
const pool = new pg.Pool({ connectionString });

async function runTests() {
  console.log("=== Running Purchases Accounting System Verification Suite ===");

  const {
    createPurchase,
    recordPurchasePayment,
    updateDraftPurchase,
    updatePurchaseMetadata,
    voidPurchase,
    restorePurchase,
    listPurchases,
    getPurchaseById,
  } = await import("../src/lib/accounting/purchases.ts");

  const {
    getFinancialAccountByCode,
    seedDefaultChartOfAccounts,
  } = await import("../src/lib/accounting/accounts.ts");

  // Get a user ID to own the test workspaces
  const userRes = await pool.query(`SELECT id FROM users LIMIT 1`);
  const userId = userRes.rows[0]?.id;
  assert.ok(userId, "A user must exist in the database for test workspace creation");

  // Create two distinct test workspaces to verify workspace isolation
  const wsARes = await pool.query(
    `INSERT INTO accounting_workspaces (owner_user_id, name, currency)
     VALUES ($1, 'Purchases Test WS A', 'INR')
     RETURNING id, name, currency`,
    [userId]
  );
  const workspaceA = wsARes.rows[0];

  const wsBRes = await pool.query(
    `INSERT INTO accounting_workspaces (owner_user_id, name, currency)
     VALUES ($1, 'Purchases Test WS B', 'INR')
     RETURNING id, name, currency`,
    [userId]
  );
  const workspaceB = wsBRes.rows[0];

  console.log(`Created test workspaces: A=${workspaceA.id}, B=${workspaceB.id}`);

  try {
    // Ensure default ledger accounts in both workspaces
    await seedDefaultChartOfAccounts(workspaceA.id);
    await seedDefaultChartOfAccounts(workspaceB.id);

    const cashA = await getFinancialAccountByCode(workspaceA.id, "1010");
    const bankA = await getFinancialAccountByCode(workspaceA.id, "1020");
    const apA = await getFinancialAccountByCode(workspaceA.id, "2000");
    const expenseA = await getFinancialAccountByCode(workspaceA.id, "5000");

    assert.ok(cashA, "Cash account (1010) must exist");
    assert.ok(bankA, "Bank account (1020) must exist");
    assert.ok(apA, "Accounts Payable (2000) must exist");
    assert.ok(expenseA, "Operating Expense (5000) must exist");

    // Create a supplier contact in Workspace A
    const suppRes = await pool.query(
      `INSERT INTO accounting_contacts (workspace_id, name, type, email, total_payable_minor)
       VALUES ($1, 'Acme Suppliers Ltd', 'VENDOR', 'supplier@acme.test', 0)
       RETURNING id, name, total_payable_minor`,
      [workspaceA.id]
    );
    const supplierA = suppRes.rows[0];
    console.log(`Created supplier: ${supplierA.name} (${supplierA.id})`);

    // Helper to get fresh account balance
    const getBalance = async (accountId) => {
      const r = await pool.query(`SELECT current_balance_minor FROM accounting_financial_accounts WHERE id = $1`, [accountId]);
      return Number(r.rows[0].current_balance_minor);
    };

    // Helper to get supplier I Owe
    const getSupplierPayable = async (contactId) => {
      const r = await pool.query(`SELECT total_payable_minor FROM accounting_contacts WHERE id = $1`, [contactId]);
      return Number(r.rows[0].total_payable_minor);
    };

    const initialCash = await getBalance(cashA.id);
    const initialBank = await getBalance(bankA.id);
    console.log(`Initial balances - Cash: ${initialCash}, Bank: ${initialBank}`);

    // =========================================================================
    // TEST 1: Unsupported Inventory / Equipment Accounting Treatment Error
    // =========================================================================
    console.log("\n[Test 1] Unsupported Classification Guard:");
    let classificationErrorThrown = false;
    try {
      await createPurchase({
        workspaceId: workspaceA.id,
        supplierId: supplierA.id,
        purchaseDate: "2026-10-30",
        purchaseType: "INVENTORY",
        lines: [{ description: "Raw material batch", quantity: 10, unitPriceMinor: 10000 }],
        status: "UNPAID",
      });
    } catch (err) {
      classificationErrorThrown = true;
      assert.match(err.message, /Unsupported accounting treatment.*inventory/i);
      console.log("  ✓ Unsupported INVENTORY classification correctly rejected with explicit explanation");
    }
    assert.equal(classificationErrorThrown, true, "Must reject unsupported purchaseType");

    // =========================================================================
    // TEST 2: Draft Purchase (No GL or Balance Impact)
    // =========================================================================
    console.log("\n[Test 2] Draft Purchase Lifecycle:");
    const draftRes = await createPurchase({
      workspaceId: workspaceA.id,
      supplierId: supplierA.id,
      purchaseDate: "2026-10-30",
      supplierBillNumber: "BILL-DRAFT-01",
      lines: [
        { description: "Office desks draft line 1", quantity: 2, unitPriceMinor: 500000 },
        { description: "Office chairs draft line 2", quantity: 4, unitPriceMinor: 150000 },
      ],
      status: "DRAFT",
      notes: "Initial draft quote",
    });

    const draft = draftRes.purchase;
    assert.equal(draft.status, "DRAFT");
    assert.equal(Number(draft.total_minor), 1600000); // 2*5000 + 4*1500 = 16000
    assert.equal(Number(draft.amount_paid_minor), 0);
    assert.equal(Number(draft.amount_due_minor), 1600000);
    assert.equal(draft.posted_journal_entry_id, null, "Draft must have no posted journal entry");
    assert.equal(draft.transaction_id, null, "Draft must have no linked active transaction");

    // Balances and supplier payable must be completely unaffected
    assert.equal(await getBalance(cashA.id), initialCash, "Cash balance unaffected by draft");
    assert.equal(await getBalance(bankA.id), initialBank, "Bank balance unaffected by draft");
    assert.equal(await getSupplierPayable(supplierA.id), 0, "Supplier payable unaffected by draft");
    console.log("  ✓ Draft purchase created without affecting GL, balances, or supplier I Owe");

    // Update draft purchase
    const updatedDraftRes = await updateDraftPurchase({
      purchaseId: draft.id,
      workspaceId: workspaceA.id,
      supplierId: supplierA.id,
      purchaseDate: "2026-10-31",
      supplierBillNumber: "BILL-DRAFT-01-REV",
      lines: [
        { description: "Office desks amended line", quantity: 1, unitPriceMinor: 500000 },
      ],
      notes: "Updated draft quote single desk",
    });
    const updatedDraft = updatedDraftRes.purchase;
    assert.equal(Number(updatedDraft.total_minor), 500000);
    assert.equal(updatedDraft.supplier_bill_number, "BILL-DRAFT-01-REV");
    console.log("  ✓ Draft purchase lines and bill number updated successfully");

    // =========================================================================
    // TEST 3: Unpaid Purchase Posting (Expense Dr, AP Cr, I Owe updated, Cash/Bank unchanged)
    // =========================================================================
    console.log("\n[Test 3] Posting Unpaid Purchase:");
    const unpaidRes = await createPurchase({
      workspaceId: workspaceA.id,
      supplierId: supplierA.id,
      purchaseDate: "2026-10-30",
      supplierBillNumber: "BILL-UNPAID-100",
      dueDate: "2026-11-15",
      lines: [
        { description: "Consulting and server maintenance", quantity: 1, unitPriceMinor: 500000 }, // ₹5,000
      ],
      status: "UNPAID",
      notes: "Unpaid vendor bill",
    });

    const unpaid = unpaidRes.purchase;
    assert.equal(unpaid.status, "UNPAID");
    assert.equal(Number(unpaid.total_minor), 500000);
    assert.equal(Number(unpaid.amount_paid_minor), 0);
    assert.equal(Number(unpaid.amount_due_minor), 500000);
    assert.ok(unpaid.posted_journal_entry_id, "Posted purchase must have journal_entry_id");
    assert.ok(unpaid.transaction_id, "Posted purchase must link to accounting_transactions");

    // Check journal entries for unpaid purchase
    const unpaidJournalLines = await pool.query(
      `SELECT jl.*, a.code as account_code
       FROM accounting_journal_lines jl
       JOIN accounting_financial_accounts a ON a.id = jl.financial_account_id
       WHERE jl.journal_entry_id = $1
       ORDER BY jl.debit_minor DESC`,
      [unpaid.posted_journal_entry_id]
    );
    assert.equal(unpaidJournalLines.rows.length, 2, "Unpaid bill must have 2 lines");
    assert.equal(unpaidJournalLines.rows[0].account_code, "5000", "Debit to 5000 Operating Expense");
    assert.equal(Number(unpaidJournalLines.rows[0].debit_minor), 500000);
    assert.equal(unpaidJournalLines.rows[1].account_code, "2000", "Credit to 2000 Accounts Payable");
    assert.equal(Number(unpaidJournalLines.rows[1].credit_minor), 500000);

    // Cash and Bank must NOT be reduced
    assert.equal(await getBalance(cashA.id), initialCash, "Cash in Hand must NOT decrease on unpaid bill");
    assert.equal(await getBalance(bankA.id), initialBank, "Bank Account must NOT decrease on unpaid bill");

    // Supplier I Owe must increase by ₹5,000
    assert.equal(await getSupplierPayable(supplierA.id), 500000, "Supplier I Owe must increase by ₹5,000");
    console.log("  ✓ Unpaid purchase posted: Expense Dr ₹5,000, AP Cr ₹5,000; Cash/Bank unchanged; Supplier I Owe = ₹5,000");

    // =========================================================================
    // TEST 4: The Prompt's Exact Specification:
    // A purchase totals ₹5,000. The customer pays ₹3,000 from Bank Account.
    // Expected result:
    // - Purchase total: ₹5,000.
    // - Paid: ₹3,000.
    // - Outstanding: ₹2,000.
    // - Bank Account decreases by ₹3,000.
    // - The supplier shows ₹2,000 under People → I Owe.
    // =========================================================================
    console.log("\n[Test 4] Prompt Specification: ₹5,000 Purchase with ₹3,000 Bank Payment:");
    const partialRes = await createPurchase({
      workspaceId: workspaceA.id,
      supplierId: supplierA.id,
      purchaseDate: "2026-10-30",
      supplierBillNumber: "BILL-PROMPT-5000",
      dueDate: "2026-11-30",
      lines: [
        { description: "Hardware & cloud services", quantity: 1, unitPriceMinor: 500000 }, // ₹5,000
      ],
      status: "PARTIALLY_PAID",
      initialPayment: {
        accountId: bankA.id,
        amountMinor: 300000, // ₹3,000
        paymentDate: "2026-10-30",
        paymentMethod: "BANK_TRANSFER",
        reference: "BANK-TX-3000",
      },
      notes: "Partially paid purchase as per user specification",
    });

    const partial = partialRes.purchase;
    assert.equal(partial.status, "PARTIALLY_PAID");
    assert.equal(Number(partial.total_minor), 500000, "Purchase total must be ₹5,000 (500000 minor)");
    assert.equal(Number(partial.amount_paid_minor), 300000, "Paid must be ₹3,000 (300000 minor)");
    assert.equal(Number(partial.amount_due_minor), 200000, "Outstanding must be ₹2,000 (200000 minor)");

    // Bank Account decreases by ₹3,000
    const bankAfterInitial = await getBalance(bankA.id);
    assert.equal(bankAfterInitial, initialBank - 300000, "Bank Account must decrease by exactly ₹3,000");

    // Supplier I Owe:
    // Started at 0, +5000 from Test 3, + (5000 - 3000 = 2000) from Test 4 = 7000
    // Specifically for this supplier, let's verify individual purchase balance due is ₹2,000
    assert.equal(Number(partial.amount_due_minor), 200000);
    const supplierPayableAfterPartial = await getSupplierPayable(supplierA.id);
    assert.equal(supplierPayableAfterPartial, 500000 + 200000, "Supplier I Owe increased by exactly ₹2,000 outstanding for this purchase");
    console.log("  ✓ Total: ₹5,000, Paid: ₹3,000, Outstanding: ₹2,000, Bank decreased by ₹3,000, Supplier I Owe updated by ₹2,000");

    // =========================================================================
    // TEST 5: Paying the remaining ₹2,000 later settles without recording cost again
    // =========================================================================
    console.log("\n[Test 5] Paying remaining ₹2,000 later from Cash in Hand:");
    const cashBeforeSettlement = await getBalance(cashA.id);

    const settlementRes = await recordPurchasePayment({
      purchaseId: partial.id,
      workspaceId: workspaceA.id,
      accountId: cashA.id,
      amountMinor: 200000, // ₹2,000
      paymentDate: "2026-11-05",
      paymentMethod: "CASH",
      reference: "CASH-SETTLE-2000",
      notes: "Final settlement of BILL-PROMPT-5000",
    });

    const settled = settlementRes.purchase;
    assert.equal(settled.status, "PAID");
    assert.equal(Number(settled.total_minor), 500000);
    assert.equal(Number(settled.amount_paid_minor), 500000);
    assert.equal(Number(settled.amount_due_minor), 0);

    // Cash in Hand decreases by ₹2,000
    const cashAfterSettlement = await getBalance(cashA.id);
    assert.equal(cashAfterSettlement, cashBeforeSettlement - 200000, "Cash in Hand must decrease by ₹2,000");

    // Bank Account unchanged from previous step
    assert.equal(await getBalance(bankA.id), bankAfterInitial, "Bank Account remains unchanged by cash settlement");

    // Supplier I Owe decreased by ₹2,000
    assert.equal(await getSupplierPayable(supplierA.id), supplierPayableAfterPartial - 200000, "Supplier I Owe decreased by ₹2,000");

    // Verify no duplicate expense created!
    // Check total expense debits in the journal for this purchase:
    const purchaseExpenses = await pool.query(
      `SELECT SUM(jl.debit_minor)::bigint as total_expense_debit
       FROM accounting_journal_lines jl
       JOIN accounting_financial_accounts a ON a.id = jl.financial_account_id
       WHERE a.code = '5000'
         AND jl.journal_entry_id = $1`,
      [partial.posted_journal_entry_id]
    );
    assert.equal(Number(purchaseExpenses.rows[0].total_expense_debit), 500000, "Expense recorded EXACTLY ONCE for ₹5,000");

    // And verify settlement payment journal entry only debited AP and credited Cash
    const settlementJournal = await pool.query(
      `SELECT jl.*, a.code as account_code
       FROM accounting_journal_lines jl
       JOIN accounting_financial_accounts a ON a.id = jl.financial_account_id
       WHERE jl.journal_entry_id = $1
       ORDER BY jl.debit_minor DESC`,
      [settlementRes.payment.journal_entry_id]
    );
    assert.equal(settlementJournal.rows[0].account_code, "2000", "Settlement Debits AP (2000)");
    assert.equal(Number(settlementJournal.rows[0].debit_minor), 200000);
    assert.equal(settlementJournal.rows[1].account_code, "1010", "Settlement Credits Cash (1010)");
    assert.equal(Number(settlementJournal.rows[1].credit_minor), 200000);
    console.log("  ✓ Later settlement completed: Status=PAID, Outstanding=0, Cash decreased by ₹2,000, NO duplicate expense");

    // =========================================================================
    // TEST 6: Payment Restrictions (Only Cash 1010 or Bank 1020, Overpayment rejected)
    // =========================================================================
    console.log("\n[Test 6] Payment Restrictions & Safeguards:");
    // 6A. Non-payment account (e.g., Accounts Payable or Accounts Receivable)
    let nonPaymentErrorThrown = false;
    try {
      await recordPurchasePayment({
        purchaseId: unpaid.id,
        workspaceId: workspaceA.id,
        accountId: apA.id, // Not a payment account
        amountMinor: 100000,
        paymentDate: "2026-10-30",
      });
    } catch (err) {
      nonPaymentErrorThrown = true;
      assert.match(err.message, /Cash in Hand.*Bank Account/i);
      console.log("  ✓ Payments from accounts other than Cash/Bank strictly blocked");
    }
    assert.equal(nonPaymentErrorThrown, true);

    // 6B. Overpayment protection
    let overpaymentErrorThrown = false;
    try {
      await recordPurchasePayment({
        purchaseId: unpaid.id, // outstanding is 500000
        workspaceId: workspaceA.id,
        accountId: bankA.id,
        amountMinor: 600000, // ₹6,000 > ₹5,000
        paymentDate: "2026-10-30",
      });
    } catch (err) {
      overpaymentErrorThrown = true;
      assert.match(err.message, /Overpayment prevented/i);
      console.log("  ✓ Overpayment rejected: cannot pay more than outstanding balance");
    }
    assert.equal(overpaymentErrorThrown, true);

    // 6C. Payment on fully settled purchase rejected
    let paidSettledErrorThrown = false;
    try {
      await recordPurchasePayment({
        purchaseId: partial.id, // Already fully paid in Test 5
        workspaceId: workspaceA.id,
        accountId: bankA.id,
        amountMinor: 10000,
        paymentDate: "2026-10-30",
      });
    } catch (err) {
      paidSettledErrorThrown = true;
      assert.match(err.message, /already fully paid/i);
      console.log("  ✓ Additional payment on settled purchase rejected");
    }
    assert.equal(paidSettledErrorThrown, true);

    // =========================================================================
    // TEST 7: Idempotency & Duplicate Payment Guard
    // =========================================================================
    console.log("\n[Test 7] Payment Idempotency Guard:");
    const idemKey = `test-idem-${Date.now()}`;
    const pay1 = await recordPurchasePayment({
      purchaseId: unpaid.id,
      workspaceId: workspaceA.id,
      accountId: bankA.id,
      amountMinor: 100000,
      paymentDate: "2026-10-30",
      idempotencyKey: idemKey,
    });

    const pay2 = await recordPurchasePayment({
      purchaseId: unpaid.id,
      workspaceId: workspaceA.id,
      accountId: bankA.id,
      amountMinor: 100000,
      paymentDate: "2026-10-30",
      idempotencyKey: idemKey,
    });
    assert.equal(pay1.payment.id, pay2.payment.id, "Duplicate submission with same idempotency key returns same payment without double posting");
    console.log("  ✓ Duplicate submission protection verified");

    // =========================================================================
    // TEST 8: Attachment-only Metadata Updates
    // =========================================================================
    console.log("\n[Test 8] Attachment and Metadata Updates without Balance/GL Changes:");
    const bankBeforeMeta = await getBalance(bankA.id);
    const updatedMeta = await updatePurchaseMetadata({
      purchaseId: partial.id,
      workspaceId: workspaceA.id,
      notes: "Updated delivery notes with receipt verified",
    });
    assert.equal(updatedMeta.notes, "Updated delivery notes with receipt verified");
    assert.equal(await getBalance(bankA.id), bankBeforeMeta, "Balance completely unaffected by metadata update");
    console.log("  ✓ Metadata and notes updated without reposting journals or altering balances");

    // =========================================================================
    // TEST 9: Voiding with Coordinated Reversal of Purchase and Linked Payments
    // =========================================================================
    console.log("\n[Test 9] Voiding and Financial Reversal:");
    // Create a new purchase with payment specifically to test voiding
    const toVoidRes = await createPurchase({
      workspaceId: workspaceA.id,
      supplierId: supplierA.id,
      purchaseDate: "2026-10-30",
      supplierBillNumber: "BILL-TO-VOID",
      lines: [{ description: "Equipment to cancel", quantity: 1, unitPriceMinor: 200000 }],
      status: "PARTIALLY_PAID",
      initialPayment: {
        accountId: bankA.id,
        amountMinor: 100000,
        paymentDate: "2026-10-30",
        paymentMethod: "BANK_TRANSFER",
      },
    });

    const toVoid = toVoidRes.purchase;
    const bankBeforeVoid = await getBalance(bankA.id);
    const supplierPayableBeforeVoid = await getSupplierPayable(supplierA.id);

    const voided = await voidPurchase(workspaceA.id, toVoid.id, "Order cancelled by supplier", userId);
    assert.equal(voided.status, "VOIDED");
    assert.ok(voided.voided_at);
    assert.equal(voided.void_reason, "Order cancelled by supplier");

    // Bank Account should be restored by ₹1,000 (100000 minor)
    const bankAfterVoid = await getBalance(bankA.id);
    assert.equal(bankAfterVoid, bankBeforeVoid + 100000, "Bank Account restored by reversing the payment");

    // Supplier I Owe should be reduced by the net payable of the voided bill (₹1,000)
    const supplierPayableAfterVoid = await getSupplierPayable(supplierA.id);
    assert.equal(supplierPayableAfterVoid, supplierPayableBeforeVoid - 100000, "Supplier payable reversed");

    // Verify linked transaction in accounting_transactions is marked VOIDED
    const linkedTxVoidCheck = await pool.query(
      `SELECT status FROM accounting_transactions WHERE purchase_id = $1`,
      [toVoid.id]
    );
    assert.equal(linkedTxVoidCheck.rows[0].status, "VOIDED", "Linked transaction moved to VOIDED");
    console.log("  ✓ Purchase and linked payments reversed, Bank Account restored, and transaction moved to VOIDED");

    // =========================================================================
    // TEST 10: Restore Behavior
    // =========================================================================
    console.log("\n[Test 10] Restore Voided Purchase:");
    const restored = await restorePurchase(workspaceA.id, toVoid.id, userId);
    assert.equal(restored.status, "UNPAID");
    assert.equal(restored.voided_at, null);
    assert.equal(Number(restored.amount_due_minor), 200000);

    // Supplier payable is reinstated
    assert.equal(await getSupplierPayable(supplierA.id), supplierPayableBeforeVoid + 100000, "Supplier payable reinstated upon restore");

    // Restoring an already active purchase should be guarded against
    let doubleRestoreError = false;
    try {
      await restorePurchase(workspaceA.id, toVoid.id, userId);
    } catch (err) {
      doubleRestoreError = true;
      assert.match(err.message, /cannot be restored/i);
      console.log("  ✓ Double-restoration safeguard active");
    }
    assert.equal(doubleRestoreError, true);

    // =========================================================================
    // TEST 11: Workspace Isolation
    // =========================================================================
    console.log("\n[Test 11] Workspace Isolation:");
    // Attempt to access Workspace A purchase using Workspace B
    const bFetch = await getPurchaseById(workspaceB.id, partial.id);
    assert.equal(bFetch, null, "Workspace B cannot view Workspace A purchase");

    // Attempt to record payment against Workspace A purchase from Workspace B
    let crossWorkspaceError = false;
    try {
      const bankB = await getFinancialAccountByCode(workspaceB.id, "1020");
      await recordPurchasePayment({
        purchaseId: partial.id,
        workspaceId: workspaceB.id,
        accountId: bankB.id,
        amountMinor: 10000,
        paymentDate: "2026-10-30",
      });
    } catch (err) {
      crossWorkspaceError = true;
      assert.match(err.message, /Purchase not found/);
      console.log("  ✓ Cross-workspace payment prohibited");
    }
    assert.equal(crossWorkspaceError, true);

    console.log("\n========================================================");
    console.log("🎉 ALL PURCHASES ACCOUNTING VERIFICATION CHECKS PASSED!");
    console.log("========================================================");
  } catch (err) {
    console.error("❌ TEST ENCOUNTERED AN ERROR:", err);
    throw err;
  } finally {
    // Clean up test workspaces
    console.log("\nCleaning up test workspaces...");
    for (const wsId of [workspaceA?.id, workspaceB?.id]) {
      if (wsId) {
        try {
          await pool.query(`DELETE FROM accounting_purchase_payments WHERE workspace_id = $1`, [wsId]);
          await pool.query(`DELETE FROM accounting_purchase_lines WHERE purchase_id IN (SELECT id FROM accounting_purchases WHERE workspace_id = $1)`, [wsId]);
          await pool.query(`DELETE FROM accounting_transaction_attachments WHERE workspace_id = $1`, [wsId]);
          await pool.query(`DELETE FROM accounting_transactions WHERE workspace_id = $1`, [wsId]);
          await pool.query(`DELETE FROM accounting_purchases WHERE workspace_id = $1`, [wsId]);
          await pool.query(`DELETE FROM accounting_payments WHERE workspace_id = $1`, [wsId]);
          await pool.query(`DELETE FROM accounting_journal_lines WHERE journal_entry_id IN (SELECT id FROM accounting_journal_entries WHERE workspace_id = $1)`, [wsId]);
          await pool.query(`DELETE FROM accounting_journal_entries WHERE workspace_id = $1`, [wsId]);
          await pool.query(`DELETE FROM accounting_contacts WHERE workspace_id = $1`, [wsId]);
          await pool.query(`DELETE FROM accounting_financial_accounts WHERE workspace_id = $1`, [wsId]);
          await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsId]);
        } catch (cleanupErr) {
          console.error("Cleanup warning for workspace", wsId, cleanupErr.message);
        }
      }
    }
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  pool.end();
  process.exit(1);
});
