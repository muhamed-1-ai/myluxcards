import type { AppRole } from "./database";
export interface PublicUserResponse { id:string; email:string; name:string; image:string|null; role:AppRole; disabled:boolean; mustChangePassword:boolean }
export interface PublicProductResponse { id:string; name:string; slug:string; description:string; productType:string; sku:string|null; priceMinor:number; salePriceMinor:number|null; currency:string; stock:number; images:unknown[]; variants:unknown[] }
// Password hashes, action-token hashes, card-token hashes, payout ciphertext and fraud details intentionally have no public API type.
