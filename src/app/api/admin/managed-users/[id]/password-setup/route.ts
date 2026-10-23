import { NextResponse } from "next/server";
import { requireAdmin, validMutationOrigin, safeError } from "@/lib/adminAuth";
import { requestPasswordSetupByAdmin } from "@/lib/auth/passwordRecovery";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    // 1. CSRF Origin validation
    if (!validMutationOrigin(request)) {
      return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
    }

    // 2. Server-side administrative session verification
    const admin = await requireAdmin(request);
    if (!admin) {
      return NextResponse.json({ message: "Forbidden. Administrative access required." }, { status: 403 });
    }

    const params = await props.params;
    const targetUserId = params.id;
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json({ message: "Invalid target user." }, { status: 400 });
    }

    // Client IP for abuse prevention & audit logging
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : realIp || "unknown";

    // 3. Initiate verified admin password setup
    const result = await requestPasswordSetupByAdmin({
      adminId: admin.id,
      adminRole: admin.role,
      targetUserId,
      clientIp,
    });

    if (!result.ok) {
      const statusCode =
        result.code === "USER_NOT_FOUND"
          ? 404
          : result.code === "FORBIDDEN"
          ? 403
          : result.code === "RATE_LIMITED"
          ? 429
          : result.status === "unconfigured"
          ? 503
          : 400;

      return NextResponse.json(
        {
          ok: false,
          code: result.code,
          status: result.status,
          message: result.message,
        },
        { status: statusCode, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        status: result.status || "sent",
        message: result.message,
        targetEmail: result.targetEmail,
      },
      { status: 200, headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (error) {
    return safeError(error);
  }
}
