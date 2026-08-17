import { currentIdentity, safeError, validMutationOrigin } from "@/lib/adminAuth";
import { claimPhysicalCard } from "@/lib/physicalCards";

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return Response.json({ message:"Invalid request origin." },{ status:403 });
  const identity = await currentIdentity();
  if (!identity) return Response.json({ message:"Sign in to activate your MyLuxCard." },{ status:401 });
  try {
    const token = String((await request.json().catch(()=>({}))).token || "");
    const result = await claimPhysicalCard(token, identity.id);
    if (result.state === "NOT_FOUND") return Response.json({ message:"This MyLuxCard could not be found." },{ status:404 });
    if (result.state === "UNAVAILABLE") return Response.json({ message:"This MyLuxCard is currently unavailable." },{ status:409 });
    if (result.state === "ALREADY_CLAIMED") return Response.json({ message:"This MyLuxCard has already been activated." },{ status:409 });
    return Response.json({ ok:true, message:"Your MyLuxCard is live.", slug:result.slug });
  } catch (error) { return safeError(error); }
}
