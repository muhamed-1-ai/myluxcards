# Zappit Accounts: Integration Contracts

## 1. Zappit Leads Integration Contract

### 1.1 Architectural Principle
Zappit Accounts is the **authoritative financial ledger** and payment settlement system. Zappit Leads is the customer relationship and sales pipeline system.
- **Deal Won != Payment Received**: Marking a lead or deal as "WON" does not mean cash was received. It triggers a draft or issued sale/invoice in Accounts. Cash is recorded only upon actual payment receipt.
- **Idempotency & Retries**: All sync requests from Leads must supply an `idempotency_key` (e.g. `lead-sale-{lead_id}-{timestamp_or_version}`). Retried requests return the original record without duplicate ledger entries.
- **Non-Destructive & Isolated**: Leads operations can function without Accounts, and Accounts operations function completely independently without Leads.

### 1.2 Data Contract: Lead to Account Sync Payload
```typescript
export interface LeadToAccountingSyncEvent {
  eventId: string;             // Unique event ID
  idempotencyKey: string;      // Canonical idempotency key
  timestamp: string;           // ISO 8601 UTC
  eventType: "LEAD_WON" | "LEAD_ADVANCE_PAID" | "LEAD_SETTLEMENT_RECORDED";
  workspaceId: string;         // Target accounting workspace
  lead: {
    id: string;                // Canonical UUID from leads table
    name: string;              // Contact/Customer name
    companyName?: string | null;
    email?: string | null;
    contactNumber: string;
    totalAmountMinor: number;  // Billed / deal amount in minor units (paise)
    advanceAmountMinor?: number; // Advance paid if any
    products?: Array<{
      name: string;
      priceMinor: number;
      quantity: number;
    }>;
  };
  settlementAccountCode?: string; // e.g. "1020" for Main Bank Account
}
```

### 1.3 Outbox & Event Processing
- Stored in `accounting_outbox_events` with unique `idempotency_key`.
- Transactional: writing the event and posting the corresponding journal entry occurs in a single database transaction.

## 2. Platform Admin Entitlement Contract (`accounting_access`)

### 2.1 Storage
Stored directly within `users.feature_permissions`:
```json
{
  "accounting_access": true
}
```
Normalized and accessed via `src/lib/permissionsRegistry.ts`:
- Identifier: `accounting_access` (with legacy fallback aliases `accounting.access` and `accounting`).
- Default: `false` for all newly registered, Google-authenticated, or admin-created users.
- Universal grant: `SUPER_ADMIN` and `ADMIN` roles evaluate to `true` by default.

### 2.2 Server Authorization Middleware Contract
```typescript
export async function requireAccountingAccess(req?: Request): Promise<{ identity: AuthIdentity; isEntitled: boolean }>
```
- Returns 403 Forbidden with `{ error: "ACCOUNTING_ACCESS_DENIED", message: "Zappit Accounts module is not enabled for your account." }` on protected endpoints if unauthorized.
- Direct route visits show the styled `AccessDenied` state without leaking any financial numbers.

## 3. Public Invoice Share Link Contract

- Token: Cryptographically secure 32-character hexadecimal token stored in `accounting_invoices.share_token`.
- Scope: Exposes only sanitized invoice metadata (invoice number, date, due date, items, subtotal, tax, amount paid, balance due, public business name).
- Restriction: NEVER exposes internal journal entries, general ledger balances, or banking credentials.
