import { supabaseAuthRequest } from "@/lib/supabaseAuth";
import { validMutationOrigin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message: "Invalid request origin." }, { status: 403 });
  const { name, email, password } = await request.json().catch(() => ({}));
  const cleanName = String(name || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (cleanName.length < 2 || cleanName.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return Response.json({ message: "Enter a valid name and email address." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return Response.json({ message: "Password must contain 8 to 128 characters." }, { status: 400 });
  }
  return supabaseAuthRequest("/signup", {
    method: "POST",
    body: JSON.stringify({
      email: cleanEmail,
      password,
      // Role is deliberately fixed server-side. Browser-supplied metadata is ignored.
      data: { name: cleanName, role: "CUSTOMER" },
    }),
  });
}
