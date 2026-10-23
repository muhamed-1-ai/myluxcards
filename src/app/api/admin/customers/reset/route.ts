import { requireAdmin, validMutationOrigin, safeError } from "@/lib/adminAuth";
import { requestPasswordResetByAdmin } from "@/lib/auth/passwordRecovery";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const actor = await requireAdmin(request);
  if (!actor) {
    return Response.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.id !== "string") {
      return Response.json({ message: "Invalid customer." }, { status: 400 });
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : realIp || "unknown";

    const result = await requestPasswordResetByAdmin({
      adminId: actor.id,
      adminRole: actor.role,
      targetUserId: body.id,
      clientIp,
    });

    if (!result.ok) {
      const status =
        result.code === "USER_NOT_FOUND"
          ? 404
          : result.code === "FORBIDDEN"
          ? 403
          : result.code === "RATE_LIMITED"
          ? 429
          : result.status === "unconfigured"
          ? 503
          : 400;

      return Response.json(
        { ok: false, message: result.message, code: result.code, status: result.status },
        { status }
      );
    }

    return Response.json({
      ok: true,
      message: result.message,
      targetEmail: result.targetEmail,
    });
  } catch (error) {
    return safeError(error);
  }
}
