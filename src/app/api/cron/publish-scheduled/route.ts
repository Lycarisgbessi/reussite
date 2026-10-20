// ═══════════════════════════════════════════════════════════════
// GET /api/cron/publish-scheduled — publie les articles SCHEDULED
// dont la date est arrivée : traduction auto + notification push.
// Appelé par le cron Vercel (vercel.json, toutes les 5 min) et,
// en secours, à chaque bootstrap du site public (fire-and-forget).
// Protégé par CRON_SECRET si défini (header Authorization: Bearer).
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handleRouteError, ok } from '@/lib/server/utils';
import { translateEntity } from '@/lib/server/translate';
import { broadcastPush, pushConfigured } from '@/lib/server/push';
import { autoFeatureArticle, autoFlashArticle } from '@/lib/server/autoPublish';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Publie les articles planifiés échus. Idempotent. */
export async function publishDueScheduledArticles(): Promise<number> {
  const due = await db.article.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    select: { id: true },
    take: 50,
  });
  for (const a of due) {
    const article = await db.article.findUnique({ where: { id: a.id } });
    if (!article) continue;
    await db.article.update({
      where: { id: article.id },
      data: { status: 'PUBLISHED', publishedAt: article.publishedAt ?? new Date() },
    });
    await autoFeatureArticle(article.id);
    await autoFlashArticle(article.id);
    await translateEntity('article', article.id, {
      title: article.title,
      subtitle: article.subtitle,
      excerpt: article.excerpt,
      content: article.content,
    }).catch(() => {});
    if (pushConfigured()) {
      await broadcastPush({
        title: 'Nouvelle publication — Réussite Magazine',
        body: article.title,
        url: `/#/article/${article.slug}`,
        tag: `article-${article.id}`,
      }).catch(() => {});
    }
  }
  return due.length;
}

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.get('authorization');
      if (auth !== `Bearer ${secret}`) {
        return new Response('Unauthorized', { status: 401 });
      }
    }
    const published = await publishDueScheduledArticles();
    return ok({ published, at: new Date().toISOString() });
  } catch (err) {
    return handleRouteError(err);
  }
}
