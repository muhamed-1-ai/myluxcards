import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.WHATSAPP_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "myluxcards_default_whatsapp_secret_32_bytes_len";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts sensitive API tokens at rest before storing in database.
 */
export function encryptToken(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts access token from database for server-side Meta API calls.
 */
export function decryptToken(encryptedData: string): string {
  if (!encryptedData.includes(":")) return encryptedData;
  
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");
  if (parts.length !== 3) return encryptedData;
  
  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Validates Meta Webhook X-Hub-Signature-256 header.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expectedHash = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const actualHash = signatureHeader.replace("sha256=", "");
  return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(actualHash));
}

export type MetaTemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  parameters?: any[];
};

export type MetaTemplate = {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: MetaTemplateComponent[];
};

/**
 * Fetches approved message templates directly from Meta Graph API for WABA ID.
 */
export async function fetchMetaTemplates(wabaId: string, accessToken: string): Promise<MetaTemplate[]> {
  const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Meta API template error (${res.status})`);
  }
  
  const data = await res.json();
  return (data.data || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    language: t.language,
    status: t.status,
    components: t.components || [],
  }));
}

/**
 * Sends a Template message to a recipient phone number via Meta Cloud API.
 */
export async function sendMetaTemplateMessage(options: {
  phoneNumberId: string;
  accessToken: string;
  recipientPhone: string;
  templateName: string;
  languageCode?: string;
  bodyParameters?: string[];
}): Promise<{ wamid: string }> {
  const { phoneNumberId, accessToken, recipientPhone, templateName, languageCode = "en_US", bodyParameters = [] } = options;
  const cleanPhone = recipientPhone.replace(/\D/g, "");
  
  const components: any[] = [];
  if (bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: bodyParameters.map((param) => ({
        type: "text",
        text: param,
      })),
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components.length > 0 ? components : undefined,
    },
  };

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = responseData?.error?.message || `Meta API send error (${res.status})`;
    const errCode = responseData?.error?.code ? String(responseData.error.code) : "META_ERROR";
    const err = new Error(errMsg);
    (err as any).code = errCode;
    throw err;
  }

  const wamid = responseData?.messages?.[0]?.id || `wamid_sim_${Date.now()}`;
  return { wamid };
}

/**
 * Sends a 1-on-1 text message via Meta Cloud API (active 24h customer window).
 */
export async function sendMetaTextMessage(options: {
  phoneNumberId: string;
  accessToken: string;
  recipientPhone: string;
  messageText: string;
}): Promise<{ wamid: string }> {
  const { phoneNumberId, accessToken, recipientPhone, messageText } = options;
  const cleanPhone = recipientPhone.replace(/\D/g, "");
  
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "text",
    text: { preview_url: false, body: messageText },
  };

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseData = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = responseData?.error?.message || `Meta API send text error (${res.status})`;
    throw new Error(errMsg);
  }

  const wamid = responseData?.messages?.[0]?.id || `wamid_sim_${Date.now()}`;
  return { wamid };
}
