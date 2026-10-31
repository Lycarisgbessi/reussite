// ═══════════════════════════════════════════════════════════════
// HELPERS SERVEUR PARTAGÉS — routes API Réussite Magazine
// (slugify, rate limiting, réponses, pagination, sérialisation,
//  réglages site, recherche, données par défaut)
// ═══════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type {
  AdminRole, AdminUser, ArticleStatus, ArticleSummary, ArticleFull, ArticleAuthor,
  Category, ContentBlock, MenuItem, VideoItem, PodcastItem, StaticPageItem,
  CommentItem, NewsletterSubscriber, NewsletterCampaign, AdPlacement, AdCampaign,
  AdBanner, SiteSettings, FlashInfoItem, HomeBlockConfig,
} from '@/lib/types';

// ─── Erreur HTTP typée ─────────────────────────────────────────
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ─── Réponses JSON normalisées ────────────────────────────────
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

export function handleRouteError(err: unknown): NextResponse {
  // instanceof + duck-typing : en dev, le module peut être chargé en
  // double instance (HMR) et faire échouer instanceof.
  if (
    err instanceof HttpError ||
    (err instanceof Error && 'status' in err && Number((err as { status?: unknown }).status) >= 400 && Number((err as { status?: unknown }).status) < 600)
  ) {
    const e = err as HttpError;
    return jsonError(Number(e.status) || 500, e.message);
  }
  console.error('[API]', err);
  return jsonError(500, 'Une erreur interne est survenue. Veuillez réessayer.');
}

