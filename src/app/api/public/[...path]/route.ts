// ═══════════════════════════════════════════════════════════════
// ROUTEUR PUBLIC — /api/public/*
// homepage, articles (+ détail, like, commentaires), vidéos,
// podcasts (+ play), pages, recherche, suggestion, newsletter,
// contact, régie pub (+ clic), tracking, favoris.
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  articleInclude, clientLimitKey, contentToText, getPageParams, handleRouteError, HttpError,
  isValidEmail, jsonError, matchesSearch, ok, publishedFilter, rateLimit, readBody, requireFields,
  serializeAdBanner, serializeArticleFull, serializeArticleSummary, serializePodcast,
  serializeVideo, type ArticleWithRelations,
} from '@/lib/server/utils';
import { applyTranslations } from '@/lib/server/translate';
import type { AdBanner, ArticleSummary } from '@/lib/types';
import type { PublicComment } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Helpers internes ─────────────────────────────────────────

/** Incrémente les vues d'un article + event analytics, sans bloquer la réponse. */
function trackArticleView(articleId: string, path: string): void {
  void db.article
    .update({ where: { id: articleId }, data: { views: { increment: 1 } } })
    .catch(() => {});
  void db.analyticsEvent
    .create({ data: { type: 'ARTICLE_VIEW', path } })
    .catch(() => {});
}

function publicComment(c: { id: string; authorName: string; content: string; reply: string; createdAt: Date }): PublicComment {
  return {
    id: c.id,
    authorName: c.authorName,
    content: c.content,
    reply: c.reply,
    createdAt: c.createdAt.toISOString(),
  };
}

