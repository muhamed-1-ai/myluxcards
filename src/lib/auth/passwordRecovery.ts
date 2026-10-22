import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { compare } from "bcryptjs";
import { pool, withTransaction } from "../db";
import { normalizeEmail } from "../repositories/users";
import {
  validEmail,
  validPassword,
  hashPassword,
  verifyPassword,
  checkRateLimit,
} from "../authService";
import { getAppOrigin } from "../url";
import {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendGoogleAccountRecoveryInfoEmail,
} from "../email/transactional";

// Dummy bcrypt hash used for constant-time comparison when an email does not exist,
// neutralizing timing side-channels against user enumeration.
const DUMMY_HASH = "$2a$12$K8y4X0yE9h1v4o7m8r2wQu9t4gY8v2kLmN7p3qRsTuVwXyZaBcDe.";

export interface RecoveryRequestResult {
  ok: boolean;
  message: string;
}

export interface VerifyTokenResult {
  valid: boolean;
  message?: string;
  userId?: string;
  isSetup?: boolean;
}

export interface ResetPasswordResult {
  ok: boolean;
  message: string;
}

export interface ChangePasswordResult {
  ok: boolean;
  message: string;
  signInRequired?: boolean;
}

/**
 * Initiates secure password recovery or initial password setup.
 * Generates a 256-bit cryptographically random token, stores its SHA-256 verifier with a 15-minute expiry,
 * and sends an email to the registered address.
 *
 * Supports both accounts with an existing password (reset) and Google-registered accounts (first password setup).
 * Guarantees uniform generic response text, status, and execution timing to prevent email enumeration.
 */
export async function requestPasswordRecovery(
  email: string,
  clientIp?: string
): Promise<RecoveryRequestResult> {
  const genericResponse: RecoveryRequestResult = {
    ok: true,
    message: "If this account is eligible, we’ll email you a link to set or reset your password.",
  };

  if (!email || typeof email !== "string") {
    return genericResponse;
  }

  const normalized = normalizeEmail(email);
  if (!validEmail(normalized)) {
    return genericResponse;
  }

  // 1. Abuse prevention: persistent rate limits by IP (15/15m) and by Email (3/15m)
  const ipSubject = clientIp ? `ip:${clientIp}` : "ip:unknown";
  const ipAllowed = await checkRateLimit("forgot-pwd-ip", ipSubject, 15, 900);
  const emailAllowed = await checkRateLimit("forgot-pwd-email", normalized, 3, 900);

  if (!ipAllowed || !emailAllowed) {
    // Return identical response to prevent probing rate limits
    return genericResponse;
  }

  // 2. Lookup registered user
  const userResult = await pool.query<{
    id: string;
    email: string;
    name: string;
    password_hash: string | null;
    disabled: boolean;
    status: string;
  }>(
    "select id, email, name, password_hash, disabled, status from users where LOWER(email) = $1",
    [normalized]
  );
  const user = userResult.rows[0];

  // 3. User does not exist or is disabled/suspended
  if (!user || user.disabled || user.status === "DISABLED" || user.status === "SUSPENDED") {
    // Perform dummy bcrypt comparison to neutralize timing side-channels
    await compare("dummy_password_timing_defense", DUMMY_HASH).catch(() => {});
    return genericResponse;
  }

  // 4. Create secure single-use recovery link
  // Supports both accounts with an existing password (reset) and Google-registered accounts (first setup)
  const isSetup = !user.password_hash;
  const rawToken = randomBytes(32).toString("hex"); // 64 hex characters (256 bits)
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  let tokenId: string | null = null;
  await withTransaction(async (db) => {
    // Invalidate any existing unconsumed tokens for this user
    await db.query(
      "update auth_action_tokens set consumed_at = now() where user_id = $1 and purpose = 'PASSWORD_RESET' and consumed_at is null",
      [user.id]
    );

    // Insert new token hash with initial PENDING delivery status
    const insertResult = await db.query<{ id: string }>(
      `insert into auth_action_tokens(user_id, purpose, token_hash, expires_at, delivery_status)
      values($1, 'PASSWORD_RESET', $2, $3, 'PENDING')
      returning id`,
      [user.id, tokenHash, expiresAt]
    );
    tokenId = insertResult.rows[0]?.id || null;
  });

  const origin = getAppOrigin();
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const deliveryResult = await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    expiresMinutes: 15,
    isSetup,
  });

  // Record delivery outcome and diagnostics directly in the token record
  if (tokenId) {
    if (deliveryResult.ok) {
      await pool.query(
        `update auth_action_tokens
         set delivery_status = 'SENT',
             delivery_provider = $1,
             delivery_message_id = $2,
             delivery_error = null,
             sent_at = now()
         where id = $3`,
        [deliveryResult.provider || "resend", deliveryResult.messageId || null, tokenId]
      ).catch((err) => console.error("[Auth] Failed to update token delivery status:", err));
    } else {
      const deliveryStatus = deliveryResult.provider === "unconfigured" ? "UNCONFIGURED" : "FAILED";
      await pool.query(
        `update auth_action_tokens
         set delivery_status = $1,
             delivery_provider = $2,
             delivery_error = $3
         where id = $4`,
        [deliveryStatus, deliveryResult.provider || null, deliveryResult.error || "Delivery failed", tokenId]
      ).catch((err) => console.error("[Auth] Failed to update token delivery error:", err));

      // Actionable private diagnostic log (never leaks tokens or credentials)
      console.error(
        `[Auth][PasswordRecovery] Delivery failure for user ${user.id} (${normalized}): status=${deliveryStatus}, provider=${deliveryResult.provider || "none"}, error=${deliveryResult.error || "unknown"}`
      );
    }
  }

  return genericResponse;
}

