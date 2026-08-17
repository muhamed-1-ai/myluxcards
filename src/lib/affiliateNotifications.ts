import { supabaseJson } from "./supabaseAuth";

type AffiliateEmail = {
  eventKey: string;
  eventType: string;
  recipient: string;
  subject: string;
  heading: string;
  message: string;
  affiliateId?: string;
  actionPath?: string;
};

export async function sendAffiliateEmail(input: AffiliateEmail) {
  const recipient = input.recipient.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return { email: "invalid-recipient" as const };
  try {
    await supabaseJson("/rest/v1/affiliate_email_events", {
      method: "POST",
      body: JSON.stringify({
        event_key: input.eventKey,
        affiliate_id: input.affiliateId || null,
        event_type: input.eventType,
        recipient,
      }),
    }, true);
  } catch (error) {
    if ((error as { status?: number }).status === 409) return { duplicate: true };
    throw error;
  }

  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !appUrl) {
    return { created: true, email: "not-configured" as const };
  }
  const actionUrl = input.actionPath ? `${appUrl}${input.actionPath.startsWith("/") ? input.actionPath : "/"}` : null;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.eventKey.slice(0, 256),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [recipient],
      subject: input.subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h1>${escapeHtml(input.heading)}</h1>
        <p>${escapeHtml(input.message)}</p>
        ${actionUrl ? `<p><a href="${escapeHtml(actionUrl)}">Open MyLuxCards</a></p>` : ""}
        <p style="color:#666">This message contains no password, payment credentials, or private customer information.</p>
      </div>`,
    }),
    cache: "no-store",
  });
  await supabaseJson(`/rest/v1/affiliate_email_events?event_key=eq.${encodeURIComponent(input.eventKey)}`, {
    method: "PATCH",
    body: JSON.stringify(response.ok
      ? { sent_at: new Date().toISOString(), error: null }
      : { error: `Delivery failed (${response.status})` }),
  }, true);
  return { created: true, email: response.ok ? "sent" as const : "failed" as const };
}

export async function notifyAffiliateAdmin(eventKey: string, title: string, message: string, affiliateId?: string) {
  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SUPER_ADMIN_NOTIFICATION_EMAIL;
  await supabaseJson("/rest/v1/admin_notifications", {
    method: "POST",
    body: JSON.stringify({
      event_key: eventKey,
      type: "AFFILIATE",
      title,
      message,
      email_recipient: recipient || null,
    }),
  }, true).catch((error) => {
    if ((error as { status?: number }).status !== 409) throw error;
  });
  if (recipient) {
    return sendAffiliateEmail({
      eventKey: `${eventKey}:admin`,
      eventType: "AFFILIATE_ADMIN",
      recipient,
      subject: title,
      heading: title,
      message,
      affiliateId,
      actionPath: "/admin/affiliates",
    });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] || character);
}
