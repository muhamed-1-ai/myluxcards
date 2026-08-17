import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";
import { resolvePhysicalCard, unavailableStatuses } from "@/lib/physicalCards";
import ClaimCard from "./ClaimCard";
import "./claim.css";

export const dynamic = "force-dynamic";

export default async function TokenPage({ params }:{ params:Promise<{token:string}> }) {
  const { token } = await params;
  const card = await resolvePhysicalCard(token);
  if (!card) return <ClaimCard state="not-found" token="" signedIn={false}/>;
  if (unavailableStatuses.has(card.status)) return <ClaimCard state="unavailable" token="" signedIn={false}/>;
  if (card.owner_id && card.slug && card.active && card.activated_at) redirect(`/card/${card.slug}`);
  if (card.owner_id) return <ClaimCard state="claimed" token="" signedIn={false}/>;
  const identity = await currentIdentity();
  return <ClaimCard state="ready" token={token} signedIn={Boolean(identity)}/>;
}
