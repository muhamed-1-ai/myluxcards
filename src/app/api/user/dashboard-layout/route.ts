import { currentIdentity, validMutationOrigin } from "@/lib/adminAuth";
import { findUserById, updateUserDashboardLayout } from "@/lib/repositories/users";

const ALLOWED_LAYOUTS = ["business", "sales", "digital_card", "compact"];

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await findUserById(identity.id);
    const layout = user?.dashboard_layout || "business";
    return Response.json({ layout });
  } catch (error) {
    console.error("[Dashboard Layout GET] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!validMutationOrigin(request)) {
    return Response.json({ message: "Invalid request origin." }, { status: 403 });
  }

  const identity = await currentIdentity();
  if (!identity) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const layout = String(body.layout || "").trim().toLowerCase();

    if (!ALLOWED_LAYOUTS.includes(layout)) {
      return Response.json(
        { message: `Invalid dashboard layout. Allowed values: ${ALLOWED_LAYOUTS.join(", ")}` },
        { status: 400 }
      );
    }

    const updatedUser = await updateUserDashboardLayout(identity.id, layout);
    return Response.json({
      ok: true,
      layout: updatedUser?.dashboard_layout || layout,
      message: "Dashboard layout updated.",
    });
  } catch (error) {
    console.error("[Dashboard Layout PUT] Error:", error);
    return Response.json({ message: "Internal server error" }, { status: 500 });
  }
}
