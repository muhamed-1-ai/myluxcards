import { audit, requireAdmin, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { normalizeEmail } from "@/lib/repositories/users";
import { prisma } from "@/lib/db/prisma";
import { createHash, randomBytes } from "node:crypto";

export async function GET() {
  const actor = await requireAdmin(true);
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const data = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
      select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ data });
  } catch (error) { return safeError(error); }
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin(true);
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(String(body.email || ""));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ message: "Enter a valid email." }, { status: 400 });
    const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await prisma.adminInvite.create({
      data: {
        email,
        normalizedEmail: email,
        role: "ADMIN",
        tokenHash,
        invitedBy: actor.id,
        expiresAt,
      },
    });

    await audit(actor, "ADMIN_INVITED", "admin_invite", email, null, { email, role: "ADMIN" });
    return Response.json({ message: "Invite recorded. Configure the email provider before distributing invites." }, { status: 201 });
  } catch (error) { return safeError(error); }
}

export async function PATCH(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await requireAdmin(true);
  if (!actor) return Response.json({ message: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string" || body.id === actor.id) return Response.json({ message: "Invalid target." }, { status: 400 });
    
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: body.id },
        select: { id: true, role: true, disabled: true },
      });
      // target.role==="SUPER_ADMIN"
      if (!target || target.role === "SUPER_ADMIN") return null;

      const role = body.role === "ADMIN" || body.role === "CUSTOMER" ? body.role : target.role;
      const disabled = typeof body.disabled === "boolean" ? body.disabled : target.disabled;
      const status = disabled ? "DISABLED" : "ACTIVE";

      await tx.user.update({
        where: { id: body.id },
        data: {
          role,
          disabled,
          status,
          sessionVersion: { increment: 1 },
        },
      });

      return { target, changes: { role, disabled, status } };
    });

    if (!result) return Response.json({ message: "Super Admin accounts cannot be changed here." }, { status: 403 });
    await audit(actor, "ADMIN_ACCESS_CHANGED", "user", body.id, result.target, result.changes);
    return Response.json({ ok: true });
  } catch (error) { return safeError(error); }
}
