import { requireSuperAdminPage } from "@/lib/adminAuth";
import SuperAdminApp from "./SuperAdminApp";
import "@/app/admin/admin.css";

export const metadata = { title: "Super Admin Platform | 3G Zappit", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string; tab?: string; mode?: string; orderId?: string; shipOrderId?: string }>;
}) {
  const identity = await requireSuperAdminPage();
  const resolvedParams = searchParams ? await searchParams : {};
  const secParam = resolvedParams.section || resolvedParams.tab;
  let initialSection: any = "overview";
  let initialMode: any = "all";
  if (secParam === "fulfillment" || secParam === "shipping" || secParam === "courier_shipping" || resolvedParams.mode || resolvedParams.orderId || resolvedParams.shipOrderId) {
    initialSection = "fulfillment";
  } else if (secParam === "users" || secParam === "audit" || secParam === "settings") {
    initialSection = secParam;
  }
  if (resolvedParams.mode === "shipping" || secParam === "shipping" || secParam === "courier_shipping") {
    initialMode = "shipping";
  } else if (resolvedParams.mode === "packing") {
    initialMode = "packing";
  }
  const initialOrderId = resolvedParams.orderId || resolvedParams.shipOrderId;

  return (
    <SuperAdminApp
      identity={identity}
      initialSection={initialSection}
      initialMode={initialMode}
      initialOrderId={initialOrderId}
    />
  );
}