function approvedComments(articleId: string) {
  return db.comment.findMany({
    where: { articleId, status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
  });
}

/** Texte traduit d'un article (recherche multilingue) — repli FR. */
async function translatedHaystacks<T extends { id: string }>(
  rows: T[],
  haystacks: (r: T) => string[],
  lang: string,
): Promise<(r: T) => string[]> {
  if (lang === 'fr' || rows.length === 0) return haystacks;
  const trs = await db.translation.findMany({
    where: { entityType: 'article', entityId: { in: rows.map((r) => r.id) }, locale: lang },
    select: { entityId: true, data: true },
  });
  const map = new Map(trs.map((t) => [t.entityId, JSON.parse(t.data || '{}')]));
  return (r: T) => {
    const base = haystacks(r);
    const t = map.get(r.id) as Record<string, unknown> | undefined;
    if (!t) return base;
    const extra = [t.title, t.subtitle, t.excerpt, t.content];
    // content = blocs JSON traduits : on extrait leurs textes.
    if (Array.isArray(t.content)) {
      for (const b of t.content as { type?: string; text?: string; items?: string[] }[]) {
        if (typeof b?.text === 'string') extra.push(b.text);
        if (Array.isArray(b?.items)) extra.push(...b.items);
      }
    }
    return [...base, ...extra.filter((x): x is string => typeof x === 'string' && Boolean(x))];
  };
}

function sortArticles(list: ArticleWithRelations[], sort: string): ArticleWithRelations[] {
  const ts = (d: Date | null) => (d ? d.getTime() : 0);
  switch (sort) {
    case 'POPULAR':
      return list.sort((a, b) => b.views - a.views);
    case 'AZ':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    case 'RECENT':
    default:
      return list.sort((a, b) => ts(b.publishedAt) - ts(a.publishedAt));
  }
}

/** Liste publiée filtrée (catégorie, tag, exclusion) puis recherche JS insensible + tri + pagination. */
async function listPublishedArticles(sp: URLSearchParams) {
  const { page, limit, skip, take } = getPageParams(sp, 12);
  const sort = sp.get('sort') ?? 'RECENT';
  const search = (sp.get('search') ?? '').trim();

  const where: Prisma.ArticleWhereInput = { ...publishedFilter() };

  const categorySlug = sp.get('category');
  if (categorySlug) {
    const category = await db.category.findUnique({ where: { slug: categorySlug }, select: { id: true } });
    if (!category) return { articles: [], total: 0, page, totalPages: 1 };
    // Une rubrique parente inclut ses sous-rubriques.
    const children = await db.category.findMany({ where: { parentId: category.id }, select: { id: true } });
    where.categoryId = { in: [category.id, ...children.map((c) => c.id)] };
  }
  const tag = sp.get('tag');
  if (tag) where.tags = { some: { tag: { name: tag } } };
  const exclude = sp.get('exclude');
  if (exclude) where.slug = { not: exclude };

  // Recherche LIKE côté SQL (limite les candidats) puis affinage JS insensible à la casse.
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { subtitle: { contains: search } },
      { content: { contains: search } },
    ];
  }

  const candidates = await db.article.findMany({
    where,
    include: articleInclude,
    orderBy: { publishedAt: 'desc' },
    take: 1000,
  });

  const filtered = search
    ? candidates.filter((a) =>
        matchesSearch(
          [a.title, a.subtitle, contentToText(a.content), a.tags.map((t) => t.tag.name).join(' ')],
          search,
        ),
      )
    : candidates;

  sortArticles(filtered, sort);
  const total = filtered.length;
  const pageItems = await applyTranslations(
    filtered.slice(skip, skip + take).map(serializeArticleSummary),
    'article',
    sp.get('lang') || 'fr',
  );
  return {
    articles: pageItems,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Sélection d'une campagne publicitaire pondérée + incrément d'impressions. */
async function pickAd(placementKey: string, category: string | null, userAgent: string): Promise<AdBanner | null> {
  const placement = await db.adPlacement.findUnique({ where: { key: placementKey } });
  if (!placement || !placement.active) return null;

  const now = new Date();
  const campaigns = await db.adCampaign.findMany({
    where: {
      placementId: placement.id,
      active: true,
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
  });

  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
  const eligible = campaigns.filter((c) => {
    if (c.deviceTargeting === 'MOBILE' && !isMobile) return false;
    if (c.deviceTargeting === 'DESKTOP' && isMobile) return false;
    if (category) {
      const targets = c.categoryTargeting.split(',').map((s) => s.trim()).filter(Boolean);
      if (targets.length > 0 && !targets.includes(category)) return false;
    }
    return true;
  });
  if (eligible.length === 0) return null;

  const totalWeight = eligible.reduce((sum, c) => sum + Math.max(1, c.weight), 0);
  let roll = Math.random() * totalWeight;
  let chosen = eligible[eligible.length - 1];
  for (const c of eligible) {
    roll -= Math.max(1, c.weight);
    if (roll <= 0) {
      chosen = c;
      break;
    }
  }

  void db.adCampaign
    .update({ where: { id: chosen.id }, data: { impressions: { increment: 1 } } })
    .catch(() => {});

  return serializeAdBanner(chosen);
}

// ─── Handlers par ressource ───────────────────────────────────

async function handleHomepage(sp: URLSearchParams) {
  const now = new Date();
  const base = publishedFilter();
  const lang = sp.get('lang') || 'fr';

  const [featuredRaw, latestRaw, popularRaw, categories, videos, podcasts, nativeCampaigns] =
    await Promise.all([
      db.article.findMany({
        where: { ...base, featured: true },
        include: articleInclude,
        orderBy: { featuredOrder: 'asc' },
        take: 6,
      }),
      db.article.findMany({
        where: base,
        include: articleInclude,
        orderBy: { publishedAt: 'desc' },
        take: 12,
      }),
      db.article.findMany({
        where: base,
        include: articleInclude,
        orderBy: { views: 'desc' },
        take: 6,
      }),
      db.category.findMany({ where: { showInHome: true }, orderBy: { order: 'asc' } }),
      db.video.findMany({ where: { published: true }, orderBy: { publishedAt: 'desc' }, take: 4 }),
      db.podcast.findMany({ where: { published: true }, orderBy: { publishedAt: 'desc' }, take: 4 }),
      db.adCampaign.findMany({
        where: {
          active: true,
          placement: { key: 'NATIVE', active: true },
          OR: [{ startDate: null }, { startDate: { lte: now } }],
          AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
        },
        include: { placement: true },
        take: 6,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

  // Complète « popular » avec les articles tendance si nécessaire.
  const popular = [...popularRaw];
  if (popular.length < 6) {
    const inList = new Set(popular.map((a) => a.id));
    const trending = await db.article.findMany({
      where: { ...base, trending: true },
      include: articleInclude,
      orderBy: { views: 'desc' },
      take: 6,
    });
    for (const t of trending) {
      if (popular.length >= 6) break;
      if (!inList.has(t.id)) popular.push(t);
    }
  }

  const categoryBlocks = await Promise.all(
    categories.map(async (category) => ({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        imageUrl: category.imageUrl,
        color: category.color,
        parentId: category.parentId,
        order: category.order,
        showInMenu: category.showInMenu,
        showInHome: category.showInHome,
      },
      articles: await applyTranslations(
        (
          await db.article.findMany({
            where: { ...base, categoryId: category.id },
            include: articleInclude,
            orderBy: { publishedAt: 'desc' },
            take: 4,
          })
        ).map(serializeArticleSummary),
        'article',
        lang,
      ),
    })),
  );

  const [featured, latest, popularT, latestVideos, latestPodcasts] = await Promise.all([
    applyTranslations(featuredRaw.map(serializeArticleSummary), 'article', lang),
    applyTranslations(latestRaw.map(serializeArticleSummary), 'article', lang),
    applyTranslations(popular.map(serializeArticleSummary), 'article', lang),
    applyTranslations(videos.map(serializeVideo), 'video', lang),
    applyTranslations(podcasts.map(serializePodcast), 'podcast', lang),
  ]);
  const translatedCategories = await applyTranslations(
    categoryBlocks.map((b) => ({ ...b.category, articles: [] as ArticleSummary[] })),
    'category',
    lang,
  );
  const catNameMap = new Map(translatedCategories.map((c) => [c.id, c]));
  for (const block of categoryBlocks) {
    const tc = catNameMap.get(block.category.id);
    if (tc && tc.name) {
      block.category.name = tc.name;
      if (tc.description) block.category.description = tc.description;
    }
  }

  return ok({
    featured,
    latest,
    popular: popularT,
    categoryBlocks,
    latestVideos,
    latestPodcasts,
    partners: nativeCampaigns.map(serializeAdBanner),
  });
}

async function handleArticleDetail(slug: string, sp: URLSearchParams) {
  const lang = sp.get('lang') || 'fr';
  const article = await db.article.findUnique({ where: { slug }, include: articleInclude });
  if (!article || article.status !== 'PUBLISHED') throw new HttpError(404, 'Article introuvable.');
  if (article.publishedAt && article.publishedAt > new Date()) throw new HttpError(404, 'Article introuvable.');

  trackArticleView(article.id, `/article/${article.slug}`);

  const [related, comments] = await Promise.all([
    db.article.findMany({
      where: { ...publishedFilter(), categoryId: article.categoryId, id: { not: article.id } },
      include: articleInclude,
      orderBy: { publishedAt: 'desc' },
      take: 4,
    }),
    approvedComments(article.id),
  ]);

  return ok({
    article: (await applyTranslations([serializeArticleFull(article)], 'article', lang))[0],
    related: await applyTranslations(related.map(serializeArticleSummary), 'article', lang),
    approvedComments: comments.map(publicComment),
  });
}

async function handleSearch(sp: URLSearchParams) {
  const q = (sp.get('q') ?? '').trim();
  const category = sp.get('category');
  const type = sp.get('type');
  const lang = sp.get('lang') || 'fr';

  if (!q) return ok({ articles: [], videos: [], podcasts: [], pages: [], total: 0 });

  let where: Prisma.ArticleWhereInput = { ...publishedFilter() };
  if (category) {
    const cat = await db.category.findUnique({ where: { slug: category }, select: { id: true } });
    if (cat) where.categoryId = cat.id;
  }
  where.OR = [{ title: { contains: q } }, { subtitle: { contains: q } }, { content: { contains: q } }];

  const want = (t: string) => !type || type.toUpperCase() === t;

  const [articleRows, videoRows, podcastRows, pageRows] = await Promise.all([
    want('ARTICLE')
      ? db.article.findMany({ where, include: articleInclude, orderBy: { publishedAt: 'desc' }, take: 200 })
      : Promise.resolve([] as ArticleWithRelations[]),
    want('VIDEO')
      ? db.video.findMany({
          where: { published: true, OR: [{ title: { contains: q } }, { description: { contains: q } }] },
          orderBy: { publishedAt: 'desc' },
          take: 30,
        })
      : Promise.resolve([]),
    want('PODCAST')
      ? db.podcast.findMany({
          where: {
            published: true,
            OR: [{ title: { contains: q } }, { description: { contains: q } }, { guests: { contains: q } }],
          },
          orderBy: { publishedAt: 'desc' },
          take: 30,
        })
      : Promise.resolve([]),
    want('PAGE')
      ? db.staticPage.findMany({
          where: { published: true, OR: [{ title: { contains: q } }, { content: { contains: q } }] },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  // Affinage insensible à la casse — inclut les TRADUCTIONS (lang≠fr).
  const articleHaystacks = await translatedHaystacks(
    articleRows,
    (a: ArticleWithRelations) => [a.title, a.subtitle, contentToText(a.content), a.tags.map((t) => t.tag.name).join(' ')],
    lang,
  );
  const articles = articleRows
    .filter((a, i) => matchesSearch(articleHaystacks[i] ?? [], q))
    .slice(0, 20)
    .map(serializeArticleSummary);
  const videos = videoRows
    .filter((v) => matchesSearch([v.title, v.description], q))
    .slice(0, 20)
    .map(serializeVideo);
  const podcasts = podcastRows
    .filter((p) => matchesSearch([p.title, p.description, p.guests], q))
    .slice(0, 20)
    .map(serializePodcast);
  const pages = pageRows
    .filter((p) => matchesSearch([p.title, p.content], q))
    .slice(0, 10)
    .map((p) => ({ slug: p.slug, title: p.title }));

  return ok({ articles, videos, podcasts, pages, total: articles.length + videos.length + podcasts.length + pages.length });
}

async function handleSuggest(sp: URLSearchParams) {
  const q = (sp.get('q') ?? '').trim();
  const lang = sp.get('lang') || 'fr';
  if (!q) return ok({ suggestions: [] });

  const [articles, videos, podcasts] = await Promise.all([
    db.article.findMany({
      where: { ...publishedFilter(), title: { contains: q } },
      select: { id: true, slug: true, title: true },
      take: 6,
      orderBy: { publishedAt: 'desc' },
    }),
    db.video.findMany({
      where: { published: true, title: { contains: q } },
      select: { id: true, title: true },
      take: 4,
      orderBy: { publishedAt: 'desc' },
    }),
    db.podcast.findMany({
      where: { published: true, title: { contains: q } },
      select: { id: true, title: true },
      take: 4,
      orderBy: { publishedAt: 'desc' },
    }),
  ]);

  // Titres traduits pour la langue courante (repli FR).
  let titleById = new Map<string, string>();
  if (lang !== 'fr' && articles.length > 0) {
    const trs = await db.translation.findMany({
      where: { entityType: 'article', entityId: { in: articles.map((a) => a.id) }, locale: lang },
      select: { entityId: true, data: true },
    });
    titleById = new Map(
      trs
        .map((t): [string, string] => [t.entityId, String((JSON.parse(t.data || '{}') as { title?: string }).title ?? '')])
        .filter(([, v]) => Boolean(v)),
    );
  }
  const suggestions = [
    ...articles
      .filter((a) => matchesSearch([a.title, titleById.get(a.id) ?? ''], q))
      .map((a) => ({ slug: a.slug, title: titleById.get(a.id) || a.title, type: 'ARTICLE' as const })),
    ...videos
      .filter((v) => matchesSearch([v.title], q))
      .map((v) => ({ slug: v.id, title: v.title, type: 'VIDEO' as const })),
    ...podcasts
      .filter((p) => matchesSearch([p.title], q))
      .map((p) => ({ slug: p.id, title: p.title, type: 'PODCAST' as const })),
  ].slice(0, 8);

  return ok({ suggestions });
}

async function handleVideos(sp: URLSearchParams) {
  const { page, limit, skip, take } = getPageParams(sp, 12);
  const playlist = sp.get('playlist');
  const where: Prisma.VideoWhereInput = { published: true };
  if (playlist) where.playlist = playlist;
  const [rows, total] = await Promise.all([
    db.video.findMany({ where, orderBy: { publishedAt: 'desc' }, skip, take }),
    db.video.count({ where }),
  ]);
  const items = await applyTranslations(rows.map(serializeVideo), 'video', sp.get('lang') || 'fr');
  return ok({ items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

/** Détail d'une vidéo publique + vidéos liées (même playlist). */
async function handleVideoDetail(id: string, sp: URLSearchParams) {
  const lang = sp.get('lang') || 'fr';
  const video = await db.video.findUnique({ where: { id } });
  if (!video || !video.published) throw new HttpError(404, 'Vidéo introuvable.');
  void db.video
    .update({ where: { id: video.id }, data: { views: { increment: 1 } } })
    .catch(() => {});
  const relatedRows = await db.video.findMany({
    where: { published: true, playlist: video.playlist, id: { not: video.id } },
    orderBy: { publishedAt: 'desc' },
    take: 8,
  });
  const [me] = await applyTranslations([serializeVideo(video)], 'video', lang);
  const related = await applyTranslations(relatedRows.map(serializeVideo), 'video', lang);
  return ok({ video: me, related });
}

/** Liste complète des playlists (hiérarchisation de la page vidéos). */
async function handleVideoPlaylists(sp: URLSearchParams) {
  const rows = await db.video.findMany({
    where: { published: true },
    select: { playlist: true },
    distinct: ['playlist'],
    orderBy: { playlist: 'asc' },
  });
  return ok({ playlists: rows.map((r) => r.playlist).filter(Boolean) });
}

/** Liens audio Google Drive → proxy local (lecture fiable, seek inclus). */
function proxiedAudioUrl(url: string): string {
  if (!url) return url;
  if (/drive\.google\.com|docs\.google\.com/i.test(url)) {
    return `/api/audio-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function handlePodcasts(sp: URLSearchParams) {
  const { page, limit, skip, take } = getPageParams(sp, 12);
  const collectionId = sp.get('collection');
  const where: Prisma.PodcastWhereInput = { published: true };
  if (collectionId) where.collectionId = collectionId;
  const [rows, total] = await Promise.all([
    db.podcast.findMany({
      where,
      include: { collection: true },
      orderBy: [{ season: 'asc' }, { episode: 'asc' }, { publishedAt: 'desc' }],
      skip,
      take,
    }),
    db.podcast.count({ where }),
  ]);
  const items = (await applyTranslations(rows.map(serializePodcast), 'podcast', sp.get('lang') || 'fr')).map(
    (p) => ({ ...p, audioUrl: proxiedAudioUrl(p.audioUrl) }),
  );
  return ok({ items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
}

/** Arborescence des collections de podcasts (mère/fille, renommables). */
async function handlePodcastCollections() {
  const rows = await db.podcastCollection.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { podcasts: true } } },
  });
  interface Node {
    id: string;
    title: string;
    description: string;
    parentId: string | null;
    order: number;
    podcastCount: number;
    children: Node[];
  }
  const flat = rows.map((c): Omit<Node, 'children'> => ({
    id: c.id,
    title: c.title,
    description: c.description,
    parentId: c.parentId,
    order: c.order,
    podcastCount: c._count.podcasts,
  }));
  const byParent = new Map<string | null, Omit<Node, 'children'>[]>();
  for (const c of flat) {
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }
  const build = (parent: string | null): Node[] =>
    (byParent.get(parent) ?? []).map((c) => ({ ...c, children: build(c.id) }));
  return ok({ collections: build(null) });
}

async function handleFavoritesGet(sp: URLSearchParams) {
  const readerKey = (sp.get('readerKey') ?? '').trim();
  if (!readerKey) return ok({ articles: [] });
  const rows = await db.favorite.findMany({
    where: { readerKey },
    include: { article: { include: articleInclude } },
    orderBy: { createdAt: 'desc' },
  });
  const articles: ArticleSummary[] = await applyTranslations(
    rows
      .map((f) => f.article)
      .filter((a) => a && a.status === 'PUBLISHED')
      .map(serializeArticleSummary),
    'article',
    sp.get('lang') || 'fr',
  );
  return ok({ articles });
}

async function handleFavoritesPost(req: NextRequest) {
  const body = await readBody<{ readerKey?: string; articleId?: string }>(req);
  const missing = requireFields(body as Record<string, unknown>, ['readerKey', 'articleId']);
  if (missing) throw new HttpError(400, missing);

  const article = await db.article.findUnique({ where: { id: body.articleId }, select: { id: true } });
  if (!article) throw new HttpError(404, 'Article introuvable.');

  const existing = await db.favorite.findUnique({
    where: { readerKey_articleId: { readerKey: body.readerKey!, articleId: body.articleId! } },
  });
  if (existing) {
    await db.favorite.delete({ where: { id: existing.id } });
    return ok({ favorited: false });
  }
  await db.favorite.create({ data: { readerKey: body.readerKey!, articleId: body.articleId! } });
  return ok({ favorited: true });
}

// ─── Routeurs GET / POST ──────────────────────────────────────

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path = [] } = await ctx.params;
    const [root, second, third] = path;
    const sp = req.nextUrl.searchParams;

    switch (root) {
      case undefined:
      case 'homepage':
        return handleHomepage(sp);

      case 'articles':
        // /articles | /articles/:slug | /articles/:articleId/comments
        if (!second) return ok(await listPublishedArticles(sp));
        if (third === 'comments') {
          const comments = await approvedComments(second);
          return ok({ comments: comments.map(publicComment) });
        }
        return handleArticleDetail(second, sp);

      case 'videos':
        if (second === 'playlists') return handleVideoPlaylists(sp);
        if (second) return handleVideoDetail(second, sp);
        return handleVideos(sp);

      case 'podcasts':
        if (second === 'collections') return handlePodcastCollections();
        return handlePodcasts(sp);

      case 'pages': {
        if (!second) throw new HttpError(400, 'Slug de page manquant.');
        const page = await db.staticPage.findUnique({ where: { slug: second } });
        if (!page || !page.published) throw new HttpError(404, 'Page introuvable.');
        let pageTitle = page.title;
        let pageContent = page.content;
        const lang = sp.get('lang') || 'fr';
        if (lang !== 'fr') {
          const [tr] = await applyTranslations([{ id: page.id }], 'page', lang);
          const overlay = tr as unknown as Record<string, string>;
          if (overlay.title) pageTitle = overlay.title;
          if (overlay.content) pageContent = overlay.content;
        }
        return ok({
          page: {
            id: page.id,
            slug: page.slug,
            title: pageTitle,
            content: pageContent,
            seoTitle: page.seoTitle,
            seoDescription: page.seoDescription,
            published: page.published,
            updatedAt: page.updatedAt.toISOString(),
          },
        });
      }

      case 'search':
        return handleSearch(sp);

      case 'suggest':
        return handleSuggest(sp);

      case 'ads': {
        // GET /api/public/ads?placement=KEY&category=slug[&count=N]
        // count>1 : plusieurs créas distinctes (rotation animée côté client).
        const placement = sp.get('placement');
        if (!placement) throw new HttpError(400, 'Emplacement publicitaire manquant.');
        const ua = req.headers.get('user-agent') ?? '';
        const banner = await pickAd(placement, sp.get('category'), ua);
        const count = Math.min(5, Math.max(1, Number(sp.get('count')) || 1));
        const banners = banner ? [banner] : [];
        for (let k = 1; k < count && banners.length < count; k++) {
          const extra = await pickAd(placement, sp.get('category'), ua);
          if (!extra || banners.some((b) => b.id === extra.id)) break;
          banners.push(extra);
        }
        return ok({ banner, banners });
      }

      case 'favorites':
        return handleFavoritesGet(sp);

      default:
        break;
    }
    return jsonError(404, 'Ressource introuvable.');
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path = [] } = await ctx.params;
    const [root, second, third] = path;
    const ipKey = (route: string) => clientLimitKey(req, route);

    switch (root) {
      // POST /articles/:id/like
      case 'articles':
        if (!second) throw new HttpError(400, 'Identifiant d\'article manquant.');
        if (third === 'like') {
          const article = await db.article.findUnique({ where: { id: second }, select: { id: true } });
          if (!article) throw new HttpError(404, 'Article introuvable.');
          const updated = await db.article.update({
            where: { id: article.id },
            data: { likes: { increment: 1 } },
            select: { likes: true },
          });
          return ok({ likes: updated.likes });
        }
        // GET-like via POST non supporté : /articles/:id/comments est en GET.
        throw new HttpError(404, 'Ressource introuvable.');

      // POST /comments
      case 'comments': {
        if (!rateLimit(ipKey('comments'), 20)) return jsonError(429, 'Trop de tentatives, réessayez dans une minute.');
        const body = await readBody<Record<string, unknown>>(req);
        const missing = requireFields(body, ['articleId', 'authorName', 'authorEmail', 'content']);
        if (missing) throw new HttpError(400, missing);
        if (!isValidEmail(String(body.authorEmail))) throw new HttpError(400, 'Adresse email invalide.');
        const article = await db.article.findUnique({ where: { id: String(body.articleId) }, select: { id: true } });
        if (!article) throw new HttpError(404, 'Article introuvable.');
        await db.comment.create({
          data: {
            articleId: article.id,
            authorName: String(body.authorName).trim().slice(0, 80),
            authorEmail: String(body.authorEmail).trim().slice(0, 160),
            content: String(body.content).trim().slice(0, 4000),
            status: 'PENDING',
          },
        });
        return ok({ ok: true, pending: true });
      }

      // POST /podcasts/:id/play
      case 'podcasts': {
        if (!second) throw new HttpError(400, 'Identifiant de podcast manquant.');
        if (third !== 'play') throw new HttpError(404, 'Ressource introuvable.');
        const podcast = await db.podcast.findUnique({ where: { id: second }, select: { id: true } });
        if (!podcast) throw new HttpError(404, 'Podcast introuvable.');
        await db.podcast.update({ where: { id: podcast.id }, data: { plays: { increment: 1 } } });
        return ok({ ok: true });
      }

      // POST /newsletter
      case 'newsletter': {
        if (!rateLimit(ipKey('newsletter'), 20)) return jsonError(429, 'Trop de tentatives, réessayez dans une minute.');
        const body = await readBody<Record<string, unknown>>(req);
        const missing = requireFields(body, ['email']);
        if (missing) throw new HttpError(400, missing);
        const email = String(body.email).trim().toLowerCase();
        if (!isValidEmail(email)) throw new HttpError(400, 'Adresse email invalide.');
        const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
        const interests = typeof body.interests === 'string' ? body.interests.slice(0, 300) : '';
        const source = typeof body.source === 'string' && body.source ? body.source.slice(0, 60) : 'popup';

        const existing = await db.newsletterSubscriber.findUnique({ where: { email } });
        if (existing?.active) {
          return ok({ ok: true, message: 'Vous êtes déjà inscrit(e) à la newsletter. Merci de votre fidélité !' });
        }
        if (existing) {
          await db.newsletterSubscriber.update({
            where: { id: existing.id },
            data: { active: true, name: name || existing.name, interests: interests || existing.interests, source },
          });
          return ok({ ok: true, message: 'Votre inscription a été réactivée. Bienvenue !' });
        }
        await db.newsletterSubscriber.create({ data: { email, name, interests, source } });
        void db.analyticsEvent.create({ data: { type: 'NEWSLETTER_SUB', path: source } }).catch(() => {});
        return ok({ ok: true, message: 'Merci ! Votre inscription à la newsletter est confirmée.' });
      }

      // POST /contact
      case 'contact': {
        if (!rateLimit(ipKey('contact'), 20)) return jsonError(429, 'Trop de tentatives, réessayez dans une minute.');
        const body = await readBody<Record<string, unknown>>(req);
        const missing = requireFields(body, ['name', 'email', 'subject', 'message']);
        if (missing) throw new HttpError(400, missing);
        if (!isValidEmail(String(body.email))) throw new HttpError(400, 'Adresse email invalide.');
        const meta = JSON.stringify({
          name: String(body.name).slice(0, 120),
          email: String(body.email).slice(0, 160),
          subject: String(body.subject).slice(0, 200),
          message: String(body.message).slice(0, 4000),
        });
        await db.analyticsEvent.create({ data: { type: 'CONTACT', path: 'contact', meta } });
        return ok({ ok: true, message: 'Votre message a bien été envoyé. Notre équipe vous répondra rapidement.' });
      }

      // POST /ads/:campaignId/click
      case 'ads': {
        if (!second) throw new HttpError(400, 'Identifiant de campagne manquant.');
        const campaign = await db.adCampaign.findUnique({ where: { id: second }, select: { id: true } });
        if (!campaign) throw new HttpError(404, 'Campagne introuvable.');
        await db.adCampaign.update({ where: { id: campaign.id }, data: { clicks: { increment: 1 } } });
        void db.analyticsEvent.create({ data: { type: 'AD_CLICK', path: second } }).catch(() => {});
        return ok({ ok: true });
      }

      // POST /track
      case 'track': {
        if (!rateLimit(ipKey('track'), 20)) return jsonError(429, 'Trop de tentatives, réessayez dans une minute.');
        const body = await readBody<{ type?: string; path?: string; meta?: Record<string, unknown> }>(req);
        const allowed = ['PAGE_VIEW', 'ARTICLE_VIEW', 'SEARCH', 'NEWSLETTER_SUB', 'CONTACT', 'AD_CLICK'];
        if (!body.type || !allowed.includes(body.type)) throw new HttpError(400, 'Type d\'événement invalide.');
        let meta = '';
        if (body.meta !== undefined && body.meta !== null) {
          try {
            meta = JSON.stringify(body.meta).slice(0, 2000);
          } catch {
            meta = '';
          }
        }
        await db.analyticsEvent.create({
          data: { type: body.type, path: (body.path ?? '').slice(0, 300), meta },
        });
        return ok({ ok: true });
      }

      // POST /favorites (toggle)
      case 'favorites':
        return handleFavoritesPost(req);

      default:
        break;
    }
    return jsonError(404, 'Ressource introuvable.');
  } catch (err) {
    return handleRouteError(err);
  }
}
