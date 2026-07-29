import { supabaseAuthRequest } from "@/lib/supabaseAuth";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  const { password } = await request.json();

  if (!token || typeof password !== "string" || password.length < 12 ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
      !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return Response.json(
      { message: "The reset link or password is invalid." },
      { status: 400 },
    );
  }

  return supabaseAuthRequest(
    "/user",
    { method: "PUT", body: JSON.stringify({ password }) },
    token,
  );
}
