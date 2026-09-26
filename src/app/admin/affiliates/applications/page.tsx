import { requireAdminPage } from "@/lib/adminAuth";
import AdminAffiliates from "../AdminAffiliates";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdminPage();
  return <AdminAffiliates view="list" />;
}
