import "server-only";
import { getAppOrigin } from "../url";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
}

export interface EmailDeliveryResult {
  ok: boolean;
  provider?: "resend" | "smtp" | "unconfigured";
  error?: string;
  messageId?: string;
}

/**
 * Escapes dynamic content into safe HTML entities to prevent HTML/XSS injection in emails.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

/**
 * Delivers transactional emails with automatic failover/fallback between Resend REST API
 * and standard SMTP transport, with bounded retries and error isolation.
 */
export async function sendTransactionalEmail(options: SendEmailOptions): Promise<EmailDeliveryResult> {
  const from = process.env.EMAIL_FROM || "ZAPPIT <no-reply@3gzappit.com>";
  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;

  // 1. Try Resend API if configured
  if (resendApiKey) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
            ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey.slice(0, 256) } : {}),
          },
          body: JSON.stringify({
            from,
            to: [options.to],
            subject: options.subject,
            html: options.html,
            text: options.text,
          }),
          cache: "no-store",
        });

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          return { ok: true, provider: "resend", messageId: data.id };
        }

        const errText = await response.text().catch(() => "Unknown Resend error");
        console.error(`[Email][Resend] Attempt ${attempt} failed: HTTP ${response.status} - ${errText}`);
      } catch (err) {
        console.error(`[Email][Resend] Attempt ${attempt} network error:`, err instanceof Error ? err.message : err);
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 600));
    }
  }

  // 2. Try SMTP via nodemailer if configured
  if (smtpHost) {
    try {
      const nodemailer = await import("nodemailer");
      const port = Number(process.env.SMTP_PORT) || 587;
      const secure = process.env.SMTP_SECURE === "true" || port === 465;

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "",
            }
          : undefined,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === "production",
        },
      });

      const info = await transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      return { ok: true, provider: "smtp", messageId: info.messageId };
    } catch (err) {
      console.error("[Email][SMTP] Delivery error:", err instanceof Error ? err.message : err);
      return { ok: false, provider: "smtp", error: err instanceof Error ? err.message : "SMTP delivery failed" };
    }
  }

  // 3. Fallback: neither Resend nor SMTP is configured in current environment
  console.warn(
    `[Email] Transactional email credentials not configured (RESEND_API_KEY or SMTP_HOST missing in env). Email to ${options.to} not dispatched.`
  );
  return {
    ok: false,
    provider: "unconfigured",
    error: "Transactional email provider is not configured.",
  };
}

/**
 * Builds and sends the Password Recovery Email with 15-minute expiration notice and safe link.
 */
export async function sendPasswordResetEmail(input: {
  to: string;
  name?: string;
  resetUrl: string;
  expiresMinutes?: number;
}): Promise<EmailDeliveryResult> {
  const name = input.name?.trim() || "User";
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(input.resetUrl);
  const minutes = input.expiresMinutes || 15;

  const subject = "Reset your ZAPPIT password";

  const text = `Hello ${name},

We received a request to reset the password for your ZAPPIT account.

You can reset your password by opening the following link:
${input.resetUrl}

This link will expire in ${minutes} minutes and can only be used once.

If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged and your account remains secure.

— The ZAPPIT Team
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 36px 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
    .brand { font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 12px 0; }
    .btn-wrap { margin: 28px 0; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 13px 28px; text-decoration: none; border-radius: 10px; }
    .muted { font-size: 13px; color: #94a3b8; line-height: 1.5; margin-top: 24px; border-top: 1px solid #334155; padding-top: 20px; }
    .link-fallback { word-break: break-all; color: #38bdf8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">ZAPPIT</div>
    <h1>Password Recovery Request</h1>
    <p>Hello ${safeName},</p>
    <p>We received a request to reset the password for your ZAPPIT account. Click the button below to choose a new password:</p>
    <div class="btn-wrap">
      <a href="${safeUrl}" class="btn" target="_blank" rel="noopener noreferrer">Reset Password</a>
    </div>
    <p>This recovery link expires in <strong>${minutes} minutes</strong> and can only be used once.</p>
    <p class="muted">
      If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged and your account remains protected.<br><br>
      Button not working? Copy and paste this URL into your browser:<br>
      <span class="link-fallback">${safeUrl}</span>
    </p>
  </div>
</body>
</html>`;

  return sendTransactionalEmail({
    to: input.to,
    subject,
    text,
    html,
  });
}

