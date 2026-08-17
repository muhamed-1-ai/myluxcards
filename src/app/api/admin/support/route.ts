import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

const statuses = new Set(["OPEN","IN_PROGRESS","WAITING_CUSTOMER","RESOLVED","CLOSED"]);
const clean = (value: unknown, max: number) => String(value || "").trim().slice(0, max);

export async function GET() {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const tickets = await prisma.supportTicket.findMany({
      select: {
        id: true,
        reference: true,
        customerName: true,
        customerEmail: true,
        topic: true,
        contactTime: true,
        message: true,
        status: true,
        assignedTo: true,
        lastReplyAt: true,
        createdAt: true,
        replies: {
          select: {
            id: true,
            authorRole: true,
            message: true,
            emailedAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    const data = tickets.map(t => ({
      id: t.id,
      reference: t.reference,
      customer_name: t.customerName,
      customer_email: t.customerEmail,
      topic: t.topic,
      contact_time: t.contactTime,
      message: t.message,
      status: t.status,
      assigned_to: t.assignedTo,
      last_reply_at: t.lastReplyAt,
      created_at: t.createdAt,
      support_ticket_replies: t.replies.map(r => ({
        id: r.id,
        author_role: r.authorRole,
        message: r.message,
        emailed_at: r.emailedAt,
        created_at: r.createdAt,
      })),
    }));

    return Response.json({ data });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const id = clean(body.id, 50);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ message: "Invalid ticket." }, { status: 400 });
    
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return Response.json({ message: "Ticket not found." }, { status: 404 });

    const updateData: any = {};
    let emailDelivered: boolean | undefined;
    if (statuses.has(body.status)) updateData.status = body.status;
    if (body.assignToMe === true) updateData.assignedTo = actor.id;

    const reply = clean(body.reply, 4000);
    if (reply) {
      const replyAt = new Date().toISOString();
      // changes.last_reply_at = replyAt
      emailDelivered = false;
      let emailedAtDate: Date | null = null;
      const replyDate = new Date();

      if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `support-reply-${id}-${Date.now()}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [ticket.customerEmail],
            subject: `Re: ${ticket.reference} — MyLuxCards Support`,
            html: `<p>Hello ${escapeHtml(ticket.customerName)},</p><p>${escapeHtml(reply).replaceAll("\n", "<br>")}</p><p>Reference: ${escapeHtml(ticket.reference)}</p>`,
          }),
        });
        if (!response.ok) return Response.json({ message: "The reply email could not be delivered. Nothing was marked as sent." }, { status: 502 });
        emailedAtDate = replyDate;
        emailDelivered = true;
      }

      await prisma.supportTicketReply.create({
        data: {
          ticketId: id,
          authorId: actor.id,
          authorRole: actor.role,
          message: reply,
          emailedAt: emailedAtDate,
        },
      });

      updateData.lastReplyAt = replyDate;
      updateData.status = body.status && statuses.has(body.status) ? body.status : "WAITING_CUSTOMER";
    }

    await prisma.supportTicket.update({
      where: { id },
      data: updateData,
    });

    await audit(actor, "SUPPORT_TICKET_UPDATED", "support_ticket", id, { status: ticket.status }, { status: updateData.status, replied: Boolean(reply) });
    return Response.json({ ok: true, emailDelivered });
  } catch (error) { return safeError(error); }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as any)[c]);
}
