// ═══════════════════════════════════════════════════════════════
// DJOMY — client serveur pour la plateforme de paiement Djomy
// (Orange Money, MTN MoMo, Soutra Money, PayCard, VISA/MC).
//
// Authentification (doc Djomy v1.0) :
//   signature = HMAC_SHA256(clientId, clientSecret) en hex
//   X-API-KEY = clientId:signature   (entête de TOUTES les requêtes)
//   POST /v1/auth → access token Bearer (requis pour les paiements)
//
// Flux boutique : POST /v1/payments/gateway (redirection portail),
// validation des commandes par webhook signé (/api/webhooks/djomy).
//
// Variables d'environnement :
//   DJOMY_CLIENT_ID / DJOMY_CLIENT_SECRET
//   DJOMY_BASE_URL (défaut : https://api.djomy.com)
// ═══════════════════════════════════════════════════════════════
import crypto from 'node:crypto';

const BASE_URL = process.env.DJOMY_BASE_URL || 'https://api.djomy.com';

export function djomyConfigured(): boolean {
  return Boolean(process.env.DJOMY_CLIENT_ID && process.env.DJOMY_CLIENT_SECRET);
}

/** X-API-KEY = clientId:HMAC_SHA256(clientId, clientSecret) en hex. */
function apiKeyHeader(): string {
  const clientId = process.env.DJOMY_CLIENT_ID!;
  const signature = crypto
    .createHmac('sha256', process.env.DJOMY_CLIENT_SECRET!)
    .update(clientId)
    .digest('hex');
  return `${clientId}:${signature}`;
}

/** Vérifie la signature d'un webhook : X-Webhook-Signature: v1:HMAC(rawBody). */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  if (!header || !djomyConfigured()) return false;
  const expected = crypto
    .createHmac('sha256', process.env.DJOMY_CLIENT_SECRET!)
    .update(rawBody)
    .digest('hex');
  const provided = header.startsWith('v1:') ? header.slice(3) : header;
  // Comparaison à temps constant
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── Access token (mis en cache ~25 min) ────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const res = await fetch(`${BASE_URL}/v1/auth`, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKeyHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { accessToken?: string; token?: string; expiresInSeconds?: number };
    message?: string;
  };
  const token = body.data?.accessToken || body.data?.token;
  if (!res.ok || !token) {
    throw new Error(`Djomy auth échouée (${res.status}) : ${body.message || 'réponse inattendue'}`);
  }
  cachedToken = { token, expiresAt: Date.now() + ((body.data?.expiresInSeconds || 1800) - 300) * 1000 };
  return token;
}

interface GatewayPaymentInput {
  /** Montant (GNF) à payer par le client. */
  amount: number;
  /** Téléphone du payeur au format international, ex : 00224628209866. */
  payerNumber: string;
  /** Référence commande (orderNumber) — retrouvée dans les webhooks. */
  merchantPaymentReference: string;
  description: string;
  origin: string;
}

export interface GatewayPaymentResult {
  ok: boolean;
  paymentUrl?: string;
  transactionId?: string;
  error?: string;
}

/**
 * Initie un paiement avec redirection vers le portail Djomy.
 * Tous les moyens de paiement (OM, MOMO, SOUSTRA, PAYCARD, cartes).
 */
export async function createGatewayPayment(input: GatewayPaymentInput): Promise<GatewayPaymentResult> {
  try {
    const token = await getAccessToken();
    const res = await fetch(`${BASE_URL}/v1/payments/gateway`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKeyHeader(),
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: input.amount,
        countryCode: 'GN',
        payerNumber: input.payerNumber,
        description: input.description.slice(0, 255),
        merchantPaymentReference: input.merchantPaymentReference,
        returnUrl: `${input.origin}/shop?order=${input.merchantPaymentReference}&payment=return`,
        cancelUrl: `${input.origin}/shop?order=${input.merchantPaymentReference}&payment=cancel`,
        metadata: {
          orderNumber: input.merchantPaymentReference,
        },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
      data?: {
        transactionId?: string;
        paymentPageUrl?: string;
        redirectUrl?: string;
        paymentUrl?: string;
      };
    };
    const url = body.data?.paymentPageUrl || body.data?.redirectUrl || body.data?.paymentUrl;
    if (!res.ok || !url) {
      return { ok: false, error: body.message || `Djomy a refusé le paiement (HTTP ${res.status})` };
    }
    return { ok: true, paymentUrl: url, transactionId: body.data?.transactionId };
  } catch (err) {
    cachedToken = null; // force un nouveau jeton au prochain essai
    return { ok: false, error: err instanceof Error ? err.message : 'Djomy injoignable' };
  }
}
