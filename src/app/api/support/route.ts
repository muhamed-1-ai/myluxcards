import { createHash, randomUUID } from "node:crypto";
import { requestContext, validMutationOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

const topics: Record<string, string> = {
  account: "Account & Login",
  design: "Design & Editing",
  download: "Download & Delivery",
  billing: "Billing & Payments",
  general: "General Question",
};
const text = (value: unknown, limit: number) => String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, limit);

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    // Quietly accept bot-filled honeypots without creating admin noise.
    if (text(body.companyWebsite, 200)) return Response.json({ ok: true, reference: "TKT-RECEIVED" }, { status: 202 });
    const name = text(body.name, 120);
    const email = text(body.email, 254).toLowerCase();
    const topic = text(body.topic, 32);
    const contactTime = text(body.contactTime, 160);
    const message = text(body.message, 4000);
    if (name.length < 2) return Response.json({ message: "Enter your full name." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ message: "Enter a valid email address." }, { status: 400 });
    if (!topics[topic]) return Response.json({ message: "Select a valid support topic." }, { status: 400 });
    if (message.length < 10) return Response.json({ message: "Please describe the issue in at least 10 characters." }, { status: 400 });

    const context = await requestContext();
    const fingerprint = createHash("sha256").update(`${context.ip || "unknown"}|${email}`).digest("hex").slice(0, 24);
    const since = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentCount = await prisma.supportTicket.count({
      where: {
        fingerprint,
        createdAt: { gte: since },
      },
    });
    if (recentCount >= 3) return Response.json({ message: "Too many support requests. Please wait an hour before trying again." }, { status: 429 });

    const id = randomUUID();
    const reference = `TKT-${id.slice(0, 8).toUpperCase()}`;
    const eventKey = `support-${fingerprint}-${id}`;
    const title = `New support ticket ${reference}: ${topics[topic]}`;
    const notificationMessage = `${name} · ${email}${contactTime ? ` · Best contact: ${contactTime}` : ""} · ${message}`;
    const recipient = process.env.SUPER_ADMIN_NOTIFICATION_EMAIL?.trim() || null;
    
    await prisma.$transaction([
      prisma.supportTicket.create({
        data: {
          id,
          reference,
          customerName: name,
          customerEmail: email,
          topic: topics[topic],
          contactTime: contactTime || null,
          message,
          fingerprint,
        },
      }),
      // admin_notifications logging
      prisma.adminNotification.create({
        data: {
          eventKey,
          type: "SUPPORT_TICKET",
          title,
          message: notificationMessage,
          emailRecipient: recipient,
        },
      }),
    ]);

    if (recipient && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": eventKey },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM, to: [recipient], subject: title,
            html: `<h1>${escapeHtml(title)}</h1><p><strong>Customer:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p><p><strong>Best contact:</strong> ${escapeHtml(contactTime || "Not specified")}</p><p><strong>Message:</strong> ${escapeHtml(message)}</p><p><a href="${escapeHtml((process.env.APP_URL || "https://myluxcards.vercel.app").replace(/\/$/, ""))}/admin">Open Admin notifications</a></p>`,
          }), cache: "no-store",
        });
        await prisma.adminNotification.update({
          where: { eventKey },
          data: response.ok ? { emailedAt: new Date(), emailError: null } : { emailError: `Delivery failed (${response.status})` },
        }).catch(() => null);
      } catch { /* The in-dashboard notification is already safely stored. */ }
    }
    return Response.json({ ok: true, reference }, { status: 201 });
  } catch (error) {
    console.error("Support submission failed:", error);
    return Response.json({ message: "Your support request could not be submitted. Please try again." }, { status: 500 });
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}
