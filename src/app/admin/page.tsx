import { requireAdminPage } from "@/lib/adminAuth";
import AdminApp from "./AdminApp";
import "./admin.css";

export const metadata = { title: "Administration | MyLuxCards", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const identity = await requireAdminPage();
  return <AdminApp identity={identity} />;
}
