export type FollowUpType = "CALL" | "MEETING" | "EMAIL" | "WHATSAPP" | "DEMO";

export const ALLOWED_FOLLOW_UP_TYPES: FollowUpType[] = ["CALL", "MEETING", "EMAIL", "WHATSAPP", "DEMO"];

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  CALL: "Call",
  MEETING: "Meeting",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  DEMO: "Demo",
};

export function normalizeFollowUpType(type?: string | null): FollowUpType {
  if (!type) return "CALL";
  const upper = String(type).trim().toUpperCase();
  if (upper === "MEETING" || upper === "VISIT") return "MEETING";
  if (upper === "EMAIL") return "EMAIL";
  if (upper === "WHATSAPP") return "WHATSAPP";
  if (upper === "DEMO") return "DEMO";
  if (upper === "CALL") return "CALL";
  return "CALL";
}

export function extractFollowUpTypeAndCleanNote(
  rawNote?: string | null,
  explicitType?: string | null
): { type: FollowUpType; cleanNote: string } {
  const hasExplicit = explicitType !== undefined && explicitType !== null && String(explicitType).trim() !== "";
  let type: FollowUpType = hasExplicit ? normalizeFollowUpType(explicitType) : "CALL";
  let cleanNote = (rawNote || "").trim();

  // Strip multiple nested legacy tags like "[Call] [Meeting] my note"
  const tagRegex = /^\[(CALL|MEETING|EMAIL|WHATSAPP|DEMO|VISIT)\]\s*/i;
  while (tagRegex.test(cleanNote)) {
    const match = cleanNote.match(tagRegex);
    if (match && !hasExplicit) {
      type = normalizeFollowUpType(match[1]);
    }
    cleanNote = cleanNote.replace(tagRegex, "").trim();
  }

  return { type, cleanNote };
}

