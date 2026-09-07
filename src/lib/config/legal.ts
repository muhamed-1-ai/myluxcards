import type { UserRow } from "@/types/database";

export const TERMS_VERSION = "1.0";
export const PRIVACY_VERSION = "1.0";
export const COOKIE_VERSION = "1.0";

export interface LegalConsentState {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  cookieConsent: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
  cookieVersion: string | null;
  legalAcceptedAt: string | null;
}

export function hasCurrentConsent(user: Partial<UserRow> | null | undefined): boolean {
  if (!user) return false;

  const termsValid = Boolean(user.terms_accepted) && user.terms_version === TERMS_VERSION;
  const privacyValid = Boolean(user.privacy_accepted) && user.privacy_version === PRIVACY_VERSION;
  const cookieValid = Boolean(user.cookie_consent) && user.cookie_version === COOKIE_VERSION;

  return termsValid && privacyValid && cookieValid;
}
