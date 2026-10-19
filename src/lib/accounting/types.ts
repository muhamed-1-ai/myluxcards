export type WorkspaceType = "PERSONAL" | "BUSINESS";
export type WorkspaceRole = "OWNER" | "MANAGER" | "STAFF" | "VIEWER";
export type ProfileTemplate = "BUSINESS_OWNER" | "SOLOPRENEUR" | "FREELANCER" | "EMPLOYEE" | "INDIVIDUAL" | "BOTH";

export type FinancialAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type FinancialAccountSubtype = "CASH" | "BANK" | "UPI" | "RECEIVABLE" | "PAYABLE" | "REVENUE" | "EXPENSE" | "LOAN" | "EQUITY";

export type CategoryType = "INCOME" | "EXPENSE";
export type ContactType = "CUSTOMER" | "VENDOR" | "PERSONAL";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID" | "OVERDUE";
export type SaleStatus = "COMPLETED" | "PARTIAL" | "REFUNDED" | "VOID";
export type PaymentType = "IN" | "OUT";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "UPI" | "CARD" | "CHEQUE" | "OTHER";
export type JournalEntryType = "SALE" | "EXPENSE" | "PAYMENT_COLLECTION" | "PAYMENT_DISBURSEMENT" | "TRANSFER" | "LOAN_RECEIPT" | "LOAN_REPAYMENT" | "OPENING_BALANCE" | "CORRECTION" | "REVERSAL" | "MANUAL";
export type JournalStatus = "DRAFT" | "POSTED" | "VOIDED";

export interface WorkspaceRow {
  id: string;
  owner_user_id: string;
  name: string;
  type: WorkspaceType;
  currency: string;
  timezone: string;
  profile_template: ProfileTemplate;
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  permissions: Record<string, boolean>;
  invited_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface FinancialAccountRow {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  type: FinancialAccountType;
  subtype: FinancialAccountSubtype;
  currency: string;
  account_number_mask: string | null;
  is_system: boolean;
  is_active: boolean;
  opening_balance_minor: string | number;
  current_balance_minor: string | number;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CategoryRow {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  is_archived: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface ContactRow {
  id: string;
  workspace_id: string;
  name: string;
  type: ContactType;
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  total_receivable_minor: string | number;
  total_payable_minor: string | number;
  lead_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProductServiceRow {
  id: string;
  workspace_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string;
  default_price_minor: string | number;
  currency: string;
  is_active: boolean;
  catalog_product_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface JournalEntryRow {
  id: string;
  workspace_id: string;
  entry_number: string;
  entry_date: string;
  entry_type: string;
  description: string;
  reference: string | null;
  source_type: string;
  source_id: string | null;
  idempotency_key: string | null;
  status: JournalStatus;
  posted_at: Date | null;
  reversal_of_entry_id: string | null;
  reversed_by_entry_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface JournalLineRow {
  id: string;
  journal_entry_id: string;
  financial_account_id: string;
  debit_minor: string | number;
  credit_minor: string | number;
  description: string | null;
  account_name?: string;
  account_code?: string;
  account_type?: FinancialAccountType;
}

export interface InvoiceRow {
  id: string;
  workspace_id: string;
  invoice_number: string;
  contact_id: string | null;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  currency: string;
  subtotal_minor: string | number;
  discount_minor: string | number;
  tax_minor: string | number;
  total_minor: string | number;
  amount_paid_minor: string | number;
  amount_due_minor: string | number;
  notes: string | null;
  terms: string | null;
  share_token: string | null;
  lead_id: string | null;
  posted_journal_entry_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
}

export interface InvoiceLineRow {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: string | number;
  unit_price_minor: string | number;
  discount_minor: string | number;
  tax_minor: string | number;
  total_minor: string | number;
  sort_order: number;
}

export interface DirectSaleRow {
  id: string;
  workspace_id: string;
  sale_number: string;
  contact_id: string | null;
  date: string;
  total_minor: string | number;
  paid_minor: string | number;
  payment_method: string;
  financial_account_id: string | null;
  invoice_id: string | null;
  lead_id: string | null;
  notes: string | null;
  status: SaleStatus;
  posted_journal_entry_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentRow {
  id: string;
  workspace_id: string;
  payment_number: string;
  type: PaymentType;
  contact_id: string | null;
  financial_account_id: string;
  amount_minor: string | number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  journal_entry_id: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentAllocationRow {
  id: string;
  payment_id: string;
  invoice_id: string;
  allocated_minor: string | number;
  created_at: Date;
}

export interface UserTransactionRow {
  id: string;
  workspace_id: string;
  journal_entry_id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | "COLLECTION" | "PAYMENT" | "LOAN";
  category_id: string | null;
  financial_account_id: string;
  destination_account_id: string | null;
  contact_id: string | null;
  amount_minor: string | number;
  date: string;
  notes: string | null;
  status: "POSTED" | "VOIDED";
  attachment_url: string | null;
  tags: string[];
  is_recurring: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  category_name?: string | null;
  account_name?: string | null;
  contact_name?: string | null;
}

export interface LoanRow {
  id: string;
  workspace_id: string;
  loan_name: string;
  lender_contact_id: string | null;
  liability_account_id: string;
  disbursement_account_id: string;
  principal_minor: string | number;
  interest_rate_percent: string | number;
  tenure_months: number;
  start_date: string;
  monthly_installment_minor: string | number;
  remaining_principal_minor: string | number;
  status: "ACTIVE" | "PAID_OFF" | "DEFAULTED";
  created_at: Date;
  updated_at: Date;
}

export interface LoanInstallmentRow {
  id: string;
  loan_id: string;
  installment_number: number;
  due_date: string;
  principal_minor: string | number;
  interest_minor: string | number;
  total_minor: string | number;
  status: "PENDING" | "PAID" | "OVERDUE";
  paid_date: string | null;
  payment_id: string | null;
  journal_entry_id: string | null;
}

export interface BudgetRow {
  id: string;
  workspace_id: string;
  category_id: string | null;
  period_type: "MONTHLY" | "QUARTERLY" | "YEARLY";
  period_start: string;
  period_end: string;
  amount_minor: string | number;
  spent_minor: string | number;
  alert_threshold_percent: number;
  created_at: Date;
  updated_at: Date;
  category_name?: string | null;
}

export interface RecurringRuleRow {
  id: string;
  workspace_id: string;
  title: string;
  type: "INCOME" | "EXPENSE" | "BILL" | "SALARY" | "SUBSCRIPTION";
  category_id: string | null;
  amount_minor: string | number;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  next_due_date: string;
  financial_account_id: string | null;
  auto_post: boolean;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  created_at: Date;
  updated_at: Date;
  category_name?: string | null;
}

export interface ReminderRow {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  description: string | null;
  type: "INVOICE_DUE" | "BILL_DUE" | "LOAN_EMI" | "BUDGET_EXCEEDED" | "CUSTOM";
  due_date: string;
  entity_type: string | null;
  entity_id: string | null;
  status: "PENDING" | "TRIGGERED" | "DISMISSED" | "CANCELLED";
  dismissed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
