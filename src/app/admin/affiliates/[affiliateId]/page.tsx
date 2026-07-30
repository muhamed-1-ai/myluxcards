import { requireAdminPage } from "@/lib/adminAuth";import AdminAffiliates from "../AdminAffiliates";
export default async function Page({params}:{params:Promise<{affiliateId:string}>}){await requireAdminPage();const{affiliateId}=await params;return <AdminAffiliates view="detail" affiliateId={affiliateId}/>}