/**
 * Initiates verified password setup for an authenticated session without an existing password (e.g. Google-registered user).
 * Derives target user and trusted email strictly from the authenticated server identity.
 * Dispatches a short-lived single-use setup link to their verified email.
 */
export async function requestPasswordSetupForAuthenticatedUser(
  userId: string,
  clientIp?: string
): Promise<RecoveryRequestResult> {
  if (!userId) {
    return { ok: false, message: "Unauthorized" };
  }

  // Rate limit setup requests per user ID (max 3 in 15 minutes)
  const allowed = await checkRateLimit("setup-pwd-user", userId, 3, 900);
  if (!allowed) {
    return {
      ok: false,
      message: "Too many password setup requests. Please wait a few minutes before trying again.",
    };
  }

  const user = (
    await pool.query<{
      id: string;
      email: string;
      name: string;
      password_hash: string | null;
      disabled: boolean;
      status: string;
    }>("select id, email, name, password_hash, disabled, status from users where id = $1", [userId])
  ).rows[0];

  if (!user || user.disabled || user.status === "DISABLED" || user.status === "SUSPENDED") {
    return { ok: false, message: "User account is not active." };
  }

  if (user.password_hash) {
    return {
      ok: false,
      message: "Your account already has a password. Please use Change Password instead.",
    };
  }

  // Generate 256-bit cryptographically random token with 15-minute expiry
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  let tokenId: string | null = null;
  await withTransaction(async (db) => {
    await db.query(
      "update auth_action_tokens set consumed_at = now() where user_id = $1 and purpose = 'PASSWORD_RESET' and consumed_at is null",
      [user.id]
    );

    const insertResult = await db.query<{ id: string }>(
      `insert into auth_action_tokens(user_id, purpose, token_hash, expires_at, delivery_status)
       values($1, 'PASSWORD_RESET', $2, $3, 'PENDING')
       returning id`,
      [user.id, tokenHash, expiresAt]
    );
    tokenId = insertResult.rows[0]?.id || null;
  });

  const origin = getAppOrigin();
  const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;

  const deliveryResult = await sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
    expiresMinutes: 15,
    isSetup: true,
  });

  if (tokenId) {
    if (deliveryResult.ok) {
      await pool.query(
        `update auth_action_tokens
         set delivery_status = 'SENT',
             delivery_provider = $1,
             delivery_message_id = $2,
             delivery_error = null,
             sent_at = now()
         where id = $3`,
        [deliveryResult.provider || "resend", deliveryResult.messageId || null, tokenId]
      ).catch((err) => console.error("[Auth] Failed to update setup token delivery status:", err));
    } else {
      const deliveryStatus = deliveryResult.provider === "unconfigured" ? "UNCONFIGURED" : "FAILED";
      await pool.query(
        `update auth_action_tokens
         set delivery_status = $1,
             delivery_provider = $2,
             delivery_error = $3
         where id = $4`,
        [deliveryStatus, deliveryResult.provider || null, deliveryResult.error || "Delivery failed", tokenId]
      ).catch((err) => console.error("[Auth] Failed to update setup token delivery error:", err));

      console.error(
        `[Auth][PasswordSetup] Delivery failure for user ${user.id} (${user.email}): status=${deliveryStatus}, provider=${deliveryResult.provider || "none"}, error=${deliveryResult.error || "unknown"}`
      );
    }
  }

  return {
    ok: true,
    message: "A secure password setup link has been sent to your verified email address.",
  };
}

