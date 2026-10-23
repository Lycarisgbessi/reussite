// ═══════════════════════════════════════════════════════════════
// /api/public/shop — BOUTIQUE publique :
//   GET  /api/public/shop                 → numéros publiés + plans actifs
//   GET  /api/public/shop/issues/:id      → détail d'un numéro (aperçu inclus)
//   POST /api/public/shop/order           → création de commande (rate-limité)
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  clientLimitKey, handleRouteError, HttpError, isValidEmail, ok, rateLimit, readBody,
} from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  try {
    const seg = req.nextUrl.pathname.replace(/^\/api\/public\/shop\/?/, '').split('/').filter(Boolean);

    if (seg.length === 0 || seg[0] === '') {
      const [issues, plans] = await Promise.all([
        db.magazineIssue.findMany({ where: { published: true }, orderBy: { releaseDate: 'desc' } }),
        db.subscriptionPlan.findMany({ where: { active: true }, orderBy: { priceCfa: 'asc' } }),
      ]);
      return ok({
        issues: issues.map((i) => ({
          id: i.id,
          slug: i.slug,
          title: i.title,
          issueNumber: i.issueNumber,
          description: i.description,
          coverUrl: i.coverUrl,
          priceCfa: i.priceCfa,
          priceEur: i.priceEur,
          featured: i.featured,
          releaseDate: i.releaseDate.toISOString(),
        })),
        plans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          durationMonths: p.durationMonths,
          issuesCount: p.issuesCount,
          priceCfa: p.priceCfa,
          priceEur: p.priceEur,
          perks: parseJson<string[]>(p.perks, []),
        })),
      });
    }

    // /issues/:id
    if (seg[0] === 'issues' && seg[1]) {
      const issue = await db.magazineIssue.findFirst({
        where: { OR: [{ id: seg[1] }, { slug: seg[1] }], published: true },
      });
      if (!issue) throw new HttpError(404, 'Numéro introuvable.');
      return ok({
        issue: {
          id: issue.id,
          slug: issue.slug,
          title: issue.title,
          issueNumber: issue.issueNumber,
          description: issue.description,
          coverUrl: issue.coverUrl,
          previewImages: parseJson<string[]>(issue.previewImages, []),
          priceCfa: issue.priceCfa,
          priceEur: issue.priceEur,
          featured: issue.featured,
          releaseDate: issue.releaseDate.toISOString(),
        },
      });
    }

    throw new HttpError(404, 'Ressource introuvable.');
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(clientLimitKey(req, 'shop-order'), 10)) {
      throw new HttpError(429, 'Trop de tentatives, réessayez dans une minute.');
    }
    const body = await readBody<{
      type?: string; issueId?: string; planId?: string;
      buyerName?: string; buyerEmail?: string; buyerPhone?: string;
      currency?: string; paymentMethod?: string; paymentRef?: string; note?: string;
    }>(req);

    const type = body.type === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'SINGLE';
    const buyerName = String(body.buyerName ?? '').trim();
    const buyerEmail = String(body.buyerEmail ?? '').trim().toLowerCase();
    if (!buyerName || !isValidEmail(buyerEmail)) {
      throw new HttpError(400, 'Nom et email valides requis.');
    }

    let amountCfa = 0;
    let amountEur = 0;
    let issueId: string | null = null;
    let planId: string | null = null;

    if (type === 'SINGLE') {
      if (!body.issueId) throw new HttpError(400, 'Numéro manquant.');
      const issue = await db.magazineIssue.findUnique({ where: { id: body.issueId } });
      if (!issue || !issue.published) throw new HttpError(404, 'Numéro introuvable.');
      issueId = issue.id;
      amountCfa = issue.priceCfa;
      amountEur = issue.priceEur;
    } else {
      if (!body.planId) throw new HttpError(400, 'Formule d’abonnement manquante.');
      const plan = await db.subscriptionPlan.findUnique({ where: { id: body.planId } });
      if (!plan || !plan.active) throw new HttpError(404, 'Formule introuvable.');
      planId = plan.id;
      amountCfa = plan.priceCfa;
      amountEur = plan.priceEur;
    }

    const currency = body.currency === 'EUR' ? 'EUR' : 'XOF';
    const orderNumber = `RM-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;

    const order = await db.order.create({
      data: {
        orderNumber,
        type,
        issueId,
        planId,
        buyerName,
        buyerEmail,
        buyerPhone: String(body.buyerPhone ?? '').slice(0, 40),
        amountCfa,
        amountEur,
        currency,
        paymentMethod: ['MOBILE_MONEY', 'BANK_TRANSFER', 'CARD'].includes(String(body.paymentMethod))
          ? String(body.paymentMethod)
          : 'MOBILE_MONEY',
        paymentRef: String(body.paymentRef ?? '').slice(0, 120),
        note: String(body.note ?? '').slice(0, 500),
        status: 'PENDING',
      },
    });

    return ok({
      order: {
        orderNumber: order.orderNumber,
        type: order.type,
        amountCfa: order.amountCfa,
        amountEur: order.amountEur,
        currency: order.currency,
        status: order.status,
      },
      // Instructions de paiement (validation par la rédaction ; prêt pour
      // brancher CinetPay/Stripe : remplacer ce bloc par un appel provider).
      instructions: {
        mobileMoney: [
          { network: 'Orange Money', number: '628 20 98 66' },
          { network: 'MTN MoMo', number: '622 85 70 35' },
        ],
        bankTransfer: 'Coordonnées bancaires communiquées par email après la commande.',
        steps: [
          'Réglez le montant exact via le moyen choisi.',
          `Indiquez la référence « ${order.orderNumber} » dans le motif.`,
          'La rédaction valide votre paiement (généralement sous 2 h ouvrées).',
          'Vous recevez le numéro (PDF/lien) par email.',
        ],
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
