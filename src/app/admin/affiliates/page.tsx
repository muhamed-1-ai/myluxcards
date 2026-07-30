import { requireAdminPage } from "@/lib/adminAuth";import AdminAffiliates from "./AdminAffiliates";
export const metadata={title:"Affiliates | MyLuxCards Admin",robots:{index:false,follow:false}};export const dynamic="force-dynamic";
export default async function Page(){await requireAdminPage();return <AdminAffiliates/>}