// ─── Lecture du corps JSON (tolérante) ────────────────────────
export async function readBody<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function requireFields(body: Record<string, unknown>, fields: string[]): string | null {
  for (const f of fields) {
    const v = body[f];
    if (typeof v !== 'string' || !v.trim()) return `Le champ "${f}" est obligatoire.`;
  }
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// ─── Slugification (accents FR inclus) ────────────────────────
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Trouve un slug libre via une fonction de recherche (article, page, catégorie…). */
export async function findFreeSlug(
  lookup: (slug: string) => Promise<{ id: string } | null>,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || `doc-${Date.now().toString(36)}`;
  let candidate = root;
  let i = 2;
  // Garde-fou : 50 tentatives max, suffixe horodatage en dernier recours.
  while (i < 52) {
    const found = await lookup(candidate);
    if (!found || found.id === excludeId) return candidate;
    candidate = `${root}-${i}`;
    i += 1;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// ─── Rate limiting en mémoire (max N/min par clé) ─────────────
const rateBuckets = new Map<string, number[]>();

export function rateLimit(key: string, maxPerMin = 20): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= maxPerMin) {
    rateBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  if (rateBuckets.size > 5000) {
    // Nettoyage occasionnel pour éviter une croissance infinie.
    for (const [k, v] of rateBuckets) {
      if (v.every((t) => now - t >= 60_000)) rateBuckets.delete(k);
    }
  }
  return true;
}

export function clientLimitKey(req: Request, route: string): string {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip') || 'local';
  return `${route}:${ip}`;
}

// ─── Nombres & pagination ─────────────────────────────────────
export function parseIntSafe(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

export function getPageParams(sp: URLSearchParams, defLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseIntSafe(sp.get('page'), 1));
  const limit = Math.min(maxLimit, Math.max(1, parseIntSafe(sp.get('limit'), defLimit)));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

// ─── Dates ────────────────────────────────────────────────────
export function parseDateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

// ─── JSON de secours (champs String stockant du JSON en SQLite) ─
export function parseJsonSafe<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

// ─── Contenu riche : extraction texte + temps de lecture ─────
export function textFromBlocks(blocks: ContentBlock[]): string {
  if (!Array.isArray(blocks)) return '';
  const parts: string[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    switch (b.type) {
      case 'paragraph':
      case 'heading':
      case 'quote':
      case 'callout':
        parts.push(b.text ?? '');
        break;
      case 'list':
        if (Array.isArray(b.items)) parts.push(b.items.join(' '));
        break;
      case 'image':
        parts.push([b.alt, b.caption].filter(Boolean).join(' '));
        break;
      case 'video':
        parts.push(b.title ?? '');
        break;
      default:
        break;
    }
  }
  return parts.join(' ');
}

export function estimateReadingTime(blocks: ContentBlock[]): number {
  const words = textFromBlocks(blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function contentToText(rawContent: string): string {
  const blocks = parseJsonSafe<ContentBlock[]>(rawContent, []);
  if (Array.isArray(blocks) && blocks.length > 0) return textFromBlocks(blocks);
  // Tolère un contenu stocké en texte brut (non JSON).
  return rawContent;
}

// ─── Recherche plein-texte (SQLite : filtrage JS insensible) ──
export function matchesSearch(haystacks: (string | null | undefined)[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystacks.some((h) => (h ?? '').toLowerCase().includes(needle));
}

// ─── ID YouTube ───────────────────────────────────────────────
export function extractYouTubeId(input: string): string | null {
  const s = (input || '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// SÉRIALISATION — alignée sur src/lib/types.ts
// ═══════════════════════════════════════════════════════════════

// Articles : include standard (jamais le mot de passe de l'auteur).
export const articleInclude = {
  category: true,
  author: {
    select: { id: true, name: true, bio: true, avatarUrl: true, twitter: true, linkedin: true },
  },
  tags: { include: { tag: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.ArticleInclude;

export type ArticleWithRelations = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;

/** Condition « visible publiquement » pour un article. */
export function publishedFilter(): Prisma.ArticleWhereInput {
  return {
    status: 'PUBLISHED',
    OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
  };
}

export function serializeArticleSummary(a: ArticleWithRelations): ArticleSummary {
  // Aperçu vidéo : 1re vidéo intégrée au corps de l'article (badge hero)
  const blocks = parseJsonSafe<ContentBlock[]>(a.content, []);
  const videoBlock = blocks.find((b): b is Extract<ContentBlock, { type: 'video' }> => b.type === 'video');
  return {
    videoBadge: videoBlock?.youtubeId || null,
    id: a.id,
    slug: a.slug,
    title: a.title,
    subtitle: a.subtitle,
    coverImage: a.coverImage,
    status: a.status as ArticleStatus,
    views: a.views,
    likes: a.likes,
    readingTime: a.readingTime,
    featured: a.featured,
    featuredOrder: a.featuredOrder,
    trending: a.trending,
    publishedAt: dateIso(a.publishedAt),
    category: {
      id: a.category.id,
      name: a.category.name,
      slug: a.category.slug,
      color: a.category.color,
    },
    author: { id: a.author.id, name: a.author.name, avatarUrl: a.author.avatarUrl },
    tags: a.tags.map((t) => t.tag.name),
    commentCount: a._count.comments,
  };
}

export function serializeArticleFull(a: ArticleWithRelations): ArticleFull {
  const authorFull: ArticleAuthor = {
    id: a.author.id,
    name: a.author.name,
    bio: a.author.bio,
    avatarUrl: a.author.avatarUrl,
    twitter: a.author.twitter,
    linkedin: a.author.linkedin,
  };
  return {
    ...serializeArticleSummary(a),
    excerpt: a.excerpt,
    content: parseJsonSafe<ContentBlock[]>(a.content, []),
    coverCredit: a.coverCredit,
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
    scheduledAt: dateIso(a.scheduledAt),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    authorFull,
  };
}

/** Item de liste back-office : résumé + champs de gestion. */
export function serializeAdminArticle(a: ArticleWithRelations) {
  return {
    ...serializeArticleSummary(a),
    scheduledAt: dateIso(a.scheduledAt),
    seoTitle: a.seoTitle,
    seoDescription: a.seoDescription,
  };
}

// ─── Utilisateurs (jamais de password dans les réponses) ──────
export function serializeUser(
  u: Prisma.AdminUserGetPayload<null> & { _count?: { articles: number } },
  articleCount?: number,
): AdminUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as AdminRole,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    twitter: u.twitter,
    linkedin: u.linkedin,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
    articleCount: articleCount ?? u._count?.articles,
  };
}

// ─── Catégories ───────────────────────────────────────────────
export function serializeCategory(
  c: Prisma.CategoryGetPayload<null>,
  articleCount?: number,
  children?: Category[],
): Category {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    color: c.color,
    parentId: c.parentId,
    order: c.order,
    showInMenu: c.showInMenu,
    showInHome: c.showInHome,
    articleCount,
    children,
  };
}

// ─── Médias / Vidéos / Podcasts / Pages / Menus / Commentaires ─
export function serializeMedia(m: Prisma.MediaGetPayload<null>) {
  return {
    id: m.id,
    url: m.url,
    publicId: m.publicId,
    filename: m.filename,
    alt: m.alt,
    caption: m.caption,
    credit: m.credit,
    tags: m.tags,
    type: m.type,
    createdAt: m.createdAt.toISOString(),
  };
}
export type SerializedMedia = ReturnType<typeof serializeMedia>;

export function serializeVideo(v: Prisma.VideoGetPayload<null>): VideoItem {
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    youtubeId: v.youtubeId,
    thumbnailUrl: v.thumbnailUrl,
    duration: v.duration,
    playlist: v.playlist,
    published: v.published,
    views: v.views,
    publishedAt: v.publishedAt.toISOString(),
  };
}

export function serializePodcast(p: Prisma.PodcastGetPayload<null> & { collection?: { title: string } | null }) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    audioUrl: p.audioUrl,
    duration: p.duration,
    season: p.season,
    episode: p.episode,
    collectionId: p.collectionId,
    collectionTitle: p.collection?.title ?? null,
    coverImage: p.coverImage,
    guests: p.guests,
    published: p.published,
    plays: p.plays,
    publishedAt: p.publishedAt.toISOString(),
  };
}
export type SerializedPodcast = ReturnType<typeof serializePodcast>;

export function serializePage(p: Prisma.StaticPageGetPayload<null>): StaticPageItem {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    content: p.content,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    published: p.published,
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function serializeMenuItem(m: Prisma.MenuItemGetPayload<null>): MenuItem {
  return {
    id: m.id,
    label: m.label,
    url: m.url,
    location: m.location === 'footer' ? 'footer' : 'header',
    parentId: m.parentId,
    order: m.order,
    active: m.active,
  };
}

export function serializeComment(
  c: Prisma.CommentGetPayload<{ include: { article: { select: { id: true; title: true; slug: true } } } }>,
): CommentItem {
  return {
    id: c.id,
    articleId: c.articleId,
    authorName: c.authorName,
    authorEmail: c.authorEmail,
    content: c.content,
    status: c.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    reply: c.reply,
    createdAt: c.createdAt.toISOString(),
    articleTitle: c.article.title,
    articleSlug: c.article.slug,
  };
}

// ─── Newsletter ───────────────────────────────────────────────
export function serializeSubscriber(
  s: Prisma.NewsletterSubscriberGetPayload<null>,
): NewsletterSubscriber {
  return {
    id: s.id,
    email: s.email,
    name: s.name,
    interests: s.interests,
    source: s.source,
    active: s.active,
    createdAt: s.createdAt.toISOString(),
  };
}

export function serializeCampaign(
  c: Prisma.NewsletterCampaignGetPayload<null>,
): NewsletterCampaign {
  return {
    id: c.id,
    subject: c.subject,
    intro: c.intro,
    articleIds: c.articleIds,
    status: c.status as 'DRAFT' | 'SCHEDULED' | 'SENT',
    scheduledAt: dateIso(c.scheduledAt),
    sentAt: dateIso(c.sentAt),
    recipients: c.recipients,
    openRate: c.openRate,
    clickRate: c.clickRate,
    createdAt: c.createdAt.toISOString(),
  };
}

// ─── Publicité ────────────────────────────────────────────────
export function serializePlacement(
  p: Prisma.AdPlacementGetPayload<null> & { _count?: { campaigns: number } },
  campaignCount?: number,
): AdPlacement {
  return {
    id: p.id,
    key: p.key as AdPlacement['key'],
    label: p.label,
    format: p.format,
    active: p.active,
    campaignCount: campaignCount ?? p._count?.campaigns,
  };
}

export function serializeAdCampaign(
  c: Prisma.AdCampaignGetPayload<{ include: { placement: true } }>,
): AdCampaign {
  return {
    id: c.id,
    placementId: c.placementId,
    placementKey: c.placement.key as NonNullable<AdCampaign['placementKey']>,
    name: c.name,
    advertiser: c.advertiser,
    imageUrl: c.imageUrl,
    htmlCode: c.htmlCode,
    mediaType: (['IMAGE', 'GIF', 'VIDEO'].includes(c.mediaType) ? c.mediaType : 'IMAGE') as AdCampaign['mediaType'],
    videoUrl: c.videoUrl,
    targetUrl: c.targetUrl,
    weight: c.weight,
    deviceTargeting: c.deviceTargeting as AdCampaign['deviceTargeting'],
    categoryTargeting: c.categoryTargeting,
    startDate: dateIso(c.startDate),
    endDate: dateIso(c.endDate),
    active: c.active,
    impressions: c.impressions,
    clicks: c.clicks,
    createdAt: c.createdAt.toISOString(),
  };
}

export function serializeAdBanner(c: Prisma.AdCampaignGetPayload<null>): AdBanner {
  return {
    id: c.id,
    imageUrl: c.imageUrl,
    htmlCode: c.htmlCode,
    mediaType: (['IMAGE', 'GIF', 'VIDEO'].includes(c.mediaType) ? c.mediaType : 'IMAGE') as AdBanner['mediaType'],
    videoUrl: c.videoUrl,
    targetUrl: c.targetUrl,
    advertiser: c.advertiser,
  };
}

// ─── Flash info ───────────────────────────────────────────────
export function serializeFlashInfo(f: Prisma.FlashInfoGetPayload<null>): FlashInfoItem {
  return {
    id: f.id,
    text: f.text,
    link: f.link,
    active: f.active,
    order: f.order,
  };
}

// ═══════════════════════════════════════════════════════════════
// RÉGLAGES SITE (SiteSetting key/value → objet SiteSettings typé)
// ═══════════════════════════════════════════════════════════════
export const SETTINGS_KEY_BLOCKS = 'homeBlocks';

const BOOLEAN_SETTINGS = new Set<string>([
  'commentsEnabled', 'darkModeEnabled', 'readerAccountsEnabled', 'flashInfoEnabled',
  'flashInfoAuto', 'autoFeature', 'newsletterPopupEnabled', 'adsHeaderEnabled', 'adsSidebarEnabled',
  'adsInArticleEnabled', 'adsFooterEnabled', 'adsStickyMobileEnabled', 'adsNativeEnabled',
  'adsInterstitialEnabled', 'shareButtonsAnimated',
]);
const NUMBER_SETTINGS = new Set<string>(['newsletterPopupDelay', 'newsletterPopupScroll']);

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: 'Réussite Magazine',
  tagline: 'Entrepreneuriat · Business · Innovation',
  logoText: 'Réussite Magazine',
  contactEmail: 'réussitemagazine16@gmail.com',
  contactPhone: '+224 622 85 70 35 / 625 62 30 82',
  contactAddress: '12 rue de la Bourse, 75002 Paris',
  contactHours: 'Lundi – Vendredi, 9h à 18h',
  facebook: 'https://facebook.com/reussitemagazine',
  twitter: 'https://twitter.com/reussitemagazine',
  linkedin: 'https://linkedin.com/company/reussitemagazine',
  youtube: 'https://youtube.com/@reussitemagazine',
  whatsapp: '',
  seoTitle: 'Réussite Magazine — Entrepreneuriat, Business & Innovation',
  seoDescription:
    'Le magazine digital des entrepreneurs : stratégies, financement, management, startups et intelligence artificielle.',
  ogImage: '/images/og-default.jpg',
  commentsEnabled: true,
  darkModeEnabled: true,
  shareButtonsAnimated: true,
  readerAccountsEnabled: true,
  flashInfoEnabled: true,
  flashInfoAuto: true,
  autoFeature: true,
  newsletterPopupEnabled: true,
  newsletterPopupTitle: 'Rejoignez la communauté Réussite Magazine',
  newsletterPopupText:
    'Chaque semaine, l’essentiel de l’actualité business, des analyses exclusives et des portraits d’entrepreneurs, directement dans votre boîte mail.',
  newsletterPopupTrigger: 'TIME',
  newsletterPopupDelay: 15,
  newsletterPopupScroll: 50,
  newsletterPopupFrequency: 'SESSION',
  newsletterHeroTitle: 'La newsletter des bâtisseurs d’entreprise',
  newsletterHeroText:
    'Recevez chaque mardi notre sélection d’analyses, chiffres clés et bonnes pratiques, choisie par la rédaction.',
  partnersTitle: 'Nos partenaires',
  partnersLogos: '',
  footerAbout:
    'Réussite Magazine est le média des entrepreneurs, dirigeants et innovateurs : décryptages, interviews et dossiers de fond pour comprendre et réussir.',
  adsHeaderEnabled: true,
  adsSidebarEnabled: true,
  adsInArticleEnabled: true,
  adsFooterEnabled: true,
  adsStickyMobileEnabled: true,
  adsNativeEnabled: true,
  adsInterstitialEnabled: false,
  themeColor: '#d97706',
  mastheadBackground: 'red',
};

/** Lit les réglages en base et renvoie un objet SiteSettings COMPLET (défauts inclus). */
export async function loadSettings(): Promise<SiteSettings> {
  const rows = await db.siteSetting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value] as const));
  const merged: Record<string, string | number | boolean> = { ...DEFAULT_SETTINGS };
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const raw = map.get(key);
    if (raw === undefined) continue;
    if (BOOLEAN_SETTINGS.has(key)) merged[key] = raw === 'true';
    else if (NUMBER_SETTINGS.has(key)) {
      const n = parseInt(raw, 10);
      merged[key] = Number.isNaN(n) ? def : n;
    } else {
      merged[key] = raw;
    }
  }
  // Cast sûr : toutes les clés de SiteSettings ont été recopiées ci-dessus.
  return merged as unknown as SiteSettings;
}

/** Fusionne un patch partiel en base (booléens/nombres sérialisés en strings) puis renvoie les réglages à jour. */
export async function mergeSettings(patch: Record<string, unknown>): Promise<SiteSettings> {
  const entries = Object.entries(patch).filter(([k]) => Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, k));
  for (const [key, value] of entries) {
    let stored: string;
    if (typeof value === 'boolean') stored = value ? 'true' : 'false';
    else if (typeof value === 'number') stored = String(value);
    else stored = value == null ? '' : String(value);
    await db.siteSetting.upsert({
      where: { key },
      update: { value: stored },
      create: { key, value: stored },
    });
  }
  return loadSettings();
}

