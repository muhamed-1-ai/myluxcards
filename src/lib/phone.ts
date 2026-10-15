/**
 * Country-Aware Phone Number Normalization Utility for 3G ZAPPIT
 * 
 * Produces validated, idempotent E.164 international numbers and structured link targets:
 * - tel: URI for mobile phone dialers (RFC 3966)
 * - sms: URI for text messaging
 * - wa.me URI for WhatsApp direct chats (digits only without leading +)
 * - Clean formatted display representation
 * 
 * Supports:
 * - National 10-digit numbers with separate country code (e.g. 9876543210 + IN -> +919876543210)
 * - Already normalized E.164 numbers (e.g. +919876543210 -> +919876543210)
 * - Formatted numbers with spaces/hyphens/parentheses (e.g. +91 98765 43210 -> +919876543210)
 * - Indian national numbers that start with 91 (e.g. 9123456789 -> +919123456789)
 * - Confirmed country-prefixed numbers without + (e.g. 919876543210 -> +919876543210)
 * - Foreign numbers with international prefix (e.g. +14155552671, +447911123456)
 * - Idempotent execution: normalize(normalize(x)) === normalize(x)
 * - Graceful validation for empty, truncated, or invalid input
 */

export interface NormalizedPhone {
  original: string;
  normalized: string;        // E.164 canonical representation: e.g. "+919876543210"
  e164: string;              // Alias for normalized
  digits: string;            // Clean digits with country code: e.g. "919876543210"
  waDigits: string;          // Alias for digits (ideal for wa.me links)
  telLink: string;           // RFC 3966 tel URI: e.g. "tel:+919876543210"
  smsLink: string;           // SMS URI: e.g. "sms:+919876543210"
  waLink: string;            // WhatsApp URL: e.g. "https://wa.me/919876543210"
  displayFormatted: string;  // Human-readable formatted string: e.g. "+91 98765 43210"
  isValid: boolean;          // True if input conforms to international telephony standards
  error?: string;            // Helpful validation message when invalid
}

const ISO_TO_CALLING_CODE: Record<string, string> = {
  IN: "91", US: "1", CA: "1", GB: "44", UK: "44", AE: "971", SA: "966",
  QA: "974", OM: "968", KW: "965", BH: "973", SG: "65", MY: "60",
  AU: "61", NZ: "64", DE: "49", FR: "33", IT: "39", ES: "34", NL: "31",
  ZA: "27", BR: "55", JP: "81", CN: "86", KR: "82", RU: "7",
};

/**
 * Resolves a numeric country calling code from an ISO code, a dial string, or fallback.
 */
export function extractCallingCode(countryContext?: string | null, fallback = "91"): string {
  if (!countryContext) return fallback;
  const trimmed = String(countryContext).trim().toUpperCase();
  if (!trimmed) return fallback;

  if (ISO_TO_CALLING_CODE[trimmed]) {
    return ISO_TO_CALLING_CODE[trimmed];
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 1 && digits.length <= 4) {
    return digits;
  }

  return fallback;
}

/**
 * Normalizes any phone number into canonical E.164 and derived action links.
 */
