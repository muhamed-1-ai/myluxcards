import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/webpush";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publicKey = getVapidPublicKey();
    return NextResponse.json({ publicKey });
  } catch (error: any) {
    console.error("[VAPID Public Key GET] Error:", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve VAPID key" },
      { status: 500 }
    );
  }
}