// ─── Blocs page d'accueil (stockés en SiteSetting 'homeBlocks') ─

export async function loadHomeBlocks(): Promise<HomeBlockConfig[]> {
  const row = await db.siteSetting.findUnique({ where: { key: SETTINGS_KEY_BLOCKS } });
  if (!row) return buildDefaultHomeBlocks();
  const blocks = parseJsonSafe<HomeBlockConfig[]>(row.value, []);
  return Array.isArray(blocks) && blocks.length > 0 ? blocks : buildDefaultHomeBlocks();
}

/**
 * Blocs par défaut : une une + les 4 premières catégories « showInHome »
 * réellement présentes en base + vidéos + podcasts (slugs toujours valides).
 */
async function buildDefaultHomeBlocks(): Promise<HomeBlockConfig[]> {
  const cats = await db.category.findMany({
    where: { showInHome: true, parentId: null },
    orderBy: { order: 'asc' },
    take: 4,
  });
  return [
    { id: 'hb-latest', type: 'LATEST', title: 'À la une', categorySlug: '', enabled: true, order: 0 },
    ...cats.map((c, i) => ({
      id: `hb-cat-${c.slug}`,
      type: 'CATEGORY',
      title: c.name,
      categorySlug: c.slug,
      enabled: true,
      order: i + 1,
    })),
    { id: 'hb-videos', type: 'VIDEOS', title: 'Nos vidéos', categorySlug: '', enabled: true, order: cats.length + 1 },
    {
      id: 'hb-podcasts',
      type: 'PODCASTS',
      title: 'Le podcast Réussite Magazine',
      categorySlug: '',
      enabled: true,
      order: cats.length + 2,
    },
  ];
}

