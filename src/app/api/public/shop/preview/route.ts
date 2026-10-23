// ═══════════════════════════════════════════════════════════════
// GET /api/public/shop/preview?issue=<id>
// Proxy de lecture du PDF d'un numéro pour l'aperçu boutique.
// Nécessaire car Drive/Cloudinary bloquent la lecture directe côté
// navigateur (CORS) : le serveur récupère le fichier et le re-serve
// en same-origin, consommable par pdf.js. Aucune page au-delà de
// « previewPages » n'est exposée de plus : le PDF complet reste
// public via son URL d'origine (simulation), le filtrage des pages
// est appliqué côté lecteur.
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  clientLimitKey, handleRouteError, HttpError, rateLimit,
} from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Convertit un lien de partage Drive (ou autre) en URL de téléchargement direct. */
export function directFileUrl(url: string): string {
  try {
    // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
    if (fileMatch) return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
    // https://drive.google.com/open?id=FILE_ID
    const openMatch = url.match(/drive\.google\.com\/open\?id=([^&#]+)/);
    if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
    // Lien docs.google.com/uc déjà direct → tel quel
    return url;
  } catch {
    return url;
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!rateLimit(clientLimitKey(req, 'shop-preview'), 30)) {
      throw new HttpError(429, 'Trop de lectures, réessayez dans un instant.');
    }

    const issueId = req.nextUrl.searchParams.get('issue') || '';
    if (!issueId) throw new HttpError(400, 'Paramètre « issue » requis.');

    const issue = await db.magazineIssue.findFirst({
      where: { OR: [{ id: issueId }, { slug: issueId }], published: true },
      select: { pdfUrl: true },
    });
    if (!issue || !issue.pdfUrl) throw new HttpError(404, 'PDF non disponible pour ce numéro.');

    const upstream = await fetch(directFileUrl(issue.pdfUrl), {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReussiteMagazine/1.0)' },
    });
    if (!upstream.ok || !upstream.body) {
      throw new HttpError(502, 'Impossible de récupérer le PDF (vérifiez que le partage du fichier est public).');
    }

    const contentType = upstream.headers.get('content-type')?.includes('text/html')
      ? 'application/pdf' // page intermédiaire Drive : servi quand même en PDF
      : upstream.headers.get('content-type') || 'application/pdf';

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
