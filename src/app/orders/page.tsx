import { redirect } from "next/navigation";
import { currentIdentity } from "@/lib/adminAuth";
import OrdersClient from "./OrdersClient";
import "./orders.css";

export default async function OrdersPage() {
  const identity = await currentIdentity();
  if (!identity) redirect("/?login=1&next=%2Forders");
  return <OrdersClient />;
}
