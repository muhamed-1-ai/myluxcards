import { NextResponse } from "next/server";
import { currentIdentity } from "@/lib/auth/currentIdentity";
import { validMutationOrigin } from "@/lib/adminAuth";
import { requestPasswordSetupForAuthenticatedUser } from "@/lib/auth/passwordRecovery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ message: "Unauthorized. Please sign in." }, { status: 401 });
  }

  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : realIp || "unknown";

    const result = await requestPasswordSetupForAuthenticatedUser(identity.id, clientIp);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    return NextResponse.json(
      { ok: true, message: result.message },
      { status: 200, headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (error) {
    console.error("[Auth][SetupPassword] Unexpected error:", error);
    return NextResponse.json(
      { message: "Unable to process password setup request. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
