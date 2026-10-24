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
          pricePrintCfa: i.pricePrintCfa,
          pricePrintEur: i.pricePrintEur,
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
          pdfUrl: issue.pdfUrl,
          previewPages: issue.previewPages,
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
