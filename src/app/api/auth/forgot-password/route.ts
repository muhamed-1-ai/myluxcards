import { getSupabaseConfig, supabaseAuthRequest } from "@/lib/supabaseAuth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!getSupabaseConfig()) {
    return NextResponse.json(
      { message: "Authentication is not configured yet." },
      { status: 503 },
    );
  }

  const { email } = await request.json();
  const origin = new URL(request.url).origin;
  const result = await supabaseAuthRequest("/recover", {
    method: "POST",
    body: JSON.stringify({
      email: String(email || "").trim().toLowerCase(),
      redirect_to: `${origin}/reset-password`,
    }),
  });

  if (result.status === 429) {
    return NextResponse.json(
      { message: "Too many emails were requested. Please wait about one hour and try again." },
      { status: 429 },
    );
  }

  if (!result.ok) {
    const details = await result.clone().json().catch(() => ({}));
    console.error("Supabase recovery email failed:", details);
    return NextResponse.json(
      { message: "The email provider could not send this message. Check the Supabase Auth logs and SMTP settings." },
      { status: 502 },
    );
  }

  // Never reveal whether an account exists.
  return NextResponse.json({
    message: "If an account exists for that email, a reset link has been sent.",
  });
}
