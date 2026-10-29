import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handleRouteError, HttpError, ok } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!id) throw new HttpError(400, 'Identifiant de numéro manquant.');

    const issue = await db.magazineIssue.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
        published: true,
      },
    });

    if (!issue) {
      throw new HttpError(404, 'Ce numéro du magazine est introuvable.');
    }

    return ok({
      issue: {
        id: issue.id,
        slug: issue.slug,
        title: issue.title,
        issueNumber: issue.issueNumber,
        description: issue.description,
        coverUrl: issue.coverUrl,
        previewImages: parseJson<string[]>(issue.previewImages, []),
        previewPages: issue.previewPages ?? 5,
        priceCfa: issue.priceCfa,
        priceEur: issue.priceEur,
        pricePrintCfa: issue.pricePrintCfa,
        pricePrintEur: issue.pricePrintEur,
        featured: issue.featured,
        releaseDate: issue.releaseDate.toISOString(),
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