export async function saveHomeBlocks(blocks: HomeBlockConfig[]): Promise<HomeBlockConfig[]> {
  const normalized = blocks.map((b, i) => ({
    id: typeof b.id === 'string' && b.id ? b.id : `hb-${Date.now().toString(36)}-${i}`,
    type: String(b.type ?? 'CATEGORY'),
    title: String(b.title ?? ''),
    categorySlug: String(b.categorySlug ?? ''),
    enabled: Boolean(b.enabled),
    order: i,
  }));
  const value = JSON.stringify(normalized);
  await db.siteSetting.upsert({
    where: { key: SETTINGS_KEY_BLOCKS },
    update: { value },
    create: { key: SETTINGS_KEY_BLOCKS, value },
  });
  return normalized;
}

// ─── Emplacements publicitaires par défaut (auto-création) ────
export const DEFAULT_PLACEMENTS: { key: string; label: string; format: string }[] = [
  { key: 'HEADER_BANNER', label: 'Bannière header', format: '970x90' },
  { key: 'SIDEBAR_TOP', label: 'Sidebar haut', format: '300x250' },
  { key: 'SIDEBAR_STICKY', label: 'Sidebar sticky', format: '300x600' },
  { key: 'IN_ARTICLE', label: 'In-article', format: '728x90' },
  { key: 'NATIVE', label: 'Contenu sponsorisé (native)', format: 'native' },
  { key: 'FOOTER_BANNER', label: 'Bannière footer', format: '970x250' },
  { key: 'INTERSTITIAL', label: 'Interstitiel', format: '640x480' },
  { key: 'STICKY_MOBILE', label: 'Sticky mobile', format: '320x50' },
];

/** Crée les 8 emplacements standard s'ils sont absents (résilience si seed non exécuté). */
export async function ensureDefaultPlacements(): Promise<void> {
  const count = await db.adPlacement.count();
  if (count > 0) return;
  await db.adPlacement.createMany({
    data: DEFAULT_PLACEMENTS.map((p) => ({ key: p.key, label: p.label, format: p.format, active: true })),
  });
}

// ─── Sanitizer HTML publicitaire (anti-XSS) ───────────────────
// Retire scripts, iframes/script srcs dynamiques, handlers on* et
// URLs javascript: du code HTML fourni par les régies/rédacteurs.
export function sanitizeAdHtml(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/?>/gi, '')
    .replace(/ on[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/ on[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/ on[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '');
}