/**
 * Builds and sends the Password Changed Notification Email.
 * Crucial security requirement: Never includes passwords or reset tokens.
 */
export async function sendPasswordChangedEmail(input: {
  to: string;
  name?: string;
}): Promise<EmailDeliveryResult> {
  const name = input.name?.trim() || "User";
  const safeName = escapeHtml(name);
  const appOrigin = getAppOrigin();
  const safeOrigin = escapeHtml(appOrigin);

  const subject = "Your ZAPPIT password was changed";

  const text = `Hello ${name},

The password for your ZAPPIT account (${input.to}) was recently changed.

All existing sessions across your devices have been signed out for security.

If you made this change, no further action is required. You can sign in using your new password at:
${appOrigin}

If you did NOT change your password, please reset your password immediately or contact your administrator to protect your account.

— The ZAPPIT Team
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 36px 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
    .brand { font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    .alert-box { background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 14px 18px; color: #34d399; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 12px 0; }
    .btn-wrap { margin: 24px 0; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 24px; text-decoration: none; border-radius: 10px; }
    .warning { font-size: 13px; color: #f87171; line-height: 1.5; margin-top: 24px; border-top: 1px solid #334155; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">ZAPPIT</div>
    <div class="alert-box">✓ Password Successfully Updated</div>
    <h1>Password Change Confirmation</h1>
    <p>Hello ${safeName},</p>
    <p>The password for your ZAPPIT account (<strong>${escapeHtml(input.to)}</strong>) has been changed successfully.</p>
    <p>For your security, all active sessions on your other browsers and mobile devices have been invalidated.</p>
    <div class="btn-wrap">
      <a href="${safeOrigin}" class="btn" target="_blank" rel="noopener noreferrer">Sign in to ZAPPIT</a>
    </div>
    <p class="warning">
      <strong>Didn't make this change?</strong><br>
      If you did not make this change, please immediately reset your password using the "Forgot Password" link on the login page or contact your organization administrator.
    </p>
  </div>
</body>
</html>`;

  return sendTransactionalEmail({
    to: input.to,
    subject,
    text,
    html,
  });
}

/**
 * Informational email dispatched when a user attempts password recovery for an account
 * that authenticates solely through Google Sign-In (no local password exists).
 */
export async function sendGoogleAccountRecoveryInfoEmail(input: {
  to: string;
  name?: string;
}): Promise<EmailDeliveryResult> {
  const name = input.name?.trim() || "User";
  const safeName = escapeHtml(name);
  const appOrigin = getAppOrigin();
  const safeOrigin = escapeHtml(appOrigin);

  const subject = "Sign in to ZAPPIT with Google";

  const text = `Hello ${name},

We received a password reset request for ${input.to}.

Your ZAPPIT account is configured to sign in with Google. It does not use a standalone password.

To access your account, simply open ZAPPIT and click "Continue with Google":
${appOrigin}

If you did not make this request, you can safely ignore this email.

— The ZAPPIT Team
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 36px 32px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
    .brand { font-size: 22px; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; margin-bottom: 24px; }
    h1 { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 12px 0; }
    .btn-wrap { margin: 24px 0; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 24px; text-decoration: none; border-radius: 10px; }
    .muted { font-size: 13px; color: #94a3b8; line-height: 1.5; margin-top: 24px; border-top: 1px solid #334155; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">ZAPPIT</div>
    <h1>Google Sign-In Account</h1>
    <p>Hello ${safeName},</p>
    <p>We received a password reset request for <strong>${escapeHtml(input.to)}</strong>.</p>
    <p>Your ZAPPIT account is managed through <strong>Google Sign-In</strong> and does not use a local password.</p>
    <div class="btn-wrap">
      <a href="${safeOrigin}" class="btn" target="_blank" rel="noopener noreferrer">Sign In with Google</a>
    </div>
    <p class="muted">
      If you did not request this, you can safely ignore this email. Your Google account credentials remain secure.
    </p>
  </div>
</body>
</html>`;

  return sendTransactionalEmail({
    to: input.to,
    subject,
    text,
    html,
  });
}
