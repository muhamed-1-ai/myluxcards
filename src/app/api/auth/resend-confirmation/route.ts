import { getSupabaseConfig } from "@/lib/supabaseAuth";
import { validMutationOrigin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { email } = await request.json().catch(() => ({}));
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return Response.json({ message: "Enter your email address first." }, { status: 400 });
  const config = getSupabaseConfig();
  if (!config) return Response.json({ message: "Authentication is not configured." }, { status: 503 });
  const upstream = await fetch(`${config.url}/auth/v1/resend`, { method: "POST", headers: { apikey: config.anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ type: "signup", email: cleanEmail }), cache: "no-store" });
  if (!upstream.ok) return Response.json({ message: "Confirmation email could not be sent right now." }, { status: upstream.status === 429 ? 429 : 502 });
  return Response.json({ message: "If that account needs confirmation, a new email has been sent." });
}
