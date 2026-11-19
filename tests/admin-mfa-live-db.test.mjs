import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/db/config.ts";
import {
  generateMfaEnrollmentSetup,
  confirmMfaEnrollment,
  verifyAdminMfaCodeOrRecovery,
  generateTotpCode,
  encryptMfaSecret,
  decryptMfaSecret,
  signAdminMfaToken,
  verifyAdminMfaToken,
  getAdminMfaStatus,
  hashSessionToken,
} from "../src/lib/auth/adminMfa.ts";

// Initialize PostgreSQL pool using test database URL or primary database configuration
const testPool = new Pool(
  process.env.TEST_DATABASE_URL
    ? { connectionString: process.env.TEST_DATABASE_URL }
    : databaseConfig()
);

test("LIVE POSTGRES: Admin MFA end-to-end integration, encryption at rest & concurrency", async (t) => {
  const uniqueId = randomUUID();
  const testAdminId = randomUUID();
  const testAdminEmail = `test-admin-mfa-${Date.now()}@zappit-security-test.local`;

  console.log(`[TEST SETUP] Creating disposable test admin user: ${testAdminId} (${testAdminEmail})`);

  try {
    // 1. Create a test admin user in PostgreSQL
    await testPool.query(
      `INSERT INTO users (id, email, name, role, status, disabled, session_version)
       VALUES ($1, $2, 'Security Test Admin', 'SUPER_ADMIN', 'ACTIVE', false, 1)`,
      [testAdminId, testAdminEmail]
    );

    // 2. Pre-enrollment status check
    const initialStatus = await getAdminMfaStatus(testAdminId);
    assert.equal(initialStatus.enrolled, false, "Admin user must start unenrolled");
    assert.equal(initialStatus.recoveryCodesRemaining, 0);

    // 3. Generate MFA Enrollment Setup
    const setup = await generateMfaEnrollmentSetup({
      id: testAdminId,
      email: testAdminEmail,
    });
    assert.equal(typeof setup.secret, "string");
    assert.equal(setup.secret.length >= 32, true);
    assert.equal(setup.recoveryCodes.length, 8);
    assert.equal(setup.qrDataUrl.startsWith("data:image/png;base64,"), true);

    // 4. Confirm enrollment with a valid first TOTP code
    const validFirstCode = generateTotpCode(setup.secret);
    const confirmResult = await confirmMfaEnrollment(
      testAdminId,
      setup.secret,
      setup.recoveryCodes,
      validFirstCode
    );
    assert.equal(confirmResult.success, true, "Enrollment confirmation must succeed");

    // ============================================================
    // REQUIREMENT 4: Confirm TOTP secrets are encrypted at rest
    // ============================================================
    console.log("  [VERIFY] Checking PostgreSQL admin_mfa table for encryption at rest...");
    const dbRowRes = await testPool.query(
      `SELECT secret, recovery_codes, enrolled_at FROM admin_mfa WHERE user_id = $1`,
      [testAdminId]
    );
    assert.equal(dbRowRes.rowCount, 1, "admin_mfa row must exist in PostgreSQL");
    const storedSecret = dbRowRes.rows[0].secret;

    // Assert secret is encrypted and NOT plaintext Base32
    assert.equal(
      storedSecret.startsWith("enc:v1:"),
      true,
      "Stored secret in PostgreSQL must have enc:v1: prefix"
    );
    assert.notEqual(
      storedSecret,
      setup.secret,
      "Stored secret must NOT be plaintext Base32"
    );

    // Verify secret decrypts back to original plain secret with server key
    const decrypted = decryptMfaSecret(storedSecret);
    assert.equal(decrypted, setup.secret, "Decrypted secret must match original Base32 secret");

    // Verify enrolled status in DB
    const enrolledStatus = await getAdminMfaStatus(testAdminId);
    assert.equal(enrolledStatus.enrolled, true);
    assert.equal(enrolledStatus.recoveryCodesRemaining, 8);

    // ============================================================
    // REQUIREMENT 3: Concurrent Recovery-Code Redemption
    // ============================================================
    console.log("  [VERIFY] Testing concurrent recovery code redemption via serializable row lock...");
    const targetRecoveryCode = setup.recoveryCodes[0];

    // Fire 5 concurrent requests redeeming the EXACT SAME recovery code simultaneously
    const concurrentResults = await Promise.all([
      verifyAdminMfaCodeOrRecovery(testAdminId, targetRecoveryCode),
      verifyAdminMfaCodeOrRecovery(testAdminId, targetRecoveryCode),
      verifyAdminMfaCodeOrRecovery(testAdminId, targetRecoveryCode),
      verifyAdminMfaCodeOrRecovery(testAdminId, targetRecoveryCode),
      verifyAdminMfaCodeOrRecovery(testAdminId, targetRecoveryCode),
    ]);

    const successfulRedemptions = concurrentResults.filter((r) => r.success === true);
    const failedRedemptions = concurrentResults.filter((r) => r.success === false);

    assert.equal(
      successfulRedemptions.length,
      1,
      `EXACTLY 1 concurrent request must succeed. Got: ${successfulRedemptions.length}`
    );
    assert.equal(successfulRedemptions[0].isRecovery, true);
    assert.equal(
      failedRedemptions.length,
      4,
      `EXACTLY 4 concurrent requests must fail. Got: ${failedRedemptions.length}`
    );

    // Subsequent sequential attempt must also fail
    const replayRes = await verifyAdminMfaCodeOrRecovery(testAdminId, targetRecoveryCode);
    assert.equal(replayRes.success, false, "Replay of consumed recovery code must fail");

    // Verify DB reflects 7 unused recovery codes remaining
    const afterRedemptionStatus = await getAdminMfaStatus(testAdminId);
    assert.equal(afterRedemptionStatus.recoveryCodesRemaining, 7);

    // Verify TOTP code verification with decrypted secret works
    const liveTotpCode = generateTotpCode(setup.secret);
    const totpRes = await verifyAdminMfaCodeOrRecovery(testAdminId, liveTotpCode);
    assert.equal(totpRes.success, true, "Valid TOTP verification must succeed");
    assert.equal(totpRes.isRecovery, false);

    // ============================================================
    // REQUIREMENT 2: Session-Bound MFA Cookie Verification & Lifecycle
    // ============================================================
    console.log("  [VERIFY] Testing session-bound MFA cookie lifecycle (fresh login, logout, password reset)...");
    const sessionTokenA = "session_token_device_alpha_123456789";
    const sessionTokenB = "session_token_device_beta_987654321";

    // 1. Issue MFA token bound to sessionTokenA and sessionVersion 1
    const mfaToken = signAdminMfaToken({
      userId: testAdminId,
      role: "SUPER_ADMIN",
      sessionVersion: 1,
      sessionToken: sessionTokenA,
    });

    // 2. Verification within the same session succeeds
    assert.equal(
      verifyAdminMfaToken(mfaToken, testAdminId, 1, sessionTokenA),
      true,
      "MFA token must verify successfully for the bound login session"
    );

    // 3. Old MFA cookie fails after logout (session token cleared / missing)
    assert.equal(
      verifyAdminMfaToken(mfaToken, testAdminId, 1, null),
      false,
      "Old MFA cookie must fail after logout (null session token)"
    );

    // 4. Old MFA cookie fails on a fresh login from another session/device
    assert.equal(
      verifyAdminMfaToken(mfaToken, testAdminId, 1, sessionTokenB),
      false,
      "Old MFA cookie must fail on a fresh login with a different session token"
    );

    // 5. Old MFA cookie fails after password reset (session_version incremented)
    // Simulate password reset in database
    await testPool.query(
      `UPDATE users SET session_version = session_version + 1, updated_at = now() WHERE id = $1`,
      [testAdminId]
    );
    const dbUserAfterReset = (
      await testPool.query(`SELECT session_version FROM users WHERE id = $1`, [testAdminId])
    ).rows[0];
    assert.equal(dbUserAfterReset.session_version, 2, "session_version must be incremented to 2");

    assert.equal(
      verifyAdminMfaToken(mfaToken, testAdminId, dbUserAfterReset.session_version, sessionTokenA),
      false,
      "Old MFA cookie must fail after password reset bumps session_version"
    );

    console.log("  ✓ All Live Database integration assertions passed successfully!");
  } finally {
    // CLEANUP: Always remove disposable test records
    console.log(`[TEST CLEANUP] Removing test records for user: ${testAdminId}`);
    await testPool.query(`DELETE FROM admin_mfa WHERE user_id = $1`, [testAdminId]).catch(() => {});
    await testPool.query(`DELETE FROM users WHERE id = $1`, [testAdminId]).catch(() => {});
    await testPool.end().catch(() => {});
  }
});
