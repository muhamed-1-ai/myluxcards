import { requireAdminPage } from "@/lib/adminAuth";import AdminAffiliates from "../AdminAffiliates";
export default async function Page(){await requireAdminPage();return <AdminAffiliates view="settings"/>}
