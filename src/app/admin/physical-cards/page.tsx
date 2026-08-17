import { requireAdminPage } from "@/lib/adminAuth";
import PhysicalCards from "./PhysicalCards";
import "./physical-cards.css";
export const dynamic="force-dynamic";
export default async function Page(){await requireAdminPage();return <PhysicalCards/>}
