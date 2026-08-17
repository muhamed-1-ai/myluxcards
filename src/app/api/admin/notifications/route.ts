import { requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize")) || 25));
    
    const [total, notifications] = await prisma.$transaction([
      prisma.adminNotification.count(),
      prisma.adminNotification.findMany({
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          orderId: true,
          readAt: true,
          emailRecipient: true,
          emailedAt: true,
          emailError: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const data = notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      order_id: n.orderId,
      read_at: n.readAt,
      email_recipient: n.emailRecipient,
      emailed_at: n.emailedAt,
      email_error: n.emailError,
      created_at: n.createdAt,
    }));

    return Response.json({ data, page, pageSize, total });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin();
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") return Response.json({ message: "Invalid notification." }, { status: 400 });

    const existing = await prisma.adminNotification.findUnique({ where: { id: body.id } });
    if (!existing) return Response.json({ message: "Notification not found." }, { status: 404 });

    const updated = await prisma.adminNotification.update({
      where: { id: body.id },
      data: { readAt: body.read === false ? null : new Date() },
    });

    return Response.json({
      data: {
        id: updated.id,
        type: updated.type,
        title: updated.title,
        message: updated.message,
        order_id: updated.orderId,
        read_at: updated.readAt,
        email_recipient: updated.emailRecipient,
        emailed_at: updated.emailedAt,
        email_error: updated.emailError,
        created_at: updated.createdAt,
      },
    });
  } catch (error) { return safeError(error); }
}
