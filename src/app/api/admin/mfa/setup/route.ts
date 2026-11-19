import { NextResponse } from "next/server";
import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import {
  generateMfaEnrollmentSetup,
  getAdminMfaStatus,
  isSessionMfaVerified,
} from "@/lib/auth/adminMfa";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity(request);
  if (!identity) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (identity.role !== "ADMIN" && identity.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Forbidden: Admin access required." }, { status: 403 });
  }

  const currentStatus = await getAdminMfaStatus(identity.id);
  // Re-enrollment guard: if already enrolled, current session must be MFA-verified to prevent unauthorized overwrite
  if (currentStatus.enrolled) {
    const isVerified = await isSessionMfaVerified(identity, request);
    if (!isVerified) {
      return NextResponse.json(
        { message: "Admin MFA is already configured. Re-configuration requires active MFA verification." },
        { status: 403 }
      );
    }
  }

  const setup = await generateMfaEnrollmentSetup({
    id: identity.id,
    email: identity.email,
  });

  return NextResponse.json({
    secret: setup.secret,
    otpauthUri: setup.otpauthUri,
    qrDataUrl: setup.qrDataUrl,
    recoveryCodes: setup.recoveryCodes,
    alreadyEnrolled: currentStatus.enrolled,
  });
}
