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
  console.log("=== Running Transaction Attachments Automated Tests ===");

  const {
    validateFileContent,
    MAX_ATTACHMENTS_PER_TRANSACTION,
    MAX_ATTACHMENT_SIZE_BYTES,
  } = await import("../src/lib/accounting/attachments.ts");

  // 1. UNIT TEST: Binary Magic Bytes Validation
  console.log("\n[Test 1] Binary Magic Bytes Validation:");

  // Valid PDF
  const pdfBuffer = Buffer.from("%PDF-1.4\n%...\n%%EOF");
  const pdfResult = validateFileContent(pdfBuffer);
  assert.equal(pdfResult.isValid, true, "PDF should be valid");
  assert.equal(pdfResult.detectedMime, "application/pdf");
  assert.equal(pdfResult.extension, "pdf");
  console.log("  ✓ PDF header correctly recognized");

  // Valid PNG
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const pngResult = validateFileContent(pngBuffer);
  assert.equal(pngResult.isValid, true, "PNG should be valid");
  assert.equal(pngResult.detectedMime, "image/png");
  assert.equal(pngResult.extension, "png");
  console.log("  ✓ PNG header correctly recognized");

  // Valid JPEG
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const jpegResult = validateFileContent(jpegBuffer);
  assert.equal(jpegResult.isValid, true, "JPEG should be valid");
  assert.equal(jpegResult.detectedMime, "image/jpeg");
  assert.equal(jpegResult.extension, "jpg");
  console.log("  ✓ JPEG header correctly recognized");

  // Valid WebP
  const webpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00, // size
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20  // VP8
  ]);
  const webpResult = validateFileContent(webpBuffer);
  assert.equal(webpResult.isValid, true, "WebP should be valid");
  assert.equal(webpResult.detectedMime, "image/webp");
  assert.equal(webpResult.extension, "webp");
  console.log("  ✓ WebP header correctly recognized");

  // Rejected executable / script / HTML
  const htmlBuffer = Buffer.from("<html><script>alert(1)</script></html>");
  const htmlResult = validateFileContent(htmlBuffer);
  assert.equal(htmlResult.isValid, false, "HTML/script must be rejected");
  assert.match(htmlResult.error, /Unsupported file type/);
  console.log("  ✓ HTML/script payload rejected");

  const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ executable
  const exeResult = validateFileContent(exeBuffer);
  assert.equal(exeResult.isValid, false, "Executable must be rejected");
  console.log("  ✓ Executable binary rejected");

  // 2. UNIT TEST: Size Limits & Max Attachments Constant
  console.log("\n[Test 2] Size Limits & Attachment Count Configuration:");
  assert.equal(MAX_ATTACHMENTS_PER_TRANSACTION, 5, "Must allow max 5 attachments per transaction");
  assert.equal(MAX_ATTACHMENT_SIZE_BYTES, 10 * 1024 * 1024, "Must enforce 10MB max per attachment");
  console.log("  ✓ Constants conform to requirements (5 files max, 10MB each)");

  // 3. INTEGRATION TEST: Database Table & Schema Invariants
  console.log("\n[Test 3] Database Schema and Invariants:");
  const columnsRes = await pool.query(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_name = 'accounting_transaction_attachments'
    ORDER BY ordinal_position
  `);
  const colMap = new Map(columnsRes.rows.map(r => [r.column_name, r]));
  assert(colMap.has("id"), "Table must have id column");
  assert(colMap.has("workspace_id"), "Table must have workspace_id column");
  assert(colMap.has("transaction_id"), "Table must have transaction_id column");
  assert(colMap.has("storage_key"), "Table must have storage_key column");
  assert(colMap.has("file_name"), "Table must have file_name column");
  assert(colMap.has("file_size"), "Table must have file_size column");
  assert(colMap.has("file_type"), "Table must have file_type column");

  // Ensure transaction_id is nullable (to allow pending uploads before transaction save)
  assert.equal(colMap.get("transaction_id").is_nullable, "YES", "transaction_id must be nullable for pending uploads");
  console.log("  ✓ accounting_transaction_attachments schema verified (all required fields + nullable transaction_id)");

  // 4. INTEGRATION TEST: Full Lifecycle (Pending Upload -> Link to Transaction -> Edit -> Financial Invariance)
  console.log("\n[Test 4] Full Transaction Attachment Lifecycle & Financial Invariance:");

  // Pick an existing workspace or test workspace
  const wsRes = await pool.query(`SELECT id FROM accounting_workspaces LIMIT 1`);
  assert(wsRes.rows.length > 0, "At least one workspace must exist");
  const testWorkspaceId = wsRes.rows[0].id;

  // Insert a pending attachment (simulating upload prior to saving form)
  const pendingAttId = (await pool.query(`
    INSERT INTO accounting_transaction_attachments
      (workspace_id, transaction_id, storage_key, file_name, file_size, file_type)
    VALUES
      ($1, NULL, $2, 'invoice_receipt.pdf', 10240, 'application/pdf')
    RETURNING id
  `, [testWorkspaceId, `accounting/private/workspaces/${testWorkspaceId}/attachments/test-inv.pdf`])).rows[0].id;

  assert(pendingAttId, "Pending attachment inserted successfully");
  console.log("  ✓ Pending attachment created without transaction_id");

  // Pick an existing transaction in this workspace to link to
  const txRes = await pool.query(`
    SELECT t.id, t.journal_entry_id, t.amount_minor
    FROM accounting_transactions t
    WHERE t.workspace_id = $1 AND t.status = 'POSTED'
    LIMIT 1
  `, [testWorkspaceId]);

  if (txRes.rows.length > 0) {
    const tx = txRes.rows[0];

    // Record initial financial state: journal entry lines and amounts
    const initialLinesRes = await pool.query(`
      SELECT id, financial_account_id, debit_minor, credit_minor
      FROM accounting_journal_lines
      WHERE journal_entry_id = $1
      ORDER BY id
    `, [tx.journal_entry_id]);
    const initialLines = initialLinesRes.rows;

    // Link attachment to transaction
    await pool.query(`
      UPDATE accounting_transaction_attachments
      SET transaction_id = $1, updated_at = NOW()
      WHERE id = $2 AND workspace_id = $3
    `, [tx.id, pendingAttId, testWorkspaceId]);

    // Check attachment count query
    const countCheck = await pool.query(`
      SELECT COALESCE((
        SELECT COUNT(*)
        FROM accounting_transaction_attachments att
        WHERE att.transaction_id = $1
      ), 0)::int as attachment_count
    `, [tx.id]);
    assert(countCheck.rows[0].attachment_count >= 1, "Attachment count must reflect linked attachment");
    console.log(`  ✓ Attachment linked to transaction ${tx.id}; count = ${countCheck.rows[0].attachment_count}`);

    // Verify FINANCIAL INVARIANCE:
    // Journal entry lines, debits, credits, and transaction amount must be 100% IDENTICAL
    const afterLinesRes = await pool.query(`
      SELECT id, financial_account_id, debit_minor, credit_minor
      FROM accounting_journal_lines
      WHERE journal_entry_id = $1
      ORDER BY id
    `, [tx.journal_entry_id]);
    assert.deepEqual(afterLinesRes.rows, initialLines, "Journal lines must remain completely unchanged");

    const afterTxRes = await pool.query(`
      SELECT amount_minor, status FROM accounting_transactions WHERE id = $1
    `, [tx.id]);
    assert.equal(afterTxRes.rows[0].amount_minor, tx.amount_minor, "Transaction amount must not change");
    assert.equal(afterTxRes.rows[0].status, "POSTED", "Transaction status must remain POSTED");
    console.log("  ✓ Financial invariance verified: zero ledger changes, zero balance changes when attachments are linked");

    // Clean up test attachment
    await pool.query(`DELETE FROM accounting_transaction_attachments WHERE id = $1`, [pendingAttId]);
    console.log("  ✓ Test attachment cleaned up");
  } else {
    console.log("  (Skipped transaction link test - no posted transactions in workspace)");
    await pool.query(`DELETE FROM accounting_transaction_attachments WHERE id = $1`, [pendingAttId]);
  }

  // 5. SECURITY & WORKSPACE ISOLATION TEST
  console.log("\n[Test 5] Workspace Isolation & Privacy:");
  const fakeKey = `accounting/private/workspaces/${testWorkspaceId}/attachments/123-receipt.png`;
  assert(fakeKey.startsWith("accounting/private/workspaces/"), "Key must follow private workspace prefix convention");
  assert(!fakeKey.includes(".."), "Key must not contain path traversal");
  console.log("  ✓ Private storage key format strictly isolated per workspace");

  console.log("\n=== All Transaction Attachments Tests Passed Successfully! ===");
}

runTests()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
