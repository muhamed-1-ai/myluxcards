import { NextResponse } from "next/server";
import { requestPasswordRecovery } from "@/lib/auth/passwordRecovery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";

    // Extract client IP safely for distributed rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : realIp || "unknown";

    const result = await requestPasswordRecovery(email, clientIp);

    return NextResponse.json(
      { ok: result.ok, message: result.message },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("[Auth][ForgotPassword] Unexpected error:", error);
    // Never expose stack traces or specific server errors to prevent enumeration
    return NextResponse.json(
      { ok: true, message: "If this account is eligible, we’ll email you a link to set or reset your password." },
      { status: 200, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
