import { NextResponse } from "next/server";
import { currentIdentity } from "@/lib/adminAuth";
import { getAdminMfaStatus, isSessionMfaVerified } from "@/lib/auth/adminMfa";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const mfaStatus = await getAdminMfaStatus(identity.id);
  const isVerified = await isSessionMfaVerified(identity, request);

  return NextResponse.json({
    enrolled: mfaStatus.enrolled,
    enrolledAt: mfaStatus.enrolledAt,
    recoveryCodesRemaining: mfaStatus.recoveryCodesRemaining,
    verified: isVerified,
    role: identity.role,
    email: identity.email,
  });
}
