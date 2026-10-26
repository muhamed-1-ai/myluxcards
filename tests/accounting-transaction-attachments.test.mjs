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
    saveAttachmentFile,
    getAttachmentById,
    deleteTransactionAttachment,
    syncTransactionAttachments,
    AttachmentValidationError,
  } = await import("../src/lib/accounting/attachments.ts");

  const {
    getStorageProvider,
    WasabiStorageProvider,
    normalizeRootPrefix,
  } = await import("../src/lib/storage/index.ts");

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

  // 3. UNIT TEST: Wasabi Storage Provider resolveKey
  console.log("\n[Test 3] WasabiStorageProvider Key Resolution:");
  const provider = new WasabiStorageProvider();
  const rootPrefix = normalizeRootPrefix(process.env.WASABI_ROOT_PREFIX);
  console.log(`  Configured WASABI_ROOT_PREFIX: "${rootPrefix}"`);

  const resolvedWithPrefix = provider.resolveKey(`${rootPrefix}/accounting/private/test.png`);
  assert.equal(resolvedWithPrefix, `${rootPrefix}/accounting/private/test.png`, "Should not double prefix");

  const resolvedWithoutPrefix = provider.resolveKey(`accounting/private/test.png`);
  assert.equal(resolvedWithoutPrefix, `${rootPrefix}/accounting/private/test.png`, "Should automatically add root prefix");

  console.log("  ✓ resolveKey correctly resolves keys with and without prefix without duplicating");

  // 4. INTEGRATION TEST: Database Table & Schema Invariants
  console.log("\n[Test 4] Database Schema and Invariants:");
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

  // 5. INTEGRATION TEST: Real Wasabi Uploads (PNG, JPEG, PDF)
  console.log("\n[Test 5] Real Wasabi Uploads with Real Files (PNG, JPEG, PDF):");
  const wsRes = await pool.query(`SELECT id FROM accounting_workspaces LIMIT 1`);
  assert(wsRes.rows.length > 0, "At least one workspace must exist");
  const testWorkspaceId = wsRes.rows[0].id;

  // A. Upload PNG
  console.log("  -> Testing PNG upload to Wasabi...");
  const pngRecord = await saveAttachmentFile({
    workspaceId: testWorkspaceId,
    buffer: pngBuffer,
    originalFileName: "receipt-sample.png",
  });
  assert(pngRecord.id, "Attachment ID must be generated");
  assert(pngRecord.storage_key.includes("receipt-sample.png"), "Storage key should include file name");
  assert(pngRecord.storage_key.startsWith(rootPrefix), "Storage key must include rootPrefix");

  // Verify object is actually stored in Wasabi
  const storage = getStorageProvider();
  const pngHead = await storage.headObject(pngRecord.storage_key);
  assert(pngHead !== null, "Object must exist in Wasabi storage");
  assert.equal(pngHead.size, pngBuffer.length, "Stored size must match original buffer");

  const pngBytes = await storage.getObject(pngRecord.storage_key);
  assert(pngBytes !== null, "Must retrieve bytes from Wasabi storage");
  assert.deepEqual(Buffer.from(pngBytes), pngBuffer, "Downloaded bytes must match uploaded bytes exactly");
  console.log("  ✓ Real PNG successfully uploaded and verified in Wasabi!");

  // B. Upload JPEG
  console.log("  -> Testing JPEG upload to Wasabi...");
  const jpegRecord = await saveAttachmentFile({
    workspaceId: testWorkspaceId,
    buffer: jpegBuffer,
    originalFileName: "bill-photo.jpg",
  });
  const jpegHead = await storage.headObject(jpegRecord.storage_key);
  assert(jpegHead !== null, "JPEG object must exist in Wasabi");
  assert.equal(jpegHead.size, jpegBuffer.length, "JPEG size must match");
  console.log("  ✓ Real JPEG successfully uploaded and verified in Wasabi!");

  // C. Upload PDF
  console.log("  -> Testing PDF upload to Wasabi...");
  const pdfRecord = await saveAttachmentFile({
    workspaceId: testWorkspaceId,
    buffer: pdfBuffer,
    originalFileName: "tax-invoice.pdf",
  });
  const pdfHead = await storage.headObject(pdfRecord.storage_key);
  assert(pdfHead !== null, "PDF object must exist in Wasabi");
  assert.equal(pdfHead.size, pdfBuffer.length, "PDF size must match");
  console.log("  ✓ Real PDF successfully uploaded and verified in Wasabi!");

  // 6. INTEGRATION TEST: Metadata Linking & Workspace Isolation
  console.log("\n[Test 6] Metadata Linking & Workspace Isolation:");
  const fetchedAtt = await getAttachmentById(testWorkspaceId, pngRecord.id);
  assert(fetchedAtt !== null, "Must be retrievable by ID in workspace");
  assert.equal(fetchedAtt.file_name, pngRecord.file_name);
  assert.equal(fetchedAtt.file_type, "image/png");

  // Rejection of unauthorized workspace access
  const fakeWorkspaceId = "00000000-0000-0000-0000-000000000000";
  const crossTenantAtt = await getAttachmentById(fakeWorkspaceId, pngRecord.id);
  assert.equal(crossTenantAtt, null, "Cross-workspace access must be rejected (returns null)");
  console.log("  ✓ Cross-workspace unauthorized access strictly rejected");

  // 7. INTEGRATION TEST: Financial Invariance & Transaction Linking
  console.log("\n[Test 7] Transaction Linking & Financial Invariance:");
  const txRes = await pool.query(`
    SELECT t.id, t.journal_entry_id, t.amount_minor
    FROM accounting_transactions t
    WHERE t.workspace_id = $1 AND t.status = 'POSTED'
    LIMIT 1
  `, [testWorkspaceId]);

  if (txRes.rows.length > 0) {
    const tx = txRes.rows[0];

    const initialLinesRes = await pool.query(`
      SELECT id, financial_account_id, debit_minor, credit_minor
      FROM accounting_journal_lines
      WHERE journal_entry_id = $1
      ORDER BY id
    `, [tx.journal_entry_id]);
    const initialLines = initialLinesRes.rows;

    // Sync attachment to transaction
    await syncTransactionAttachments(testWorkspaceId, tx.id, [pngRecord.id]);

    // Verify financial lines and balances are identical
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
  }

  // 8. ERROR STATUS CODES & VALIDATION
  console.log("\n[Test 8] Error Status Codes & Validation Handling:");

  // File too large (>10MB) -> status 413
  const hugeBuffer = Buffer.alloc(10 * 1024 * 1024 + 100);
  try {
    await saveAttachmentFile({
      workspaceId: testWorkspaceId,
      buffer: hugeBuffer,
      originalFileName: "too-large.png",
    });
    assert.fail("Should have thrown error for oversized file");
  } catch (err) {
    assert(err instanceof AttachmentValidationError, "Should be AttachmentValidationError");
    assert.equal(err.statusCode, 413, "Should have status code 413");
    console.log("  ✓ Oversized file throws AttachmentValidationError with statusCode 413");
  }

  // Unsupported file format -> status 400
  try {
    await saveAttachmentFile({
      workspaceId: testWorkspaceId,
      buffer: Buffer.from("bad binary"),
      originalFileName: "bad.exe",
    });
    assert.fail("Should have thrown error for bad file type");
  } catch (err) {
    assert(err instanceof AttachmentValidationError, "Should be AttachmentValidationError");
    assert.equal(err.statusCode, 400, "Should have status code 400");
    console.log("  ✓ Invalid file content throws AttachmentValidationError with statusCode 400");
  }

  // Nonexistent transaction -> status 404
  try {
    await saveAttachmentFile({
      workspaceId: testWorkspaceId,
      transactionId: "00000000-0000-0000-0000-000000000000",
      buffer: pngBuffer,
      originalFileName: "test.png",
    });
    assert.fail("Should have thrown error for nonexistent transaction");
  } catch (err) {
    assert(err instanceof AttachmentValidationError, "Should be AttachmentValidationError");
    assert.equal(err.statusCode, 404, "Should have status code 404");
    console.log("  ✓ Nonexistent transaction throws AttachmentValidationError with statusCode 404");
  }

  // 9. CLEANUP: Delete attachments from Wasabi & DB
  console.log("\n[Test 9] Storage and Database Cleanup:");
  for (const att of [pngRecord, jpegRecord, pdfRecord]) {
    const deleted = await deleteTransactionAttachment(testWorkspaceId, att.id);
    assert.equal(deleted, true, `Attachment ${att.id} must be deleted`);
    const exists = await storage.objectExists(att.storage_key);
    assert.equal(exists, false, `Wasabi object ${att.storage_key} must be deleted`);
  }
  console.log("  ✓ All test objects cleanly deleted from both database and Wasabi S3 storage");

  console.log("\n=== All Transaction Attachments Tests Passed Successfully! ===");
}

runTests()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
