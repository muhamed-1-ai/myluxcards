import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { COOKIE_VERSION, PRIVACY_VERSION, TERMS_VERSION, hasCurrentConsent } from "@/lib/config/legal";
import { updateUserLegalConsent } from "@/lib/repositories/users";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({
      authenticated: false,
      hasConsent: false,
      requiredVersions: {
        terms: TERMS_VERSION,
        privacy: PRIVACY_VERSION,
        cookie: COOKIE_VERSION,
      },
    }, { status: 200 });
  }

  const consentValid = hasCurrentConsent(identity);

  return Response.json({
    authenticated: true,
    hasConsent: consentValid,
    requiredVersions: {
      terms: TERMS_VERSION,
      privacy: PRIVACY_VERSION,
      cookie: COOKIE_VERSION,
    },
    consent: {
      termsAccepted: Boolean(identity.terms_accepted),
      privacyAccepted: Boolean(identity.privacy_accepted),
      cookieConsent: Boolean(identity.cookie_consent),
      termsVersion: identity.terms_version ?? null,
      privacyVersion: identity.privacy_version ?? null,
      cookieVersion: identity.cookie_version ?? null,
      legalAcceptedAt: identity.legal_accepted_at ? identity.legal_accepted_at.toISOString() : null,
    },
  });
}

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    if (!body.termsAccepted || !body.privacyAccepted || !body.cookieConsent) {
      return Response.json(
        { message: "All required consent checkboxes (Terms, Privacy, and Cookie Policy) must be accepted." },
        { status: 400 }
      );
    }

    const updatedUser = await updateUserLegalConsent(
      identity.id,
      TERMS_VERSION,
      PRIVACY_VERSION,
      COOKIE_VERSION
    );

    if (!updatedUser) {
      return Response.json({ message: "Failed to update legal consent record." }, { status: 500 });
    }

    const response = Response.json({
      success: true,
      hasConsent: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        termsAccepted: updatedUser.terms_accepted,
        privacyAccepted: updatedUser.privacy_accepted,
        cookieConsent: updatedUser.cookie_consent,
        legalAcceptedAt: updatedUser.legal_accepted_at,
      },
      message: "Legal and cookie consent recorded successfully.",
    });

    const isSecure = process.env.NODE_ENV === "production" || request.url.startsWith("https:");
    response.headers.append(
      "Set-Cookie",
      `zappit_consent=${COOKIE_VERSION}; Path=/; SameSite=Lax; Max-Age=31536000${isSecure ? "; Secure" : ""}`
    );

    return response;
  } catch (error) {
    return safeError(error);
  }
}
