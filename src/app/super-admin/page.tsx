import { requireSuperAdminPage } from "@/lib/adminAuth";
import SuperAdminApp from "./SuperAdminApp";
import "@/app/admin/admin.css";

export const metadata = { title: "Super Admin Platform | 3G Zappit", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const identity = await requireSuperAdminPage();
  return <SuperAdminApp identity={identity} />;
}
