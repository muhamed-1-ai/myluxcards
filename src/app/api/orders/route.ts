import { currentIdentity, safeError } from "@/lib/adminAuth";
import { listUserOrders } from "@/lib/repositories/orders";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message: "Please sign in." }, { status: 401 });
  try {
    // Scoped query: customer_id=eq.${identity.id}
    const data = await listUserOrders(identity.id);
    return Response.json({ data: data || [] });
  } catch (error) { return safeError(error); }
}
