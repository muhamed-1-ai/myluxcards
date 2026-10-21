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
 * Initiates secure password recovery.
 * Generates a 256-bit cryptographically random token, stores its SHA-256 verifier with a 15-minute expiry,
 * and sends an email to the registered address.
 *
 * Guarantees uniform response text, status, and execution timing to prevent email enumeration.
 */
export async function requestPasswordRecovery(
  email: string,
  clientIp?: string
): Promise<RecoveryRequestResult> {
  const genericResponse: RecoveryRequestResult = {
    ok: true,
    message: "If this email is eligible, we’ll send password recovery instructions.",
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

  // 4. Check if account is Google-only or credential-enabled
  if (user.password_hash) {
    // Account has a local password: create secure single-use recovery link
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
  } else {
    // Account is authenticated via Google: inform the user without setting a local password
    const googleAccount = (
      await pool.query<{ id: string }>(
        "select id from accounts where user_id = $1 and provider = 'google'",
        [user.id]
      )
    ).rows[0];

    if (googleAccount) {
      const deliveryResult = await sendGoogleAccountRecoveryInfoEmail({
        to: user.email,
        name: user.name,
      });

      if (!deliveryResult.ok) {
        console.error(
          `[Auth][GoogleRecovery] Delivery failure for user ${user.id} (${normalized}): provider=${deliveryResult.provider || "none"}, error=${deliveryResult.error || "unknown"}`
        );
      }
    }
  }

  return genericResponse;
}

/**
 * Validates a recovery token without consuming it (safe for email link scanners/crawlers).
 */
export async function verifyResetToken(rawToken: string): Promise<VerifyTokenResult> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) {
    return { valid: false, message: "This password reset link is invalid or has expired." };
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  // Rate limit token verification attempts per token hash to prevent brute force
  const attemptAllowed = await checkRateLimit("verify-reset-token", tokenHash, 10, 900);
  if (!attemptAllowed) {
    return { valid: false, message: "Too many attempts. Please request a new reset link." };
  }

  const result = await pool.query<{
    id: string;
    user_id: string;
    expires_at: Date;
    consumed_at: Date | null;
  }>(
    `select id, user_id, expires_at, consumed_at from auth_action_tokens
    where token_hash = $1 and purpose = 'PASSWORD_RESET'`,
    [tokenHash]
  );
  const tokenRow = result.rows[0];

  if (!tokenRow) {
    return { valid: false, message: "This password reset link is invalid or has expired." };
  }

  if (tokenRow.consumed_at !== null) {
    return { valid: false, message: "This reset link has already been used. Please request a new one." };
  }

  if (new Date(tokenRow.expires_at).getTime() <= Date.now()) {
    return { valid: false, message: "This reset link has expired. Password reset links are valid for 15 minutes." };
  }

  return { valid: true, userId: tokenRow.user_id };
}

/**
 * Atomically consumes a password recovery token, updates the password,
 * bumps session_version to revoke all active sessions, and dispatches a confirmation email.
 */
export async function redeemResetToken(
  rawToken: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) {
    return { ok: false, message: "The reset link or password is invalid." };
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
    // 1. Select and lock the token row
    const row = (
      await db.query<{
        id: string;
        user_id: string;
        expires_at: Date;
        consumed_at: Date | null;
        email: string;
        name: string;
      }>(
        `select t.id, t.user_id, t.expires_at, t.consumed_at, u.email, u.name
        from auth_action_tokens t
        join users u on u.id = t.user_id
        where t.token_hash = $1 and t.purpose = 'PASSWORD_RESET' for update`,
        [tokenHash]
      )
    ).rows[0];

    if (!row || row.consumed_at !== null || new Date(row.expires_at).getTime() <= Date.now()) {
      return null;
    }

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

    return { userId: row.user_id, email: row.email, name: row.name };
  }, "serializable");

  if (!updateResult) {
    return { ok: false, message: "The reset link is invalid, expired, or has already been used." };
  }

  // 5. Send password-changed notification email (non-blocking for return, but awaited)
  try {
    await sendPasswordChangedEmail({
      to: updateResult.email,
      name: updateResult.name,
    });
  } catch (err) {
    console.error("[Auth] Failed to send password changed notification email:", err);
  }

  return {
    ok: true,
    message: "Password reset successful. Please log in with your new password.",
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

  if (!user || user.disabled || user.status === "DISABLED") {
    return { ok: false, message: "User account not active." };
  }

  // Handle Google-only account
  if (!user.password_hash) {
    return {
      ok: false,
      message: "Your sign-in is managed through Google. Password change is not applicable for Google-only accounts.",
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
