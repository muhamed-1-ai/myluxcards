import "server-only";
import {
  randomBytes,
  createHmac,
  createHash,
  timingSafeEqual,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import QRCode from "qrcode";
import { pool, withTransaction } from "@/lib/db";
import { getAuthSecret } from "@/lib/authSecret";
import { AdminIdentity } from "@/lib/adminAuth";

export const ADMIN_MFA_COOKIE_NAME = "zappit_admin_mfa";
const B32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Server-held encryption key derivation for TOTP secrets at rest.
 * Uses AES-256-GCM authenticated encryption.
 */
function getMfaEncryptionKey(): Buffer {
  const secret = process.env.MFA_ENCRYPTION_KEY || getAuthSecret();
  return createHash("sha256").update(secret + ":zappit-admin-totp-encryption-v1").digest();
}

/**
 * Encrypts a TOTP secret using AES-256-GCM with a server-held key.
 * Format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptMfaSecret(plainSecret: string): string {
  const key = getMfaEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV for AES-GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a stored TOTP secret.
 * Handles both encrypted format (enc:v1:...) and backwards-compatible legacy plaintext Base32.
 */
export function decryptMfaSecret(storedSecret: string): string {
  if (!storedSecret || typeof storedSecret !== "string") return "";
  if (!storedSecret.startsWith("enc:v1:")) {
    // Backwards-compatible legacy plaintext secret
    return storedSecret;
  }
  const parts = storedSecret.split(":");
  if (parts.length !== 5) {
    throw new Error("Invalid encrypted MFA secret format.");
  }
  const iv = Buffer.from(parts[2], "hex");
  const tag = Buffer.from(parts[3], "hex");
  const ciphertext = Buffer.from(parts[4], "hex");

  const key = getMfaEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Resolves the NextAuth session token from the incoming request or next/headers cookies.
 */
export async function getRequestSessionToken(
  req?: Request | Headers | { headers?: any } | null
): Promise<string | null> {
  const cookieNames = ["__Secure-next-auth.session-token", "next-auth.session-token"];

  if (req) {
    let cookieHeader = "";
    if (typeof (req as any).get === "function") {
      cookieHeader = (req as Headers).get("cookie") || "";
    } else if ("headers" in req && req.headers) {
      const h = req.headers as any;
      cookieHeader = (typeof h?.get === "function" ? h.get("cookie") : h?.cookie) || "";
    }
    for (const name of cookieNames) {
      const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
      if (match) return decodeURIComponent(match[1]);
    }
  }

  try {
    const cookieStore = await cookies();
    for (const name of cookieNames) {
      const val = cookieStore.get(name)?.value;
      if (val) return val;
    }
  } catch {
    // Outside server components/route handler cookies context
  }

  return null;
}

export function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex").slice(0, 32);
}

/**
 * Encodes a buffer into RFC 4648 Base32 string (no padding).
 */
export function base32Encode(buffer: Buffer | Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += B32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += B32_CHARS[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Decodes an RFC 4648 Base32 string into a Buffer.
 */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = B32_CHARS.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Generates a 6-digit TOTP code for a given Base32 secret (RFC 6238, 30s step).
 */
export function generateTotpCode(secretBase32: string, timeStepOffset = 0, stepSeconds = 30): string {
  const key = base32Decode(secretBase32);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / stepSeconds) + timeStepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = (binary % 1_000_000).toString().padStart(6, "0");
  return code;
}

/**
 * Verifies a 6-digit TOTP code with standard drift tolerance (window = 1 -> ±30s).
 */
export function verifyTotpCode(secretBase32: string, token: string, window = 1): boolean {
  const cleanToken = token.trim().replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanToken)) return false;
  for (let offset = -window; offset <= window; offset++) {
    const expected = generateTotpCode(secretBase32, offset);
    if (
      expected.length === cleanToken.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(cleanToken))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Normalizes recovery code for comparison.
 */
export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Generates 8 single-use alphanumeric recovery codes formatted as XXXX-XXXX.
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export interface StoredRecoveryCode {
  hash: string;
  used: boolean;
  used_at: string | null;
}

export interface AdminMfaStatus {
  enrolled: boolean;
  enrolledAt: Date | null;
  lastUsedAt: Date | null;
  recoveryCodesRemaining: number;
}

/**
 * Checks whether an administrator has enrolled in MFA.
 */
export async function getAdminMfaStatus(userId: string): Promise<AdminMfaStatus> {
  const res = await pool.query<{
    enrolled_at: Date;
    last_used_at: Date | null;
    recovery_codes: StoredRecoveryCode[];
  }>(
    `SELECT enrolled_at, last_used_at, recovery_codes
     FROM admin_mfa
     WHERE user_id = $1`,
    [userId]
  );

  const row = res.rows[0];
  if (!row) {
    return {
      enrolled: false,
      enrolledAt: null,
      lastUsedAt: null,
      recoveryCodesRemaining: 0,
    };
  }

  const unusedCount = Array.isArray(row.recovery_codes)
    ? row.recovery_codes.filter((c) => !c.used).length
    : 0;

  return {
    enrolled: true,
    enrolledAt: row.enrolled_at,
    lastUsedAt: row.last_used_at,
    recoveryCodesRemaining: unusedCount,
  };
}

/**
 * Prepares an MFA enrollment package for an admin user:
 * Generates Base32 secret, otpauth URI, QR code Data URL, and 8 recovery codes.
 */
export async function generateMfaEnrollmentSetup(user: { id: string; email: string }): Promise<{
  secret: string;
  otpauthUri: string;
  qrDataUrl: string;
  recoveryCodes: string[];
}> {
  // 20 random bytes (160 bits) -> 32 char Base32 secret
  const secretBytes = randomBytes(20);
  const secret = base32Encode(secretBytes);

  const issuer = "3G Zappit";
  const label = encodeURIComponent(`3G Zappit Admin:${user.email}`);
  const otpauthUri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  const qrDataUrl = await QRCode.toDataURL(otpauthUri, {
    margin: 1,
    width: 240,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  const recoveryCodes = generateRecoveryCodes(8);

  return {
    secret,
    otpauthUri,
    qrDataUrl,
    recoveryCodes,
  };
}

/**
 * Confirms and completes MFA enrollment by verifying the first 6-digit code.
 * Persists secret and hashed recovery codes to PostgreSQL.
 */
export async function confirmMfaEnrollment(
  userId: string,
  secret: string,
  recoveryCodes: string[],
  token: string
): Promise<{ success: boolean; message?: string }> {
  if (!verifyTotpCode(secret, token)) {
    return { success: false, message: "Invalid verification code. Please check your authenticator app and try again." };
  }

  const storedRecovery: StoredRecoveryCode[] = recoveryCodes.map((code) => ({
    hash: createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex"),
    used: false,
    used_at: null,
  }));

  // Encrypt secret with server-held key before persisting to PostgreSQL
  const encryptedSecret = encryptMfaSecret(secret);

  await pool.query(
    `INSERT INTO admin_mfa (user_id, secret, enrolled_at, last_used_at, recovery_codes, updated_at)
     VALUES ($1, $2, now(), now(), $3::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET
       secret = EXCLUDED.secret,
       enrolled_at = now(),
       last_used_at = now(),
       recovery_codes = EXCLUDED.recovery_codes,
       updated_at = now()`,
    [userId, encryptedSecret, JSON.stringify(storedRecovery)]
  );

  return { success: true };
}

/**
 * Verifies a 6-digit TOTP token OR an unused recovery code for an enrolled admin.
 * Uses atomic row locking (FOR UPDATE) inside a database transaction to guarantee
 * single-use consumption of recovery codes without race conditions.
 */
export async function verifyAdminMfaCodeOrRecovery(
  userId: string,
  inputCode: string
): Promise<{ success: boolean; isRecovery?: boolean; message?: string }> {
  const clean = inputCode.trim();
  if (!clean) {
    return { success: false, message: "Verification code cannot be empty." };
  }

  return withTransaction(async (db) => {
    const res = await db.query<{
      secret: string;
      recovery_codes: StoredRecoveryCode[];
    }>(
      `SELECT secret, recovery_codes
       FROM admin_mfa
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );

    const row = res.rows[0];
    if (!row) {
      return { success: false, message: "Admin MFA is not configured for this account." };
    }

    // 1. Try 6-digit TOTP verification
    if (/^\d{6}$/.test(clean.replace(/\s+/g, ""))) {
      const plainSecret = decryptMfaSecret(row.secret);
      if (verifyTotpCode(plainSecret, clean)) {
        await db.query("UPDATE admin_mfa SET last_used_at = now(), updated_at = now() WHERE user_id = $1", [userId]);
        return { success: true, isRecovery: false };
      }
    }

    // 2. Try atomic recovery code consumption
    const normalizedRecovery = normalizeRecoveryCode(clean);
    if (normalizedRecovery.length >= 8) {
      const inputHash = createHash("sha256").update(normalizedRecovery).digest("hex");
      const codes = Array.isArray(row.recovery_codes) ? [...row.recovery_codes] : [];
      const matchIdx = codes.findIndex((c) => !c.used && c.hash === inputHash);

      if (matchIdx !== -1) {
        codes[matchIdx].used = true;
        codes[matchIdx].used_at = new Date().toISOString();

        await db.query(
          "UPDATE admin_mfa SET recovery_codes = $1::jsonb, last_used_at = now(), updated_at = now() WHERE user_id = $2",
          [JSON.stringify(codes), userId]
        );
        return { success: true, isRecovery: true };
      }
    }

    return { success: false, message: "Invalid verification code or recovery code. Please try again." };
  }, "serializable");
}

/**
 * Creates a signed MFA verification cookie token bound to:
 * - userId
 * - role
 * - sessionVersion (revokes when password is reset or sessions bumped)
 * - sessionId (stable login session identifier, immune to raw cookie re-encryption on session refresh)
 * - sessionToken (fallback hash binding)
 */
export function signAdminMfaToken(payload: {
  userId: string;
  role: string;
  sessionVersion?: number;
  sessionId?: string;
  sessionToken?: string;
}): string {
  const secret = getAuthSecret();
    const data: Record<string, any> = {
      uid: payload.userId,
      role: payload.role,
      sv: payload.sessionVersion ?? 0,
        iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12, // 12-hour MFA session
  };

// Bind to the stable login session identifier from NextAuth JWT.
// This avoids spurious MFA drops during normal session refresh / cookie rotation
// while strictly ensuring the token invalidates on fresh logins, logouts, and password resets.
if (payload.sessionId) {
  data.sid = payload.sessionId;
} else if (payload.sessionToken) {
  data.sth = hashSessionToken(payload.sessionToken);
}

const raw = Buffer.from(JSON.stringify(data)).toString("base64url");
const signature = createHmac("sha256", secret).update(raw).digest("base64url");
return `${raw}.${signature}`;
}

/**
 * Validates a signed MFA verification cookie token.
 * Verifies cryptographic HMAC signature, user ID, session version, expiry,
 * and individual session binding.
 * Accepts either sessionId or sessionToken in the 4th/5th argument position.
 */
  export function verifyAdminMfaToken(
    token: string,
    userId: string,
    sessionVersion?: number,
    sessionIdOrToken?: string | null,
    currentSessionToken?: string | null
  ): boolean {
    if (!token || typeof token !== "string" || !token.includes(".")) return false;
    const [raw, signature] = token.split(".");
    if (!raw || !signature) return false;

    const secret = getAuthSecret();
    const expectedSignature = createHmac("sha256", secret).update(raw).digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return false;
    }

      try {
        const data = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
        if (data.uid !== userId) return false;
        if (sessionVersion !== undefined && data.sv !== sessionVersion) return false;
        if (typeof data.exp === "number" && data.exp <= Math.floor(Date.now() / 1000)) return false;

        // 1. Stable session identifier check (resilient to session refresh and cookie rotation)
        if (data.sid) {
          if (!sessionIdOrToken) return false;
          if (data.sid !== sessionIdOrToken) return false;
        }

        // 2. Cookie token hash check
        if (data.sth) {
          const candidateToken = currentSessionToken || sessionIdOrToken;
          if (!candidateToken) return false;
          const expectedSth = hashSessionToken(candidateToken);
          if (data.sth !== expectedSth) return false;
        }

        return true;
      } catch {
        return false;
      }
    }

      /**
       * Checks whether the current request session has completed admin MFA verification.
       */
      export async function isSessionMfaVerified(
        identity: AdminIdentity,
        req?: Request | Headers
      ): Promise<boolean> {
        // If user is not an administrator, MFA is not enforced
        if (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN") {
          return true;
        }

        let cookieVal: string | undefined = undefined;

          if (req) {
            if (typeof (req as any).get === "function") {
              const cookieHeader = (req as Headers).get("cookie") || "";
              const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_MFA_COOKIE_NAME}=([^;]+)`));
              cookieVal = match ? decodeURIComponent(match[1]) : undefined;
            } else if ("headers" in req && req.headers) {
              const h = req.headers as any;
              const cookieHeader = (typeof h?.get === "function" ? h.get("cookie") : h?.cookie) || "";
              const match = typeof cookieHeader === "string" ? cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_MFA_COOKIE_NAME}=([^;]+)`)) : null;
              cookieVal = match ? decodeURIComponent(match[1]) : undefined;
            }
          }

            if (!cookieVal) {
              try {
                const cookieStore = await cookies();
                cookieVal = cookieStore.get(ADMIN_MFA_COOKIE_NAME)?.value;
              } catch {
                // Out of cookie context
              }
            }

            if (!cookieVal) return false;

            const currentSessionToken = await getRequestSessionToken(req);

          return verifyAdminMfaToken(
            cookieVal,
            identity.id,
            identity.sessionVersion,
            identity.sessionId,
            currentSessionToken
          );
        }
