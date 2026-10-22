// ═══════════════════════════════════════════════════════════════
// POST /api/chat — assistant de lecture du magazine.
// Recherche les articles pertinents (titres, sous-titres, contenu,
// tags) et répond avec un résumé + liens direct. Aucune clé externe
// requise : l'intelligence est basée sur la recherche plein-texte.
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handleRouteError, ok, readBody, clientLimitKey, rateLimit, contentToText } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GREETINGS = /^(bonjour|salut|bonsoir|hello|hi|coucou|hey|info|aide|help)/i;

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(clientLimitKey(req, 'chat'), 30)) {
      return ok({ reply: 'Un instant, je reçois beaucoup de questions — réessayez dans une minute.', articles: [] });
    }
    const { message } = await readBody<{ message?: string }>(req);
    const q = (message ?? '').trim();
    if (!q) return ok({ reply: 'Posez-moi une question sur un sujet du magazine : « levée de fonds », « interview », « IA »…', articles: [] });

    if (GREETINGS.test(q) && q.length < 25) {
      return ok({
        reply: "Bonjour 👋 Je suis l'assistant de lecture de Réussite Magazine. Décrivez un sujet (ex. « financement des PME », « interview IA ») et je vous trouve les articles correspondants.",
        articles: [],
      });
    }

    // Recherche plein-texte large puis classement par pertinance (occurrences).
    const words = q
      .toLowerCase()
      .split(/[^a-zà-ÿ0-9]+/)
      .filter((w) => w.length > 3)
      .slice(0, 6);

    const candidates = await db.article.findMany({
      where: { status: 'PUBLISHED' },
      select: {
        id: true, title: true, slug: true, subtitle: true, excerpt: true,
        content: true, readingTime: true, publishedAt: true,
        category: { select: { name: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 400,
    });

    const scored = candidates
      .map((a) => {
        const haystack = [a.title, a.subtitle, a.excerpt, contentToText(a.content), a.tags.map((t) => t.tag.name).join(' ')]
          .join(' ')
          .toLowerCase();
        let score = 0;
        for (const w of words) {
          const occurrences = haystack.split(w).length - 1;
          if (occurrences > 0) score += 2 + Math.min(occurrences, 4);
        }
        return { a, score };
      })
      .filter((x) => x.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, 4);

    if (scored.length === 0) {
      return ok({
        reply: `Je n'ai pas trouvé d'article sur « ${q} ». Essayez un autre mot-clé (financement, interview, management, IA, export…) ou utilisez la recherche du site.`,
        articles: [],
      });
    }

    const best = scored[0].a;
    const summary = (best.excerpt || best.subtitle || contentToText(best.content)).slice(0, 280);
    const others = scored.slice(1).map((x) => x.a.title);

    return ok({
      reply:
        `Voici ce que j'ai trouvé sur « ${q} » :\n\n📄 « ${best.title} » — ${best.category.name} · ${best.readingTime} min de lecture\n${summary}${summary.length >= 280 ? '…' : ''}\n\n` +
        (others.length > 0 ? `À lire aussi : ${others.join(' · ')}\n\n` : '') +
        'Cliquez sur un article ci-dessous pour le lire 👇',
      articles: scored.map((x) => ({
        title: x.a.title,
        slug: x.a.slug,
        category: x.a.category.name,
        readingTime: x.a.readingTime,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
