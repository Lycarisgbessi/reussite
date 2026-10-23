// ═══════════════════════════════════════════════════════════════
// GET /api/public/shop/download?order=RM-XXXX&email=…
// Téléchargement du PDF d'un numéro ACHETÉ : la commande doit être
// VALIDÉE (PAID) par la rédaction et l'email doit correspondre.
// En simulation : redirection 302 vers le PDF hébergé (Cloudinary).
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handleRouteError, HttpError, isValidEmail, rateLimit, clientLimitKey } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!rateLimit(clientLimitKey(req, 'shop-download'), 15)) {
      throw new HttpError(429, 'Trop de tentatives, réessayez dans un instant.');
    }

    const orderNumber = (req.nextUrl.searchParams.get('order') || '').trim().toUpperCase();
    const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
    if (!orderNumber || !isValidEmail(email)) {
      throw new HttpError(400, 'Numéro de commande et adresse email requis.');
    }

    const order = await db.order.findUnique({
      where: { orderNumber },
      include: { issue: true },
    });
    if (!order || order.buyerEmail.toLowerCase() !== email) {
      throw new HttpError(404, 'Commande introuvable : vérifiez le numéro de commande et l’email.');
    }
    if (order.status === 'PENDING') {
      throw new HttpError(402, 'Paiement en cours de validation par la rédaction. Revenez dès réception de la confirmation.');
    }
    if (order.status === 'CANCELLED') {
      throw new HttpError(410, 'Cette commande a été annulée. Contactez la rédaction.');
    }
    if (order.type !== 'SINGLE' || !order.issue) {
      throw new HttpError(400, 'Le téléchargement direct concerne les achats de numéros. Les abonnés reçoivent chaque numéro par email.');
    }
    if (!order.issue.pdfUrl) {
      throw new HttpError(503, 'Le PDF de ce numéro n’est pas encore disponible. La rédaction est informée.');
    }

    return new Response(null, {
      status: 302,
      headers: { Location: order.issue.pdfUrl },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
