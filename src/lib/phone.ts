/**
 * Normalizes phone numbers to standard E.164 format.
 * Defaults to India (+91) country prefix when a 10-digit national number is supplied.
 */
export function normalizePhoneNumber(rawPhone: string, defaultCountryPrefix = "+91"): {
  original: string;
  normalized: string;
  isValid: boolean;
} {
  const original = (rawPhone || "").trim();
  if (!original) {
    return { original: "", normalized: "", isValid: false };
  }

  // Strip all non-digit characters except leading +
  let cleaned = original.replace(/(?!^\+)\D/g, "");

  // If starts with +, ensure format +[digits]
  if (cleaned.startsWith("+")) {
    const digitsOnly = cleaned.slice(1);
    const isValid = digitsOnly.length >= 7 && digitsOnly.length <= 15;
    return { original, normalized: `+${digitsOnly}`, isValid };
  }

  // Handle leading 0 for 10-digit national numbers (e.g. 09876543210 -> 9876543210)
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }

  // If 10 digits without prefix (e.g., 9876543210)
  if (cleaned.length === 10) {
    const prefix = defaultCountryPrefix.startsWith("+") ? defaultCountryPrefix : `+${defaultCountryPrefix}`;
    const normalized = `${prefix}${cleaned}`;
    return { original, normalized, isValid: true };
  }

  // If 12 digits starting with country code (e.g. 919876543210)
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return { original, normalized: `+${cleaned}`, isValid: true };
  }

  // Fallback for raw digit sequence (7-15 digits)
  const isValid = cleaned.length >= 7 && cleaned.length <= 15;
  const normalized = isValid ? (cleaned.startsWith("+") ? cleaned : `+${cleaned}`) : cleaned;

  return { original, normalized, isValid };
}
