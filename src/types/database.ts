export type AppRole = "CUSTOMER" | "USER" | "ADMIN" | "SUPER_ADMIN";
export type AccountStatus = "ACTIVE" | "PENDING_PAYMENT" | "SUSPENDED" | "DISABLED";

export interface FeaturePermissions {
  [key: string]: boolean;
  dashboard: boolean;
  profile: boolean;
  nfc_card: boolean;
  qr_profile: boolean;
  crm: boolean;
  leads: boolean;
  lost_found: boolean;
  vehicle: boolean;
  orders: boolean;
  analytics: boolean;
  products: boolean;
  notifications: boolean;
}

export const DEFAULT_FEATURE_PERMISSIONS: FeaturePermissions = {
  dashboard: true,
  profile: true,
  nfc_card: true,
  qr_profile: true,
  crm: true,
  leads: true,
  lost_found: true,
  vehicle: true,
  orders: true,
  analytics: true,
  products: true,
  notifications: true,
};

export interface UserRow {
  id: string;
  email: string;
  normalized_email: string;
  name: string;
  password_hash: string | null;
  email_verified_at: Date | null;
  image: string | null;
  role: AppRole;
  status: AccountStatus;
  disabled: boolean;
  must_change_password: boolean;
  session_version: number;
  created_by_admin_id?: string | null;
  feature_permissions?: FeaturePermissions | Record<string, boolean>;
  dashboard_layout?: string;
  terms_accepted?: boolean;
  privacy_accepted?: boolean;
  cookie_consent?: boolean;
  terms_version?: string | null;
  privacy_version?: string | null;
  cookie_version?: string | null;
  legal_accepted_at?: Date | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProfileRow { id:string; phone:string|null; internal_notes:string|null; created_at:Date; updated_at:Date }
export interface ProductRow { id:string; name:string; slug:string; description:string; product_type:string; sku:string|null; price_minor:number; sale_price_minor:number|null; currency:string; stock:number; low_stock_threshold:number; images:unknown[]; variants:unknown[]; active:boolean; featured:boolean; archived_at:Date|null; created_at:Date; updated_at:Date }
export interface OrderRow { id:string; order_number:string; customer_id:string|null; customer_name:string; customer_email:string; customer_phone:string|null; status:string; payment_status:string; currency:string; subtotal_minor:number; discount_minor:number; tax_minor:number; shipping_minor:number; total_minor:number; shipping_address:Record<string,unknown>; billing_address:Record<string,unknown>; created_at:Date; updated_at:Date }
export interface PaymentRow { id:string; order_id:string; provider:string; provider_order_id:string|null; provider_payment_id:string|null; provider_refund_id:string|null; idempotency_key:string; amount_minor:number; currency:string; status:string; refunded_minor:number; created_at:Date; updated_at:Date }
export interface DigitalCardRow { id:string; owner_id:string; slug:string; profile:Record<string,unknown>; design:Record<string,unknown>; active:boolean; activated_at:Date|null; expires_at:Date|null; created_at:Date; updated_at:Date }
