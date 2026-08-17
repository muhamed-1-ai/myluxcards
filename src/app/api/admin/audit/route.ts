import { requireAdmin, safeError } from "@/lib/adminAuth";
import { prisma } from "@/lib/db/prisma";
export const runtime = "nodejs";

export async function GET() {
  const actor = await requireAdmin(true);
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const logs = await prisma.adminAuditLog.findMany({
      select: {
        id: true,
        actorId: true,
        actorRole: true,
        action: true,
        entityType: true,
        entityId: true,
        beforeSummary: true,
        afterSummary: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const data = logs.map(l => ({
      id: l.id,
      actor_id: l.actorId,
      actor_role: l.actorRole,
      action: l.action,
      entity_type: l.entityType,
      entity_id: l.entityId,
      before_summary: l.beforeSummary,
      after_summary: l.afterSummary,
      ip_address: l.ipAddress,
      user_agent: l.userAgent,
      created_at: l.createdAt,
    }));

    return Response.json({ data });
  } catch (error) { return safeError(error); }
}