export function normalizePhoneNumber(
  rawPhone?: string | null,
  countryContext?: string | null,
  defaultCountryPrefix = "+91"
): NormalizedPhone {
  const original = (rawPhone ?? "").trim();
  const emptyResult: NormalizedPhone = {
    original,
    normalized: "",
    e164: "",
    digits: "",
    waDigits: "",
    telLink: "",
    smsLink: "",
    waLink: "",
    displayFormatted: "",
    isValid: false,
    error: "Phone number is empty.",
  };

  if (!original) {
    return emptyResult;
  }

  const defaultCc = extractCallingCode(defaultCountryPrefix, "91");
  const ccDigits = extractCallingCode(countryContext, defaultCc);

  // Check if input had an explicit international indicator (+) or (00)
  const is00Prefixed = /^00[1-9]/.test(original);
  const isPlusPrefixed = original.startsWith("+");
  const hasInternationalPrefix = isPlusPrefixed || is00Prefixed;

  // Extract pure numeric digits
  let digitsOnly = original.replace(/\D/g, "");
  if (is00Prefixed) {
    digitsOnly = digitsOnly.slice(2);
  }

  if (!digitsOnly) {
    return {
      ...emptyResult,
      error: "Phone number contains no numeric digits.",
    };
  }

  let finalDigits = digitsOnly;

  if (hasInternationalPrefix) {
    // Input explicitly declared international format with leading + or 00.
    // If it starts with a duplicated country code (e.g. +91 91... with 13 or 14 digits for India):
    // Note: Valid Indian 10-digit number starting with 91 is only 12 digits (+91 91xxxxxxxx).
    // Length >= 13 starting with 9191 is a confirmed duplicated prefix error.
    if (ccDigits === "91" && finalDigits.length >= 13 && finalDigits.startsWith("9191")) {
      finalDigits = finalDigits.slice(2);
    }
  } else {
    // Domestic / un-prefixed number.
    // Strip domestic trunk prefix '0' if present (e.g. 09876543210 -> 9876543210)
    if (finalDigits.startsWith("0") && finalDigits.length >= 10) {
      finalDigits = finalDigits.slice(1);
    }

    if (ccDigits === "91") {
      // INDIA SPECIFIC LOGIC:
      // Valid Indian national numbers (NSN) have exactly 10 digits.
      if (finalDigits.length === 10) {
        // Even if it starts with 91 (e.g. 9123456789), it is a 10-digit national number!
        // We preserve national digits and prepend country calling code +91.
        finalDigits = `91${finalDigits}`;
      } else if (finalDigits.length === 12 && finalDigits.startsWith("91")) {
        // 12 digits starting with 91 -> confirmed country-prefixed without + (91 + 10 digits).
        // Already contains the country code, keep as-is.
      } else if (finalDigits.length === 11 && finalDigits.startsWith("91")) {
        // 11 digits starting with 91 -> test or truncated number already having 91 prefix.
        // Keep as-is to prevent introducing a duplicate 91.
      } else if (finalDigits.length >= 13 && finalDigits.startsWith("9191")) {
        // Duplicated 91 prefix without + -> strip one 91
        finalDigits = finalDigits.slice(2);
      } else if (finalDigits.length < 10) {
        // Shorter than standard national number, attach country prefix
        finalDigits = `91${finalDigits}`;
      } else {
        // Fallback: If not starting with 91, prepend 91
        if (!finalDigits.startsWith("91")) {
          finalDigits = `91${finalDigits}`;
        }
      }
    } else {
      // OTHER COUNTRIES:
      // If the number doesn't already start with the country calling code, prepend it.
      if (!finalDigits.startsWith(ccDigits)) {
        finalDigits = `${ccDigits}${finalDigits}`;
      }
    }
  }

  // E.164 standard validation: length between 7 and 15 digits
  const isValid = finalDigits.length >= 7 && finalDigits.length <= 15;
  const normalized = isValid ? `+${finalDigits}` : "";

  // Formatting for clean UI presentation
  let displayFormatted = "";
  if (isValid) {
    if (finalDigits.startsWith("91") && finalDigits.length === 12) {
      // Format Indian numbers: +91 98765 43210
      displayFormatted = `+91 ${finalDigits.slice(2, 7)} ${finalDigits.slice(7)}`;
    } else if (finalDigits.startsWith("1") && finalDigits.length === 11) {
      // Format US/CA numbers: +1 (415) 555-2671
      displayFormatted = `+1 (${finalDigits.slice(1, 4)}) ${finalDigits.slice(4, 7)}-${finalDigits.slice(7)}`;
    } else {
      displayFormatted = `+${finalDigits}`;
    }
  }

  return {
    original,
    normalized,
    e164: normalized,
    digits: isValid ? finalDigits : "",
    waDigits: isValid ? finalDigits : "",
    telLink: isValid ? `tel:+${finalDigits}` : "",
    smsLink: isValid ? `sms:+${finalDigits}` : "",
    waLink: isValid ? `https://wa.me/${finalDigits}` : "",
    displayFormatted,
    isValid,
    error: isValid ? undefined : "Phone number is invalid or has incorrect length.",
  };
}
