/**
 * RFC 6350 / vCard 3.0 Generation Helper
 * Handles name mapping priority, special character escaping, UTF-8 encoding,
 * line endings, and structured N / FN formatting for mobile contact app compatibility.
 */

export interface VCardInput {
  profileName?: string | null;
  cardName?: string | null;
  userName?: string | null;
  companyName?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface ResolvedName {
  fullName: string;
  firstName: string;
  lastName: string;
}

function cleanText(val?: string | null): string {
  if (!val) return "";
  return String(val).trim();
}

/**
 * Escapes special characters per RFC 6350 / vCard 3.0 specification:
 * '\' -> '\\', ',' -> '\,', ';' -> '\;'
 * Newlines (\r\n or \n) -> ' '
 */
export function escapeVCardValue(str: string): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r?\n/g, " ");
}

/**
 * Priority Order for Contact Name Resolution:
 * 1. Full profile name
 * 2. Card name
 * 3. User name
 * 4. Company name
 * Fallback: "Contact"
 *
 * Never returns an empty name.
 */
export function resolveContactName(input: VCardInput): ResolvedName {
  const profileName = cleanText(input.profileName);
  const cardName = cleanText(input.cardName);
  const userName = cleanText(input.userName);
  const companyName = cleanText(input.companyName);

  let fullName = profileName || cardName || userName || companyName || "Contact";
  fullName = cleanText(fullName) || "Contact";

  let firstName = "";
  let lastName = "";

  const nameParts = fullName.split(/\s+/).filter(Boolean);
  if (nameParts.length === 1) {
    firstName = nameParts[0];
    lastName = "";
  } else if (nameParts.length >= 2) {
    firstName = nameParts[0];
    lastName = nameParts.slice(1).join(" ");
  }

  return { fullName, firstName, lastName };
}

export interface VCardBuildResult {
  vcard: string;
  fn: string;
  n: string;
  fullName: string;
}

/**
 * Builds RFC 6350 / vCard 3.0 compliant string with \r\n line endings.
 */
export function buildVCardString(input: VCardInput): VCardBuildResult {
  const { fullName, firstName, lastName } = resolveContactName(input);

  const escapedFN = escapeVCardValue(fullName);
  const escapedLastName = escapeVCardValue(lastName);
  const escapedFirstName = escapeVCardValue(firstName);

  const fn = `FN:${escapedFN}`;
  const n = `N:${escapedLastName};${escapedFirstName};;;`;

  const lines: string[] = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    fn,
    n,
  ];

  const title = cleanText(input.title);
  if (title) {
    lines.push(`TITLE:${escapeVCardValue(title)}`);
  }

  const company = cleanText(input.companyName);
  if (company) {
    lines.push(`ORG:${escapeVCardValue(company)}`);
  }

  const phone = cleanText(input.phone);
  if (phone) {
    // Standardize phone number format for TEL tag
    lines.push(`TEL;TYPE=CELL:${escapeVCardValue(phone)}`);
  }

  const email = cleanText(input.email);
  if (email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(email)}`);
  }

  const website = cleanText(input.website);
  if (website) {
    lines.push(`URL:${escapeVCardValue(website)}`);
  }

  const addressParts = [
    cleanText(input.address),
    cleanText(input.city),
    cleanText(input.state),
    cleanText(input.country),
  ].filter(Boolean);

  if (addressParts.length > 0) {
    const formattedAdr = escapeVCardValue(addressParts.join(", "));
    lines.push(`ADR;TYPE=WORK:;;${formattedAdr};;;;`);
  }

  lines.push("END:VCARD");

  // Join lines with standard vCard CRLF (\r\n) line endings
  const vcard = lines.join("\r\n");

  return {
    vcard,
    fn,
    n,
    fullName,
  };
}
