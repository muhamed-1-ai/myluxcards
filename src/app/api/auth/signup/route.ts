import { createCredentialUser, checkRateLimit, validEmail, validPassword } from "@/lib/authService";
import { authenticatedResponse } from "@/lib/authSession";
import { validMutationOrigin } from "@/lib/adminAuth";
import { normalizePhoneNumber } from "@/lib/phone";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "");
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!await checkRateLimit("SIGNUP", request.headers.get("x-forwarded-for") || "unknown", 5, 3600)) {
    return Response.json({ message: "Too many attempts. Please try again later." }, { status: 429 });
  }

  if (name.length < 2 || name.length > 100 || !validEmail(email)) {
    return Response.json({ message: "Enter a valid name and email address." }, { status: 400 });
  }

  let phone: string | null = null;
  if (rawPhone.length > 0) {
    const phoneRes = normalizePhoneNumber(rawPhone);
    if (!phoneRes.isValid) {
      return Response.json({ message: phoneRes.error || "Please enter a valid phone number or leave it blank." }, { status: 400 });
    }
    phone = phoneRes.normalized;
  }

  if (typeof body.password !== "string" || !validPassword(body.password)) {
    return Response.json({ message: "Use 12–128 characters with uppercase, lowercase, number, and symbol." }, { status: 400 });
  }

  try {
    const user = await createCredentialUser({ name, email, password: body.password, phone });
    return await authenticatedResponse({ ...user, sessionVersion: user.session_version }, request);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return Response.json({ message: "An account with that email already exists. Please log in." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "INVALID_PHONE") {
      return Response.json({ message: "Please enter a valid phone number or leave it blank." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "INVALID_SIGNUP") {
      return Response.json({ message: "Please check your name, email, and password." }, { status: 400 });
    }
    console.error("[Signup API Error]:", error);
    return Response.json({ message: "Registration could not be completed. Please try again." }, { status: 500 });
  }
}
