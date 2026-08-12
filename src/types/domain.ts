import type { AppRole } from "./database";
export interface UserIdentity { id:string; email:string; name:string; image:string|null; role:AppRole; disabled:boolean; mustChangePassword:boolean; sessionVersion:number }
export interface Money { amountMinor:number; currency:string }
export interface OrderSummary { id:string; orderNumber:string; status:string; paymentStatus:string; total:Money; createdAt:string }
export function commissionMinor(basisMinor: number, basisPoints: number) {
  if (!Number.isSafeInteger(basisMinor)||basisMinor<0||!Number.isSafeInteger(basisPoints)||basisPoints<0) throw new RangeError("Commission inputs must be non-negative safe integers.");
  return Math.floor((basisMinor * basisPoints) / 10_000);
}
