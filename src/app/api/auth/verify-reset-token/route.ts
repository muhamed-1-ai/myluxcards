import { NextResponse } from "next/server";
import { verifyResetToken } from "@/lib/auth/passwordRecovery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";

  const result = await verifyResetToken(token);

  return NextResponse.json(
    { valid: result.valid, message: result.message },
    {
      status: result.valid ? 200 : 400,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
      },
    }
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";

  const result = await verifyResetToken(token);

  return NextResponse.json(
    { valid: result.valid, message: result.message },
    {
      status: result.valid ? 200 : 400,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        Pragma: "no-cache",
      },
    }
  );
}
