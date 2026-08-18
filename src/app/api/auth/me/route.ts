import { currentIdentity } from "@/lib/adminAuth";

export async function GET() {
  const identity = await currentIdentity();
  if (!identity) return Response.json({ user: null }, { status: 200 });
  return Response.json({ user: identity });
}
