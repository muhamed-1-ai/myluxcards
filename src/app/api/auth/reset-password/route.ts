import { NextResponse } from "next/server";
import { redeemResetToken } from "@/lib/auth/passwordRecovery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token || !password) {
      return NextResponse.json(
        { message: "The reset link or password is invalid." },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const result = await redeemResetToken(token, password);

    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    return NextResponse.json(
      { ok: true, message: result.message },
      { status: 200, headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (error) {
    console.error("[Auth][ResetPassword] Unexpected error:", error);
    return NextResponse.json(
      { message: "Unable to complete password reset. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
