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
  is_payment_account: boolean;
  account_role?: "CASH" | "BANK" | "INTERNAL_LEDGER" | "LEGACY_PAYMENT" | "RETIRED_SYSTEM" | string;
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
  parent_name?: string | null;
  parent_is_archived?: boolean | null;
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

export type WarrantyType = "NONE" | "MANUFACTURER" | "SELLER" | "CUSTOM";

export interface SellerSnapshot {
  business_name: string;
  logo_url?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  tax_id?: string | null;
  tax_label?: string | null;
}

export interface CustomerSnapshot {
  id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface InvoiceSettingsRow {
  workspace_id: string;
  business_name: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  tax_label: string;
  default_notes: string | null;
  default_terms: string;
  default_warranty_terms: string | null;
  invoice_prefix: string;
  next_sequence: number;
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
  default_warranty_type?: WarrantyType;
  default_warranty_duration_months?: number | null;
  default_warranty_coverage?: string | null;
  default_warranty_exclusions?: string | null;
  default_warranty_contact?: string | null;
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

export interface AccountHistoryItem {
  id: string;
  lineId: string;
  entryNumber: string;
  entryDate: string;
  entryType: string;
  displayType: string;
  description: string;
  debitMinor: number;
  creditMinor: number;
  direction: "INFLOW" | "OUTFLOW";
  amountMinor: number;
  counterpartAccount: string;
  status: "ACTIVE" | "REVERSED" | "REVERSAL";
  isEligibleForCorrection: boolean;
  isEligibleForReversal: boolean;
  createdBy: string;
  createdAt: string;
  reversedByEntryId: string | null;
  reversedByEntryNumber: string | null;
  reversalOfEntryId: string | null;
  reversalOfEntryNumber: string | null;
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
  internal_notes?: string | null;
  share_token: string | null;
  lead_id: string | null;
  posted_journal_entry_id: string | null;
  seller_snapshot?: SellerSnapshot | null;
  customer_snapshot?: CustomerSnapshot | null;
  direct_sale_id?: string | null;
  warranty_terms?: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
}

export interface InvoicePaymentDetail {
  id: string;
  payment_number: string;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  amount_minor: number;
  allocated_minor: number;
  account_name: string | null;
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
  model?: string | null;
  sku?: string | null;
  serial_number?: string | null;
  warranty_type?: WarrantyType;
  warranty_duration_months?: number | null;
  warranty_start_date?: string | null;
  warranty_end_date?: string | null;
  warranty_coverage?: string | null;
  warranty_exclusions?: string | null;
  warranty_contact?: string | null;
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
  parent_category_name?: string | null;
  main_category_name?: string | null;
  subcategory_name?: string | null;
  account_name?: string | null;
  contact_name?: string | null;
  voided_at?: Date | string | null;
  voided_by?: string | null;
  voided_by_name?: string | null;
  restored_at?: Date | string | null;
  restored_by?: string | null;
  restored_by_name?: string | null;
  attachment_count?: number;
  attachments?: TransactionAttachmentRow[];
  purchase_id?: string | null;
  purchase_number?: string | null;
}

export interface TransactionAttachmentRow {
  id: string;
  workspace_id: string;
  transaction_id: string | null;
  purchase_id?: string | null;
  storage_key: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_by?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  url?: string;
  download_url?: string;
}

export type PurchaseStatus = "DRAFT" | "UNPAID" | "PARTIALLY_PAID" | "PAID" | "VOIDED";
export type PurchaseType = "EXPENSE" | "INVENTORY" | "ASSET";

export interface PurchaseRow {
  id: string;
  workspace_id: string;
  purchase_number: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_bill_number: string | null;
  purchase_date: string;
  due_date: string | null;
  category_id: string | null;
  status: PurchaseStatus;
  purchase_type: PurchaseType;
  currency: string;
  subtotal_minor: string | number;
  discount_minor: string | number;
  tax_minor: string | number;
  total_minor: string | number;
  amount_paid_minor: string | number;
  amount_due_minor: string | number;
  total_amount_minor?: string | number;
  paid_amount_minor?: string | number;
  balance_due_minor?: string | number;
  notes: string | null;
  posted_journal_entry_id: string | null;
  transaction_id: string | null;
  created_by: string | null;
  voided_at?: Date | string | null;
  voided_by?: string | null;
  void_reason?: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined / computed fields
  supplier_email?: string | null;
  supplier_phone?: string | null;
  supplier_address?: string | null;
  category_name?: string | null;
  parent_category_name?: string | null;
  main_category_name?: string | null;
  subcategory_name?: string | null;
  attachment_count?: number;
  attachments?: TransactionAttachmentRow[];
  lines?: PurchaseLineRow[];
  payments?: PurchasePaymentRow[];
}

export interface PurchaseLineRow {
  id: string;
  purchase_id: string;
  product_id: string | null;
  description: string;
  quantity: string | number;
  unit_price_minor: string | number;
  discount_minor: string | number;
  tax_minor: string | number;
  total_minor: string | number;
  sort_order: number;
  product_name?: string | null;
  sku?: string | null;
}

export interface PurchasePaymentRow {
  id: string;
  workspace_id: string;
  purchase_id: string;
  payment_id: string | null;
  financial_account_id: string;
  amount_minor: string | number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  journal_entry_id: string | null;
  status: "POSTED" | "VOIDED";
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  account_name?: string;
  account_code?: string;
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
  name?: string | null;
  icon?: string | null;
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
  transaction_count?: number;
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

export type RecoveryReason = "PRE_RESET" | "PRE_RESTORE" | "MANUAL";
export type RecoveryStatus = "AVAILABLE" | "RESTORED" | "EXPIRED" | "CORRUPTED";

export interface RecoveryRecordCounts {
  financialAccounts: number;
  categories: number;
  contacts: number;
  products: number;
  journalEntries: number;
  journalLines: number;
  invoices: number;
  invoiceLines: number;
  invoiceSequences: number;
  sales: number;
  payments: number;
  paymentAllocations: number;
  transactions: number;
  transactionAttachments: number;
  loans: number;
  loanInstallments: number;
  budgets: number;
  recurringRules: number;
  reminders: number;
  purchases?: number;
  purchaseLines?: number;
  purchasePayments?: number;
}

export interface FinancialSummary {
  accountsCount: number;
  netBalanceMinor: number;
  totalInflowMinor: number;
  totalOutflowMinor: number;
  receivableMinor: number;
  payableMinor: number;
  unpaidInvoicesCount: number;
  currency: string;
}

export interface RecoveryVersionRow {
  id: string;
  workspace_id: string;
  version_number: number;
  name: string;
  reason: RecoveryReason;
  status: RecoveryStatus;
  checksum: string;
  data_payload: Record<string, unknown>;
  record_counts: RecoveryRecordCounts;
  financial_summary: FinancialSummary;
  created_by: string | null;
  created_at: Date;
  expires_at: Date;
  restored_at: Date | null;
  restored_by: string | null;
}
