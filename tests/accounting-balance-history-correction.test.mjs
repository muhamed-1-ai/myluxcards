import test from "node:test";
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

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

test("Account Balance History, Reversal & Correction Test Suite", async (t) => {
  let userId;
  let unauthorizedUserId;
  let workspaceId;
  let bankAccountId;
  let cashAccountId;
  let equityAccountId;

  const { pool: corePool } = await import("../src/lib/db/core.ts");
  const {
    seedDefaultChartOfAccounts,
    listFinancialAccounts,
    getAccountBalanceHistory,
    setAccountOpeningBalance,
    correctAccountFundingEntry,
    reverseAccountFundingEntry,
  } = await import("../src/lib/accounting/accounts.ts");
  const { createTransaction } = await import("../src/lib/accounting/transactions.ts");
  const { getDashboardMetrics } = await import("../src/lib/accounting/reports.ts");

  t.before(async () => {
    // 1. Create test user and workspace
    const uRes = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('history_test_${Date.now()}@example.com', 'History Test User', 'USER')
       RETURNING id`
    );
    userId = uRes.rows[0].id;

    const uRes2 = await pool.query(
      `INSERT INTO users (email, name, role)
       VALUES ('unauth_test_${Date.now()}@example.com', 'Unauthorized User', 'USER')
       RETURNING id`
    );
    unauthorizedUserId = uRes2.rows[0].id;

    const ws = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Balance History Test Workspace', 'BUSINESS', $1)
       RETURNING id`,
      [userId]
    );
    workspaceId = ws.rows[0].id;

    // Seed default chart of accounts
    await seedDefaultChartOfAccounts(workspaceId);

    const accounts = await listFinancialAccounts(workspaceId);
    const bank = accounts.find((a) => a.code === "1020");
    const cash = accounts.find((a) => a.code === "1010");
    const equity = accounts.find((a) => a.code === "3000");

    assert.ok(bank, "Bank account 1020 must exist");
    assert.ok(cash, "Cash account 1010 must exist");
    assert.ok(equity, "Equity account 3000 must exist");

    bankAccountId = bank.id;
    cashAccountId = cash.id;
    equityAccountId = equity.id;
  });

  t.after(async () => {
    await pool.end();
    await corePool.end();
  });

  let originalEntryId;

  await t.test("1. Initial state: Both Bank and Cash start with 0 balances", async () => {
    const accounts = await listFinancialAccounts(workspaceId);
    const bank = accounts.find((a) => a.id === bankAccountId);
    const cash = accounts.find((a) => a.id === cashAccountId);

    assert.equal(Number(bank.current_balance_minor), 0);
    assert.equal(Number(bank.opening_balance_minor), 0);
    assert.equal(Number(cash.current_balance_minor), 0);
    assert.equal(Number(cash.opening_balance_minor), 0);
  });

  await t.test("2. Mistakenly post ₹10,000 opening funding to Bank Account", async () => {
    // Set opening balance of ₹10,000 (1,000,000 minor) to Bank
    const updated = await setAccountOpeningBalance(workspaceId, bankAccountId, 1000000, userId);
    assert.equal(Number(updated.opening_balance_minor), 1000000);
    assert.equal(Number(updated.current_balance_minor), 1000000);

    const accounts = await listFinancialAccounts(workspaceId);
    const bank = accounts.find((a) => a.id === bankAccountId);
    const equity = accounts.find((a) => a.id === equityAccountId);

    assert.equal(Number(bank.current_balance_minor), 1000000, "Bank balance must be ₹10,000");
    assert.equal(Number(equity.current_balance_minor), 1000000, "Equity must be ₹10,000");

    // History on Bank should have 1 active entry
    const history = await getAccountBalanceHistory(workspaceId, bankAccountId);
    assert.equal(history.length, 1);
    assert.equal(history[0].displayType, "Opening Balance");
    assert.equal(history[0].direction, "INFLOW");
    assert.equal(history[0].amountMinor, 1000000);
    assert.equal(history[0].status, "ACTIVE");
    assert.equal(history[0].isEligibleForCorrection, true);
    assert.equal(history[0].isEligibleForReversal, true);

    originalEntryId = history[0].id;
  });

  let correctedCashEntryId;

  await t.test("3. Correct destination from Bank to Cash: Bank ₹0, Cash ₹10,000, unchanged net equity", async () => {
    // Correct entry: move to Cash with same amount (₹10,000)
    const result = await correctAccountFundingEntry(workspaceId, originalEntryId, {
      correctAmountMinor: 1000000,
      correctAccountId: cashAccountId,
      reason: "Mistakenly deposited into Bank instead of Cash in Hand",
      userId,
    });

    assert.ok(result.success);
    assert.ok(result.reversalEntryId);
    assert.ok(result.replacementEntryId);

    const accounts = await listFinancialAccounts(workspaceId);
    const bank = accounts.find((a) => a.id === bankAccountId);
    const cash = accounts.find((a) => a.id === cashAccountId);
    const equity = accounts.find((a) => a.id === equityAccountId);

    assert.equal(Number(bank.current_balance_minor), 0, "Bank balance must be reset to ₹0");
    assert.equal(Number(bank.opening_balance_minor), 0, "Bank opening balance must be reset to ₹0");

    assert.equal(Number(cash.current_balance_minor), 1000000, "Cash balance must be ₹10,000");
    assert.equal(Number(cash.opening_balance_minor), 1000000, "Cash opening balance must be ₹10,000");

    assert.equal(Number(equity.current_balance_minor), 1000000, "Net equity funding remains unchanged at ₹10,000");

    // Bank history now shows original entry as REVERSED and reversal entry
    const bankHistory = await getAccountBalanceHistory(workspaceId, bankAccountId);
    assert.equal(bankHistory.length, 2, "Bank must have original and reversal entries");
    const origOnBank = bankHistory.find((h) => h.id === originalEntryId);
    assert.ok(origOnBank);
    assert.equal(origOnBank.status, "REVERSED");
    assert.equal(origOnBank.isEligibleForCorrection, false, "Reversed entry must not be eligible for correction");

    // Cash history shows the replacement entry
    const cashHistory = await getAccountBalanceHistory(workspaceId, cashAccountId);
    assert.equal(cashHistory.length, 1);
    assert.equal(cashHistory[0].status, "ACTIVE");
    assert.equal(cashHistory[0].amountMinor, 1000000);
    assert.equal(cashHistory[0].direction, "INFLOW");
    assert.equal(cashHistory[0].isEligibleForCorrection, true);

    correctedCashEntryId = cashHistory[0].id;
  });

  await t.test("4. Correct amount on Cash (₹10,000 -> ₹15,000)", async () => {
    // Correct amount on Cash to ₹15,000 (1,500,000 minor)
    const result = await correctAccountFundingEntry(workspaceId, correctedCashEntryId, {
      correctAmountMinor: 1500000,
      correctAccountId: cashAccountId,
      reason: "Adjusted funding amount based on physical cash count",
      userId,
    });

    assert.ok(result.success);

    const accounts = await listFinancialAccounts(workspaceId);
    const cash = accounts.find((a) => a.id === cashAccountId);
    const equity = accounts.find((a) => a.id === equityAccountId);

    assert.equal(Number(cash.current_balance_minor), 1500000, "Cash balance must be ₹15,000");
    assert.equal(Number(cash.opening_balance_minor), 1500000, "Cash opening must be ₹15,000");
    assert.equal(Number(equity.current_balance_minor), 1500000, "Equity must be ₹15,000");

    const cashHistory = await getAccountBalanceHistory(workspaceId, cashAccountId);
    const activeEntry = cashHistory.find((h) => h.status === "ACTIVE");
    assert.ok(activeEntry);
    assert.equal(activeEntry.amountMinor, 1500000);

    correctedCashEntryId = activeEntry.id;
  });

  await t.test("5. Later transactions occur and remain intact after reversing opening funding", async () => {
    // Post later transactions on Cash:
    // Sale (Income) of ₹5,000 (500,000 minor)
    await createTransaction({
      workspaceId,
      type: "INCOME",
      amountMinor: 500000,
      financialAccountId: cashAccountId,
      contactName: "Client A",
      paymentStatus: "PAID",
      notes: "Later cash sale",
      userId,
    });

    // Expense of ₹2,000 (200,000 minor)
    await createTransaction({
      workspaceId,
      type: "EXPENSE",
      amountMinor: 200000,
      financialAccountId: cashAccountId,
      contactName: "Vendor B",
      paymentStatus: "PAID",
      notes: "Later office expense",
      userId,
    });

    // Before reversal:
    // Cash balance was 15,000 + 5,000 - 2,000 = 18,000 (1,800,000 minor)
    let accounts = await listFinancialAccounts(workspaceId);
    let cash = accounts.find((a) => a.id === cashAccountId);
    assert.equal(Number(cash.current_balance_minor), 1800000);

    // Now reverse the ₹15,000 opening entry
    const revResult = await reverseAccountFundingEntry(
      workspaceId,
      correctedCashEntryId,
      "Owner withdrew mistaken opening balance",
      userId
    );
    assert.ok(revResult.success);

    // After reversal:
    // Cash balance should be exactly 1,800,000 - 1,500,000 = 300,000 (₹3,000)
    // Later sale (₹5,000) and expense (₹2,000) remain 100% intact!
    accounts = await listFinancialAccounts(workspaceId);
    cash = accounts.find((a) => a.id === cashAccountId);
    assert.equal(Number(cash.current_balance_minor), 300000, "Cash balance must be ₹3,000 (subsequent net activity)");
    assert.equal(Number(cash.opening_balance_minor), 0, "Cash opening balance must be 0");

    // History on Cash should reflect later transactions and the reversed entry
    const cashHistory = await getAccountBalanceHistory(workspaceId, cashAccountId);
    const revEntry = cashHistory.find((h) => h.id === correctedCashEntryId);
    assert.equal(revEntry.status, "REVERSED");
    assert.equal(revEntry.isEligibleForReversal, false, "Cannot double-reverse");
  });

  await t.test("6. Reject double-reversal and double-correction attempts", async () => {
    // Attempting to reverse an already reversed entry must throw an error
    await assert.rejects(
      async () => {
        await reverseAccountFundingEntry(workspaceId, correctedCashEntryId, "Attempting double reverse", userId);
      },
      {
        message: /already been reversed/,
      }
    );

    // Attempting to correct an already reversed entry must throw an error
    await assert.rejects(
      async () => {
        await correctAccountFundingEntry(workspaceId, correctedCashEntryId, {
          correctAmountMinor: 500000,
          correctAccountId: cashAccountId,
          reason: "Attempting to correct reversed entry",
          userId,
        });
      },
      {
        message: /already been reversed or superseded/,
      }
    );
  });

  await t.test("7. Cross-workspace isolation: Reject operations across workspaces", async () => {
    // Create a second workspace
    const ws2 = await pool.query(
      `INSERT INTO accounting_workspaces (name, type, owner_user_id)
       VALUES ('Second Workspace', 'BUSINESS', $1)
       RETURNING id`,
      [unauthorizedUserId]
    );
    const ws2Id = ws2.rows[0].id;

    // Workspace 2 cannot view or reverse entries from Workspace 1
    await assert.rejects(
      async () => {
        await reverseAccountFundingEntry(ws2Id, correctedCashEntryId, "Cross-workspace attack", unauthorizedUserId);
      },
      {
        message: /Entry not found/,
      }
    );
  });

  await t.test("8. Dashboard metrics report reflects accurate liquid balance and net activity", async () => {
    const metrics = await getDashboardMetrics(workspaceId, { period: "month" });
    // Cash balance is ₹3,000 (300,000 minor)
    assert.equal(metrics.availableBalanceMinor, 300000, "Liquid balance must match ₹3,000");
    // Later sale ₹5,000 cash in
    assert.equal(metrics.moneyReceivedMinor, 500000, "Money received must be ₹5,000 from the legitimate sale");
    // Later expense ₹2,000 cash out
    assert.equal(metrics.moneyPaidMinor, 200000, "Money paid must be ₹2,000 from the legitimate expense");
  });
});
