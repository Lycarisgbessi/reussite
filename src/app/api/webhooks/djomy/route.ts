// ═══════════════════════════════════════════════════════════════
// POST /api/webhooks/djomy — réception des événements Djomy.
// Signature vérifiée (X-Webhook-Signature: v1:HMAC(rawBody, secret)).
// Sur payment.success → la commande correspondante passe en PAID
// automatiquement (idempotent), événement analytics journalisé.
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/server/djomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DjomyWebhook {
  eventType?: string;
  eventId?: string;
  message?: string;
  data?: {
    transactionId?: string;
    status?: string;
    paidAmount?: number;
    currency?: string;
    paymentMethod?: string;
    merchantPaymentReference?: string;
    payerIdentifier?: string;
  };
  payment?: {
    transactionId?: string;
    status?: string;
    merchantPaymentReference?: string;
    paidAmount?: number;
    paymentMethod?: string;
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // 1. Signature obligatoire — webhook non signé = rejeté
  if (!verifyWebhookSignature(rawBody, req.headers.get('x-webhook-signature'))) {
    return new Response(JSON.stringify({ error: 'Signature invalide' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: DjomyWebhook;
  try {
    payload = JSON.parse(rawBody) as DjomyWebhook;
  } catch {
    return new Response(JSON.stringify({ error: 'Payload invalide' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Données du paiement (V1 : data ; V2 : data.payment)
  const pay = payload.data?.merchantPaymentReference
    ? payload.data
    : payload.payment;

  const eventType = payload.eventType || '';
  const orderNumber = pay?.merchantPaymentReference || '';
  const transactionId = pay?.transactionId || '';

  if (!orderNumber || !transactionId) {
    // Webhook valide mais sans commande exploitable → acquitté
    return Response.json({ received: true });
  }

  const order = await db.order.findUnique({ where: { orderNumber } }).catch(() => null);
  if (!order) return Response.json({ received: true, order: 'inconnue' });

  if (eventType === 'payment.success' || pay?.status === 'SUCCESS') {
    if (order.status !== 'PAID') {
      await db.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentRef: `DJOMY:${transactionId}`,
          note: [order.note, `Payé via Djomy (${pay?.paymentMethod || 'en ligne'}) — ${pay?.paidAmount ?? order.amountCfa} GNF`].filter(Boolean).join(' · ').slice(0, 500),
        },
      });
      await db.analyticsEvent.create({
        data: { type: 'PAYMENT_SUCCESS', path: `djomy/${orderNumber}`, meta: JSON.stringify({ transactionId }) },
      }).catch(() => {});
    }
  } else if (eventType === 'payment.failed' || eventType === 'payment.cancelled' || eventType === 'payment.timeout') {
    if (order.status === 'PENDING') {
      await db.order.update({
        where: { id: order.id },
        data: {
          note: [order.note, `Djomy : ${eventType} (${transactionId})`].filter(Boolean).join(' · ').slice(0, 500),
        },
      }).catch(() => {});
    }
  }

  // 3. Toujours 200 pour acquitter (sinon Djomy rejoue le webhook)
  return Response.json({ received: true });
}
