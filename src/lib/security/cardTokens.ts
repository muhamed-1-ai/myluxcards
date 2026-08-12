import { createHash, randomBytes } from "node:crypto";

const CARD_TOKEN_BYTES = 32;

export function newPublicCardToken() {
  return randomBytes(CARD_TOKEN_BYTES).toString("base64url");
}

export function hashCardToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
