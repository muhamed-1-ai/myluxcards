import "server-only";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("[Security FATAL] Missing AUTH_SECRET / NEXTAUTH_SECRET environment variable in production deployment!");
  }
  return "myluxcards-dev-only-session-secret-key-do-not-use-in-prod";
}