/**
 * Validates a recovery or setup token without consuming it (safe for email link scanners/crawlers).
 */
export async function verifyResetToken(rawToken: string): Promise<VerifyTokenResult> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) {
    return { valid: false, message: "This password link is invalid or has expired." };
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  // Rate limit token verification attempts per token hash to prevent brute force
  const attemptAllowed = await checkRateLimit("verify-reset-token", tokenHash, 10, 900);
  if (!attemptAllowed) {
    return { valid: false, message: "Too many attempts. Please request a new link." };
  }

  const result = await pool.query<{
    id: string;
    user_id: string;
    expires_at: Date;
    consumed_at: Date | null;
    password_hash: string | null;
  }>(
    `select t.id, t.user_id, t.expires_at, t.consumed_at, u.password_hash
    from auth_action_tokens t
    join users u on u.id = t.user_id
    where t.token_hash = $1 and t.purpose = 'PASSWORD_RESET'`,
    [tokenHash]
  );
  const tokenRow = result.rows[0];

  if (!tokenRow) {
    return { valid: false, message: "This password link is invalid or has expired." };
  }

  if (tokenRow.consumed_at !== null) {
    return { valid: false, message: "This link has already been used. Please request a new one." };
  }

  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return { valid: false, message: "This link has expired. Links are valid for 15 minutes." };
  }

  return { valid: true, userId: tokenRow.user_id, isSetup: !tokenRow.password_hash };
}

/**
 * Atomically consumes a password recovery or setup token, updates the password,
 * bumps session_version to revoke all active sessions, and dispatches a confirmation email.
 */
export async function redeemResetToken(
  rawToken: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) {
    return { ok: false, message: "The link or password is invalid." };
  }

  if (!validPassword(newPassword)) {
    return { ok: false, message: "Password must be at least 12 characters and include uppercase, lowercase, numbers, and symbols." };
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  // Rate limit redemption attempts
  const allowed = await checkRateLimit("redeem-reset-token", tokenHash, 5, 900);
  if (!allowed) {
    return { ok: false, message: "Too many failed attempts. Please request a new password recovery link." };
  }

  const newHash = await hashPassword(newPassword);

  const updateResult = await withTransaction(async (db) => {
    // 1. Select and lock the token row joined with user
    const row = (
      await db.query<{
        id: string;
        user_id: string;
        expires_at: Date;
        consumed_at: Date | null;
        email: string;
        name: string;
        password_hash: string | null;
        disabled: boolean;
        status: string;
      }>(
        `select t.id, t.user_id, t.expires_at, t.consumed_at, u.email, u.name, u.password_hash, u.disabled, u.status
        from auth_action_tokens t
        join users u on u.id = t.user_id
        where t.token_hash = $1 and t.purpose = 'PASSWORD_RESET' for update`,
        [tokenHash]
      )
    ).rows[0];

    if (
      !row ||
      row.consumed_at !== null ||
      new Date(row.expires_at).getTime() <= Date.now() ||
      row.disabled ||
      row.status === "DISABLED" ||
      row.status === "SUSPENDED"
    ) {
      return null;
    }

    const wasFirstPassword = !row.password_hash;

    // 2. Update user's password, bump session_version to revoke all sessions, clear must_change_password
    await db.query(
      `update users
      set password_hash = $1, session_version = session_version + 1, must_change_password = false, updated_at = now()
      where id = $2`,
      [newHash, row.user_id]
    );

    // 3. Mark the used token as consumed
    await db.query("update auth_action_tokens set consumed_at = now() where id = $1", [row.id]);

    // 4. Invalidate all remaining password reset tokens for this user
    await db.query(
      "update auth_action_tokens set consumed_at = now() where user_id = $1 and purpose = 'PASSWORD_RESET' and consumed_at is null",
      [row.user_id]
    );

    return { userId: row.user_id, email: row.email, name: row.name, wasFirstPassword };
  }, "serializable");

  if (!updateResult) {
    return { ok: false, message: "The link is invalid, expired, or has already been used." };
  }

  // 5. Send password-changed / added notification email (awaited)
  try {
    await sendPasswordChangedEmail({
      to: updateResult.email,
      name: updateResult.name,
      isAdded: updateResult.wasFirstPassword,
    });
  } catch (err) {
    console.error("[Auth] Failed to send password notification email:", err);
  }

  return {
    ok: true,
    message: updateResult.wasFirstPassword
      ? "Password created successfully. Please log in with your email and password."
      : "Password reset successful. Please log in with your new password.",
  };
}

