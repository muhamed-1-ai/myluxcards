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

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://zappit:ZappitDB%402026Strong@65.108.63.155:5432/luxcardss";
const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

// Dynamic imports after server-only bypass in test runner
const {
  executeCompleteReset,
  executeRestore,
  previewResetImpact,
  previewRestoreImpact,
  listRecoveryVersions,
  hasActiveAccountingActivity,
  computePayloadChecksum,
  wipeActiveAccountingRecords,
} = await import("../src/lib/accounting/recovery.ts");

const {
  seedDefaultChartOfAccounts,
  listFinancialAccounts,
  setAccountOpeningBalance,
} = await import("../src/lib/accounting/accounts.ts");

const {
  seedDefaultCategories,
  createCategory,
  listCategories,
} = await import("../src/lib/accounting/categories.ts");

const {
  createContact,
} = await import("../src/lib/accounting/contacts.ts");

const {
  createTransaction,
  listTransactions,
} = await import("../src/lib/accounting/transactions.ts");

test("ZAPPIT Accounting Reset & Restore: Comprehensive Architecture & Security Verification", async (t) => {
  let userAId, userBId;
  let wsAId, wsBId;
  let testLeadId;

  t.before(async () => {
    // 1. Fetch 2 distinct test users for isolation testing
    const userRes = await pool.query(`SELECT id FROM users ORDER BY created_at ASC LIMIT 2`);
    assert(userRes.rows.length >= 2, "Need at least 2 users for tenant isolation testing");
    userAId = userRes.rows[0].id;
    userBId = userRes.rows[1].id;

    // 2. Create Workspace A (owned by User A)
    const wsARes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Test Tenant Workspace A', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userAId]
    );
    wsAId = wsARes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{"all": true}'::jsonb)`,
      [wsAId, userAId]
    );

    // 3. Create Workspace B (owned by User B) for cross-tenant isolation testing
    const wsBRes = await pool.query(
      `INSERT INTO accounting_workspaces (owner_user_id, name, type, profile_template)
       VALUES ($1, 'Test Tenant Workspace B', 'BUSINESS', 'BUSINESS_OWNER') RETURNING id`,
      [userBId]
    );
    wsBId = wsBRes.rows[0].id;
    await pool.query(
      `INSERT INTO accounting_workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'OWNER', '{"all": true}'::jsonb)`,
      [wsBId, userBId]
    );

    // 4. Create an external CRM lead to prove non-accounting data is NEVER touched
    let cardId;
    const cardRes = await pool.query(`SELECT id FROM digital_cards LIMIT 1`);
    if (cardRes.rows.length > 0) {
      cardId = cardRes.rows[0].id;
    } else {
      const newCard = await pool.query(
        `INSERT INTO digital_cards (owner_id, title, slug) VALUES ($1, 'Test Card', $2) RETURNING id`,
        [userAId, `test-card-${Date.now()}`]
      );
      cardId = newCard.rows[0].id;
    }

    const randomPhone = `+919${Math.floor(100000000 + Math.random() * 900000000)}`;
    const leadRes = await pool.query(
      `INSERT INTO leads (owner_user_id, card_id, name, contact_number, contact_number_normalized, notes)
       VALUES ($1, $2, 'Important VIP Client Lead', $3, $3, 'CRM lead for isolation test')
       RETURNING id`,
      [userAId, cardId, randomPhone]
    );
    testLeadId = leadRes.rows[0].id;

    // Seed defaults in both workspaces
    await seedDefaultChartOfAccounts(wsAId);
    await seedDefaultCategories(wsAId, "BUSINESS_OWNER");
    await seedDefaultChartOfAccounts(wsBId);
    await seedDefaultCategories(wsBId, "BUSINESS_OWNER");
  });

  t.after(async () => {
    // Clean up test workspaces (wipe accounting tables cleanly before workspace delete)
    if (wsAId) {
      await wipeActiveAccountingRecords(wsAId, pool).catch(() => {});
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsAId]).catch(() => {});
    }
    if (wsBId) {
      await wipeActiveAccountingRecords(wsBId, pool).catch(() => {});
      await pool.query(`DELETE FROM accounting_workspaces WHERE id = $1`, [wsBId]).catch(() => {});
    }
    if (testLeadId) {
      await pool.query(`DELETE FROM leads WHERE id = $1`, [testLeadId]).catch(() => {});
    }
    await pool.end();
  });

  await t.test("1. Setup initial financial activity in Workspace A and Workspace B", async () => {
    // Populate Workspace A
    const accountsA = await listFinancialAccounts(wsAId);
    const bankAccountA = accountsA.find((a) => a.subtype === "BANK");
    assert(bankAccountA, "Must have bank account in WS A");

    // Set bank opening balance in WS A (₹50,000)
    await setAccountOpeningBalance(wsAId, bankAccountA.id, 5000000, userAId);

    // Create a contact linked to the CRM lead in WS A
    const contactA = await createContact({
      workspaceId: wsAId,
      name: "Acme Corporation",
      type: "CUSTOMER",
      leadId: testLeadId,
    });

    // Create custom category in WS A
    const customCat = await createCategory(wsAId, {
      name: "Enterprise Software License",
      type: "INCOME",
    });

    // Record an income transaction in WS A
    await createTransaction({
      workspaceId: wsAId,
      type: "INCOME",
      financialAccountId: bankAccountA.id,
      amountMinor: 2500000, // ₹25,000
      date: "2026-03-15",
      notes: "Software license revenue for Q1",
      categoryId: customCat.id,
      contactId: contactA.id,
      userId: userAId,
    });

    // Populate Workspace B (Tenant B) with independent data
    const accountsB = await listFinancialAccounts(wsBId);
    const bankAccountB = accountsB.find((a) => a.subtype === "BANK");
    await setAccountOpeningBalance(wsBId, bankAccountB.id, 9900000, userBId); // ₹99,000

    const txsA = await listTransactions(wsAId);
    assert.equal(txsA.transactions.length, 1, "Workspace A should have 1 transaction");

    const txsB = await listTransactions(wsBId);
    assert.equal(txsB.transactions.length, 0, "Workspace B should have 0 transactions");
  });

  await t.test("2. Warning / Reset Preview alone does NOT delete or alter any data", async () => {
    const preview = await previewResetImpact(wsAId);
    assert.equal(preview.recordCounts.transactions, 1, "Preview should accurately report 1 transaction");
    assert(preview.recordCounts.financialAccounts >= 10, "Preview should report accounts");
    assert.equal(preview.retentionDays, 90, "Retention policy must be 90 days");

    // Verify all active records still exist
    const txsAfterPreview = await listTransactions(wsAId);
    assert.equal(txsAfterPreview.transactions.length, 1, "Data must remain completely unchanged after preview");
  });

  let recoveryVersion1Id;
  await t.test("3. Continue & Wipe Accounting executes complete reversible reset", async () => {
    const result = await executeCompleteReset(wsAId, userAId, "Q1 financial reset test");

    assert(result.recoveryVersionId, "Should return recovery version ID");
    assert.equal(result.versionNumber, 1, "Should be version number 1");
    recoveryVersion1Id = result.recoveryVersionId;

    // Verify active ledger is now completely clean (0 transactions)
    const activeTxs = await listTransactions(wsAId);
    assert.equal(activeTxs.transactions.length, 0, "Active transactions must be 0 after reset");

    // Verify accounts exist with 0 balances
    const activeAccounts = await listFinancialAccounts(wsAId);
    assert(activeAccounts.length >= 10, "Chart of accounts must be re-initialized");
    for (const acc of activeAccounts) {
      assert.equal(Number(acc.current_balance_minor), 0, `Account ${acc.code} balance must be 0`);
      assert.equal(Number(acc.opening_balance_minor), 0, `Account ${acc.code} opening balance must be 0`);
    }

    // Verify activity check reports false
    const hasActivity = await hasActiveAccountingActivity(wsAId);
    assert.equal(hasActivity, false, "Should report no active activity after reset");
  });

  await t.test("4. Non-accounting data and other tenant data are completely untouched", async () => {
    // 1. Verify CRM lead still exists and is untouched
    const leadCheck = await pool.query(`SELECT * FROM leads WHERE id = $1`, [testLeadId]);
    assert.equal(leadCheck.rows.length, 1, "CRM lead must remain completely untouched");
    assert.equal(leadCheck.rows[0].name, "Important VIP Client Lead");

    // 2. Verify User A and User B still exist
    const userACheck = await pool.query(`SELECT * FROM users WHERE id = $1`, [userAId]);
    assert.equal(userACheck.rows.length, 1, "User A must remain completely untouched");

    // 3. Verify Workspace identity and membership still exist
    const wsCheck = await pool.query(`SELECT * FROM accounting_workspaces WHERE id = $1`, [wsAId]);
    assert.equal(wsCheck.rows.length, 1, "Workspace A identity must remain completely untouched");

    const memberCheck = await pool.query(`SELECT * FROM accounting_workspace_members WHERE workspace_id = $1`, [wsAId]);
    assert.equal(memberCheck.rows.length, 1, "Workspace membership must remain completely untouched");

    // 4. Verify Tenant B's data is 100% untouched
    const accountsB = await listFinancialAccounts(wsBId);
    const bankB = accountsB.find((a) => a.subtype === "BANK");
    assert.equal(Number(bankB.opening_balance_minor), 9900000, "Tenant B balance must be completely untouched");
  });

  await t.test("5. Archived recovery version is immutable, verified, and listed", async () => {
    const versions = await listRecoveryVersions(wsAId);
    assert.equal(versions.length, 1, "Should have 1 recovery version in list");
    assert.equal(versions[0].id, recoveryVersion1Id);
    assert.equal(versions[0].reason, "PRE_RESET");
    assert.equal(versions[0].status, "AVAILABLE");
    assert.equal(versions[0].isExpired, false);
    assert.equal(versions[0].recordCounts.transactions, 1);

    // Verify SHA-256 cryptographic checksum
    const rawRes = await pool.query(`SELECT checksum, data_payload FROM accounting_recovery_versions WHERE id = $1`, [recoveryVersion1Id]);
    const computed = computePayloadChecksum(rawRes.rows[0].data_payload);
    assert.equal(computed, rawRes.rows[0].checksum, "Payload checksum must match cryptographic hash");
  });

  await t.test("6. Restore historical state brings back exact verified transactions and balances", async () => {
    // Preview restore impact first
    const restorePrev = await previewRestoreImpact(wsAId, recoveryVersion1Id);
    assert.equal(restorePrev.canRestore, true);
    assert.equal(restorePrev.willCreatePreRestoreBackup, false, "Current ledger is empty, no auto-backup needed");
    assert.equal(restorePrev.targetVersion.recordCounts.transactions, 1);

    // Execute restore
    const restoreResult = await executeRestore(wsAId, recoveryVersion1Id, userAId);
    assert.equal(restoreResult.success, true);
    assert.equal(restoreResult.restoredVersionId, recoveryVersion1Id);

    // Verify transactions are restored
    const restoredTxs = await listTransactions(wsAId);
    assert.equal(restoredTxs.transactions.length, 1, "Restored transactions count must be 1");
    assert.equal(Number(restoredTxs.transactions[0].amount_minor), 2500000);
    assert.equal(restoredTxs.transactions[0].notes, "Software license revenue for Q1");

    // Verify bank account balance is restored
    const accounts = await listFinancialAccounts(wsAId);
    const bank = accounts.find((a) => a.subtype === "BANK");
    assert.equal(Number(bank.opening_balance_minor), 5000000, "Opening balance must be restored to ₹50,000");

    // Verify category is restored
    const categories = await listCategories(wsAId);
    const custom = categories.find((c) => c.name === "Enterprise Software License");
    assert(custom, "Custom category must be restored");

    // Verify version status is now RESTORED
    const updatedVer = await pool.query(`SELECT status, restored_at FROM accounting_recovery_versions WHERE id = $1`, [recoveryVersion1Id]);
    assert.equal(updatedVer.rows[0].status, "RESTORED");
    assert(updatedVer.rows[0].restored_at !== null);
  });

  await t.test("7. Post-reset activity is preserved in auto-backup before restoration (No silent merges)", async () => {
    // 1. Perform reset #2
    const reset2 = await executeCompleteReset(wsAId, userAId, "Second reset");
    assert.equal(reset2.versionNumber, 2);

    // 2. Add NEW activity in the clean ledger post-reset
    const accounts = await listFinancialAccounts(wsAId);
    const cash = accounts.find((a) => a.subtype === "CASH");
    await createTransaction({
      workspaceId: wsAId,
      type: "EXPENSE",
      financialAccountId: cash.id,
      amountMinor: 150000, // ₹1,500
      date: "2026-03-20",
      notes: "Post-reset office stationery expense",
      userId: userAId,
    });

    const activeTxs = await listTransactions(wsAId);
    assert.equal(activeTxs.transactions.length, 1, "Should have 1 post-reset transaction");
    assert.equal(activeTxs.transactions[0].notes, "Post-reset office stationery expense");

    // 3. Check restore preview: must flag willCreatePreRestoreBackup = true
    const prev = await previewRestoreImpact(wsAId, recoveryVersion1Id);
    assert.equal(prev.willCreatePreRestoreBackup, true, "Must detect post-reset activity and schedule auto-backup");

    // 4. Restore Version 1
    const restoreRes = await executeRestore(wsAId, recoveryVersion1Id, userAId);
    assert(restoreRes.preRestoreBackupId, "Must return pre-restore auto-backup ID");

    // 5. Verify active ledger now has Version 1 data (revenue transaction)
    const activeTxsAfterRestore = await listTransactions(wsAId);
    assert.equal(activeTxsAfterRestore.transactions.length, 1);
    assert.equal(activeTxsAfterRestore.transactions[0].notes, "Software license revenue for Q1");

    // 6. Verify that the post-reset transaction was saved in the pre-restore backup (Version 3)
    const versions = await listRecoveryVersions(wsAId);
    const autoBackup = versions.find((v) => v.id === restoreRes.preRestoreBackupId);
    assert(autoBackup, "Auto-backup must exist in recovery versions list");
    assert.equal(autoBackup.reason, "PRE_RESTORE");
    assert.equal(autoBackup.recordCounts.transactions, 1);

    // 7. Verify we can even restore the auto-backup to recover the post-reset data!
    await executeRestore(wsAId, autoBackup.id, userAId);
    const recoveredTxs = await listTransactions(wsAId);
    assert.equal(recoveredTxs.transactions.length, 1);
    assert.equal(recoveredTxs.transactions[0].notes, "Post-reset office stationery expense");
  });

  await t.test("8. Corrupted checksum or expired versions reject restoration safely", async () => {
    // Create a mock version with intentionally corrupted payload
    const corruptRes = await pool.query(
      `INSERT INTO accounting_recovery_versions
         (workspace_id, version_number, name, reason, status, checksum, data_payload, created_by)
       VALUES ($1, 999, 'Corrupted Test', 'MANUAL', 'AVAILABLE', 'fake_invalid_sha256_checksum', '{}'::jsonb, $2)
       RETURNING id`,
      [wsAId, userAId]
    );
    const corruptId = corruptRes.rows[0].id;

    // Preview should detect corruption
    const prev = await previewRestoreImpact(wsAId, corruptId);
    assert.equal(prev.canRestore, false);
    assert.equal(prev.targetVersion.isCorrupted, true);

    // Execute restore should reject and throw error
    await assert.rejects(
      async () => {
        await executeRestore(wsAId, corruptId, userAId);
      },
      /corrupted|checksum/i
    );

    // Test expired version
    const expiredRes = await pool.query(
      `INSERT INTO accounting_recovery_versions
         (workspace_id, version_number, name, reason, status, checksum, data_payload, created_by, expires_at)
       VALUES ($1, 1000, 'Expired Test', 'MANUAL', 'AVAILABLE', $2, '{}'::jsonb, $3, NOW() - INTERVAL '1 day')
       RETURNING id`,
      [wsAId, computePayloadChecksum({}), userAId]
    );
    const expiredId = expiredRes.rows[0].id;

    const expPrev = await previewRestoreImpact(wsAId, expiredId);
    assert.equal(expPrev.canRestore, false);
    assert.equal(expPrev.targetVersion.isExpired, true);

    await assert.rejects(
      async () => {
        await executeRestore(wsAId, expiredId, userAId);
      },
      /expired/i
    );
  });

  await t.test("9. Audit trail entries are preserved across resets and restores", async () => {
    const auditRes = await pool.query(
      `SELECT action, entity_type FROM accounting_audit_logs WHERE workspace_id = $1 ORDER BY created_at ASC`,
      [wsAId]
    );
    const actions = auditRes.rows.map((r) => r.action);
    assert(actions.includes("COMPLETE_ACCOUNTING_RESET"), "Audit log must contain reset action");
    assert(actions.includes("COMPLETE_ACCOUNTING_RESTORE"), "Audit log must contain restore action");
  });
});
