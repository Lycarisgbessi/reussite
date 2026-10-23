// ═══════════════════════════════════════════════════════════════
// GET /api/public/shop/download?order=RM-XXXX&email=…
// Téléchargement du PDF d'un numéro ACHETÉ : la commande doit être
// VALIDÉE (PAID) par la rédaction et l'email doit correspondre.
// Le fichier est streamé par le serveur (fonctionne pour Drive
// comme pour Cloudinary, avec Content-Disposition attachment).
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handleRouteError, HttpError, isValidEmail, rateLimit, clientLimitKey } from '@/lib/server/utils';
import { directFileUrl } from '../preview/route';

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

    const upstream = await fetch(directFileUrl(order.issue.pdfUrl), {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReussiteMagazine/1.0)' },
    });
    if (!upstream.ok || !upstream.body) {
      throw new HttpError(502, 'Impossible de récupérer le PDF (vérifiez que le partage du fichier est public).');
    }

    const safeName = `Reussite-${String(order.issue.issueNumber).padStart(2, '0')}.pdf`;
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
