import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Queryable } from "../db/types";
import type { PaymentRow } from "@/types/database";

export async function findPaymentByProviderPayment(provider: string, paymentId: string, db?: Queryable): Promise<PaymentRow | null> {
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query<PaymentRow>("select * from payments where provider=$1 and provider_payment_id=$2", [provider, paymentId]);
    return res.rows[0] ?? null;
  }
  const payment = await prisma.payment.findFirst({
    where: {
      provider,
      providerPaymentId: paymentId,
    },
  });
  if (!payment) return null;
  return {
    id: payment.id,
    order_id: payment.orderId,
    provider: payment.provider,
    provider_order_id: payment.providerOrderId,
    provider_payment_id: payment.providerPaymentId,
    provider_refund_id: payment.providerRefundId,
    idempotency_key: payment.idempotencyKey,
    amount_minor: payment.amountMinor,
    currency: payment.currency,
    status: payment.status,
    refunded_minor: payment.refundedMinor,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
  } as PaymentRow;
}

export async function findWebhookEvent(provider: string, eventId: string, db?: Queryable): Promise<any | null> {
  if (db && db !== (await import("../db")).pool) {
    const res = await db.query("select * from payment_webhook_events where provider=$1 and provider_event_id=$2", [provider, eventId]);
    return res.rows[0] ?? null;
  }
  const event = await prisma.paymentWebhookEvent.findUnique({
    where: {
      provider_providerEventId: {
        provider,
        providerEventId: eventId,
      },
    },
  });
  if (!event) return null;
  return {
    id: event.id,
    payment_id: event.paymentId,
    provider: event.provider,
    provider_event_id: event.providerEventId,
    provider_order_id: event.providerOrderId,
    provider_payment_id: event.providerPaymentId,
    provider_refund_id: event.providerRefundId,
    payload_hash: event.payloadHash,
    signature_verified: event.signatureVerified,
    status: event.status,
    attempt_count: event.attemptCount,
    last_error: event.lastError,
    received_at: event.receivedAt,
    processed_at: event.processedAt,
    updated_at: event.updatedAt,
  };
}
