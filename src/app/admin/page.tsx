import { requireAdminPage } from "@/lib/adminAuth";
import AdminApp from "./AdminApp";
import "./admin.css";

export const metadata = { title: "Administration | MyLuxCards", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ section?: string; shipOrderId?: string; orderId?: string }>;
}) {
  const identity = await requireAdminPage();
  const resolvedParams = searchParams ? await searchParams : {};
  const sec = resolvedParams.section;
  const initialSection = (sec === "courier_shipping" && identity.role !== "SUPER_ADMIN") ? "overview" : (sec as any);
  const initialShipOrderId = (identity.role === "SUPER_ADMIN") ? (resolvedParams.shipOrderId || resolvedParams.orderId) : undefined;

  return (
    <AdminApp
      identity={identity}
      initialSection={initialSection}
      initialShipOrderId={initialShipOrderId}
    />
  );
}
