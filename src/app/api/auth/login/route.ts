import { authenticateCredentials, enforceLoginRateLimit, validEmail } from "@/lib/authService";
import { authenticatedResponse } from "@/lib/authSession";
import { validMutationOrigin } from "@/lib/adminAuth";
import { normalizeEmail } from "@/lib/repositories/users";
import { getTrustedClientIp } from "@/lib/rateLimit";

  export async function POST(request: Request) {
    if (!validMutationOrigin(request)) {
      return Response.json({ message: "Invalid request origin." }, { status: 403 });
    }

    try {
      const body = await request.json().catch(() => ({}));
      const email = normalizeEmail(String(body.email || ""));
      const password = typeof body.password === "string" ? body.password : "";
      const clientIp = getTrustedClientIp(request);

      // 1. Enforce independent account and IP rate limits
      const rateCheck = await enforceLoginRateLimit({ email, clientIp });
      if (!rateCheck.allowed) {
        return Response.json(
          { message: "Too many login attempts. Please try again later." },
          { status: 429 }
        );
      }

      // 2. Validate input format
      if (!validEmail(email) || !password) {
        return Response.json({ message: "Email or password is incorrect." }, { status: 401 });
      }

      // 3. Verify credentials
      const user = await authenticateCredentials(email, password);
      if (!user) {
        return Response.json({ message: "Email or password is incorrect." }, { status: 401 });
      }

      return await authenticatedResponse(user, request);
    } catch (error) {
      console.error("[Login API Error]:", error);
      return Response.json(
        { message: "Login request could not be completed. Please try again." },
        { status: 500 }
      );
    }
  }