/**
 * Changes password for an authenticated session.
 * Requires verifying the current password, rejects setting the same password,
 * bumps session_version to revoke existing sessions, and sends a notification email.
 */
export async function changePasswordForAuthenticatedUser(
  userId: string,
  currentPassword: string | undefined,
  newPassword: string
): Promise<ChangePasswordResult> {
  if (!userId) {
    return { ok: false, message: "Unauthorized" };
  }

  if (!validPassword(newPassword)) {
    return {
      ok: false,
      message: "New password must be at least 12 characters and include uppercase, lowercase, numbers, and symbols.",
    };
  }

  // Rate limit change-password attempts per user ID (max 5 in 15 minutes)
  const attemptAllowed = await checkRateLimit("change-pwd-attempt", userId, 5, 900);
  if (!attemptAllowed) {
    return { ok: false, message: "Too many password attempts. Please wait 15 minutes before trying again." };
  }

  const user = (
    await pool.query<{
      id: string;
      email: string;
      name: string;
      password_hash: string | null;
      disabled: boolean;
      status: string;
    }>("select id, email, name, password_hash, disabled, status from users where id = $1", [userId])
  ).rows[0];

  if (!user || user.disabled || user.status === "DISABLED" || user.status === "SUSPENDED") {
    return { ok: false, message: "User account not active." };
  }

  // Accounts without a password must use the verified setup link flow
  if (!user.password_hash) {
    return {
      ok: false,
      message: "This account does not have a password yet. Please use Add Password to set up your password.",
    };
  }

  // Verify current password
  if (!currentPassword) {
    return { ok: false, message: "Current password is required." };
  }

  const matches = await verifyPassword(currentPassword, user.password_hash);
  if (!matches) {
    return { ok: false, message: "The current password you entered is incorrect." };
  }

  // Prevent reusing the same password
  if (currentPassword === newPassword) {
    return { ok: false, message: "New password must be different from your current password." };
  }

  const newHash = await hashPassword(newPassword);

  await withTransaction(async (db) => {
    // 1. Update user password, increment session_version to revoke other sessions
    await db.query(
      `update users
      set password_hash = $1, must_change_password = false, session_version = session_version + 1, updated_at = now()
      where id = $2`,
      [newHash, user.id]
    );

    // 2. Invalidate any open password recovery tokens
    await db.query(
      "update auth_action_tokens set consumed_at = now() where user_id = $1 and purpose = 'PASSWORD_RESET' and consumed_at is null",
      [user.id]
    );
  }, "serializable");

  // Send notification email
  try {
    await sendPasswordChangedEmail({
      to: user.email,
      name: user.name,
      isAdded: false,
    });
  } catch (err) {
    console.error("[Auth] Failed to dispatch password changed notification:", err);
  }

  return {
    ok: true,
    signInRequired: true,
    message: "Password changed successfully. Please log in again with your new password.",
  };
}

export async function isAccountGoogleOnly(userId: string): Promise<boolean> {
  const user = (await pool.query<{ password_hash: string | null }>("select password_hash from users where id = $1", [userId])).rows[0];
  const hasGoogle = (await pool.query<{ id: string }>("select id from accounts where user_id = $1 and provider = 'google'", [userId])).rows.length > 0;
  return Boolean(!user?.password_hash && hasGoogle);
}

export async function userHasLocalPassword(userId: string): Promise<boolean> {
  const user = (await pool.query<{ password_hash: string | null }>("select password_hash from users where id = $1", [userId])).rows[0];
  return Boolean(user?.password_hash);
}
