// ═══════════════════════════════════════════════════════════════
// ROUTEUR BACK-OFFICE — /api/admin/* (toutes protégées Bearer)
// stats, analytics, audit-logs, articles (+bulk/versions),
// catégories, tags, médias, vidéos (+youtube), podcasts, pages,
// menus, modération commentaires, newsletter, régie pub,
// flash-info, page d'accueil, réglages, utilisateurs, export.
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { hashPassword, logAudit, requireAuth } from '@/lib/server/auth';
import {
  articleInclude, ensureDefaultPlacements, estimateReadingTime, extractYouTubeId, findFreeSlug,
  getPageParams, handleRouteError, HttpError, jsonError, ok, paginated, parseDateOrNull,
  parseIntSafe, publishedFilter, readBody, requireFields, serializeAdCampaign,
  serializeAdminArticle, serializeArticleFull, serializeCampaign, serializeCategory,
  serializeComment, serializeFlashInfo, serializeMedia, serializeMenuItem, serializePage,
  serializePlacement, serializePodcast, serializeSubscriber, serializeUser, serializeVideo,
  loadHomeBlocks, loadSettings, mergeSettings, saveHomeBlocks, sanitizeAdHtml,
} from '@/lib/server/utils';
import { translateEntity, TRANSLATE_LOCALES } from '@/lib/server/translate';
import { buildTranslationData } from '@/lib/server/translate';
import { broadcastPush, pushConfigured } from '@/lib/server/push';
import { autoFeatureArticle, autoFlashArticle } from '@/lib/server/autoPublish';
import type { AdminUser, HomeBlockConfig } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Contexte d'un handler ────────────────────────────────────
interface Ctx {
  req: NextRequest;
  sp: URLSearchParams;
  seg: string[];
  user: AdminUser;
}

const ARTICLE_STATUSES = ['DRAFT', 'REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'];
const COMMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
const USER_ROLES = ['ADMIN', 'EDITOR_IN_CHIEF', 'WRITER', 'COMMUNITY_MANAGER', 'AD_MANAGER'];

function validStatus(value: string): string {
  const s = value.toUpperCase();
  if (!ARTICLE_STATUSES.includes(s)) throw new HttpError(400, `Statut invalide (${ARTICLE_STATUSES.join(', ')}).`);
  return s;
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

function toNumberOr(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  return fallback;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((t) => String(t).trim())
    .filter(Boolean)
    .filter((n, i, arr) => arr.indexOf(n) === i)
    .slice(0, 20);
}

async function setArticleTags(articleId: string, tags: unknown): Promise<void> {
  const names = normalizeTags(tags);
  await db.articleTag.deleteMany({ where: { articleId } });
  for (const name of names) {
    const tag = await db.tag.upsert({ where: { name }, update: {}, create: { name } });
    await db.articleTag.create({ data: { articleId, tagId: tag.id } });
  }
}

async function fetchArticleFull(id: string) {
  const article = await db.article.findUnique({ where: { id }, include: articleInclude });
  if (!article) throw new HttpError(404, 'Article introuvable.');
  return article;
}

// ═══════════════════════════════════════════════════════════════
// ARTICLES
// ═══════════════════════════════════════════════════════════════

async function handleArticlesList(ctx: Ctx) {
  const { page, limit, skip, take } = getPageParams(ctx.sp, 20);
  const where: Prisma.ArticleWhereInput = {};
  const status = ctx.sp.get('status');
  if (status) where.status = status.toUpperCase();
  const categoryId = ctx.sp.get('categoryId');
  if (categoryId) where.categoryId = categoryId;
  const authorId = ctx.sp.get('authorId');
  if (authorId) where.authorId = authorId;
  const search = (ctx.sp.get('search') ?? '').trim();
  if (search) {
    where.OR = [{ title: { contains: search } }, { subtitle: { contains: search } }];
  }

  const [rows, total] = await Promise.all([
    db.article.findMany({
      where,
      include: articleInclude,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
    }),
    db.article.count({ where }),
  ]);

  return ok({ ...paginated(rows.map(serializeAdminArticle), total, page, limit) });
}

async function handleArticleCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const title = String(body.title ?? '').trim();
  if (!title) throw new HttpError(400, 'Le titre est obligatoire.');

  const categoryId = String(body.categoryId ?? '');
  const category = await db.category.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) throw new HttpError(400, 'Catégorie invalide.');

  const authorId = typeof body.authorId === 'string' && body.authorId ? body.authorId : ctx.user.id;
  const author = await db.adminUser.findUnique({ where: { id: authorId }, select: { id: true } });
  if (!author) throw new HttpError(400, 'Auteur invalide.');

  const content = Array.isArray(body.content) ? body.content : [];
  const contentStr = JSON.stringify(content);
  const status = validStatus(String(body.status ?? 'DRAFT'));
  const slug = await findFreeSlug(
    (s) => db.article.findUnique({ where: { slug: s }, select: { id: true } }),
    typeof body.slug === 'string' && body.slug ? body.slug : title,
  );
  const publishedAt =
    status === 'PUBLISHED' ? parseDateOrNull(body.publishedAt) ?? new Date() : parseDateOrNull(body.publishedAt);

  const created = await db.article.create({
    data: {
      slug,
      title,
      subtitle: String(body.subtitle ?? ''),
      excerpt: String(body.excerpt ?? ''),
      content: contentStr,
      coverImage: String(body.coverImage ?? ''),
      coverCredit: String(body.coverCredit ?? ''),
      status,
      categoryId,
      authorId,
      featured: toBool(body.featured),
      featuredOrder: Math.trunc(toNumberOr(body.featuredOrder, 0)),
      trending: toBool(body.trending),
      readingTime: Math.max(1, Math.trunc(toNumberOr(body.readingTime, estimateReadingTime(content)))),
      seoTitle: String(body.seoTitle ?? ''),
      seoDescription: String(body.seoDescription ?? ''),
      publishedAt,
      scheduledAt: parseDateOrNull(body.scheduledAt),
    },
  });

  await setArticleTags(created.id, body.tags);
  await db.articleVersion.create({
    data: { articleId: created.id, title, content: contentStr, savedBy: ctx.user.name },
  });
  logAudit(ctx.user.id, ctx.user.name, 'ARTICLE_CREATE', `Article « ${title} » créé`);
  // Traduction automatique à la publication (FR → EN/ES/AR/ZH)
  if (status === 'PUBLISHED') {
    await autoFeatureArticle(created.id);
    await autoFlashArticle(created.id);
    await translateEntity('article', created.id, { title, subtitle: created.subtitle, excerpt: created.excerpt, content: contentStr });
    // Notification push aux abonnés
    if (pushConfigured()) {
      await broadcastPush({
        title: 'Nouvelle publication — Réussite Magazine',
        body: title,
        url: `/#/article/${slug}`,
        tag: `article-${created.id}`,
      }).catch(() => {});
    }
  }

  return ok({ article: serializeArticleFull(await fetchArticleFull(created.id)) });
}

async function handleArticleUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.article.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Article introuvable.');

  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.ArticleUpdateInput = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) throw new HttpError(400, 'Le titre ne peut pas être vide.');
    data.title = title;
  }
  if (body.slug !== undefined && String(body.slug).trim() && String(body.slug) !== existing.slug) {
    data.slug = await findFreeSlug(
      (s) => db.article.findUnique({ where: { slug: s }, select: { id: true } }),
      String(body.slug),
      existing.id,
    );
  }
  if (body.subtitle !== undefined) data.subtitle = String(body.subtitle);
  if (body.excerpt !== undefined) data.excerpt = String(body.excerpt);
  if (body.content !== undefined) {
    data.content = JSON.stringify(Array.isArray(body.content) ? body.content : []);
  }
  if (body.coverImage !== undefined) data.coverImage = String(body.coverImage);
  if (body.coverCredit !== undefined) data.coverCredit = String(body.coverCredit);
  if (body.status !== undefined) data.status = validStatus(String(body.status));
  if (body.categoryId !== undefined) {
    const cat = await db.category.findUnique({ where: { id: String(body.categoryId) }, select: { id: true } });
    if (!cat) throw new HttpError(400, 'Catégorie invalide.');
    data.category = { connect: { id: cat.id } };
  }
  if (body.authorId !== undefined) {
    const aut = await db.adminUser.findUnique({ where: { id: String(body.authorId) }, select: { id: true } });
    if (!aut) throw new HttpError(400, 'Auteur invalide.');
    data.author = { connect: { id: aut.id } };
  }
  if (body.featured !== undefined) data.featured = toBool(body.featured);
  if (body.featuredOrder !== undefined) data.featuredOrder = Math.trunc(toNumberOr(body.featuredOrder, 0));
  if (body.trending !== undefined) data.trending = toBool(body.trending);
  if (body.readingTime !== undefined) data.readingTime = Math.max(1, Math.trunc(toNumberOr(body.readingTime, 3)));
  if (body.seoTitle !== undefined) data.seoTitle = String(body.seoTitle);
  if (body.seoDescription !== undefined) data.seoDescription = String(body.seoDescription);
  if (body.scheduledAt !== undefined) data.scheduledAt = parseDateOrNull(body.scheduledAt);
  if (body.publishedAt !== undefined) data.publishedAt = parseDateOrNull(body.publishedAt);

  const nextStatus = (data.status as string | undefined) ?? existing.status;
  const nextPublishedAt = 'publishedAt' in data ? (data.publishedAt as Date | null) : existing.publishedAt;
  if (nextStatus === 'PUBLISHED' && !nextPublishedAt) data.publishedAt = new Date();

  // Version = instantané AVANT modification.
  await db.articleVersion.create({
    data: { articleId: existing.id, title: existing.title, content: existing.content, savedBy: ctx.user.name },
  });

  await db.article.update({ where: { id: existing.id }, data });
  if (body.tags !== undefined) await setArticleTags(existing.id, body.tags);

  logAudit(ctx.user.id, ctx.user.name, 'ARTICLE_UPDATE', `Article « ${data.title ?? existing.title} » modifié`);
  // Traduction automatique à (re)publication — les corrections manuelles
  // (auto=false) ne sont jamais écrasées.
  if (nextStatus === 'PUBLISHED') {
    const fresh = await db.article.findUnique({ where: { id: existing.id } });
    if (fresh) {
      await translateEntity('article', fresh.id, {
        title: fresh.title,
        subtitle: fresh.subtitle,
        excerpt: fresh.excerpt,
        content: fresh.content,
      });
      // Notifie seulement si l'article passe en PUBLISHED lors de cette action.
      if (existing.status !== 'PUBLISHED') {
        await autoFeatureArticle(fresh.id);
        await autoFlashArticle(fresh.id);
      }
      if (existing.status !== 'PUBLISHED' && pushConfigured()) {
        await broadcastPush({
          title: 'Nouvelle publication — Réussite Magazine',
          body: fresh.title,
          url: `/#/article/${fresh.slug}`,
          tag: `article-${fresh.id}`,
        }).catch(() => {});
      }
    }
  }
  return ok({ article: serializeArticleFull(await fetchArticleFull(existing.id)) });
}

async function handleArticleDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.article.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Article introuvable.');
  await db.article.update({ where: { id }, data: { status: 'ARCHIVED' } });
  logAudit(ctx.user.id, ctx.user.name, 'ARTICLE_DELETE', `Article « ${existing.title} » archivé`);
  return ok({ ok: true });
}

async function handleArticleBulk(ctx: Ctx) {
  const body = await readBody<{ action?: string; ids?: unknown }>(ctx.req);
  const action = String(body.action ?? '').toUpperCase();
  if (!['PUBLISH', 'ARCHIVE', 'DELETE'].includes(action)) {
    throw new HttpError(400, 'Action invalide (PUBLISH, ARCHIVE ou DELETE).');
  }
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  if (ids.length === 0) throw new HttpError(400, 'Aucun article sélectionné.');

  if (action === 'DELETE') {
    await db.article.deleteMany({ where: { id: { in: ids } } });
  } else {
    const target = action === 'PUBLISH' ? 'PUBLISHED' : 'ARCHIVED';
    for (const id of ids) {
      const row = await db.article.findUnique({ where: { id }, select: { publishedAt: true } });
      if (!row) continue;
      await db.article.update({
        where: { id },
        data: {
          status: target,
          ...(target === 'PUBLISHED' && !row.publishedAt ? { publishedAt: new Date() } : {}),
        },
      });
      if (target === 'PUBLISHED') {
        await autoFeatureArticle(id);
        await autoFlashArticle(id);
      }
    }
  }
  logAudit(ctx.user.id, ctx.user.name, 'ARTICLE_BULK', `Action ${action} sur ${ids.length} article(s)`);
  return ok({ ok: true });
}

async function handleVersionsList(ctx: Ctx) {
  const articleId = ctx.seg[1];
  const versions = await db.articleVersion.findMany({
    where: { articleId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return ok({
    versions: versions.map((v) => ({
      id: v.id,
      articleId: v.articleId,
      title: v.title,
      content: v.content,
      savedBy: v.savedBy,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}

async function handleVersionRestore(ctx: Ctx) {
  const articleId = ctx.seg[1];
  const body = await readBody<{ versionId?: string }>(ctx.req);
  if (!body.versionId) throw new HttpError(400, 'Identifiant de version manquant.');
  const article = await db.article.findUnique({ where: { id: articleId } });
  if (!article) throw new HttpError(404, 'Article introuvable.');
  const version = await db.articleVersion.findFirst({ where: { id: body.versionId, articleId } });
  if (!version) throw new HttpError(404, 'Version introuvable.');

  // Instantané de l'état actuel avant restauration.
  await db.articleVersion.create({
    data: { articleId, title: article.title, content: article.content, savedBy: ctx.user.name },
  });
  await db.article.update({ where: { id: articleId }, data: { title: version.title, content: version.content } });
  logAudit(ctx.user.id, ctx.user.name, 'ARTICLE_RESTORE', `Version « ${version.title} » restaurée`);
  return ok({ article: serializeArticleFull(await fetchArticleFull(articleId)) });
}

// ═══════════════════════════════════════════════════════════════
// CATÉGORIES & TAGS
// ═══════════════════════════════════════════════════════════════

async function handleCategoriesList() {
  const [rows, counts] = await Promise.all([
    db.category.findMany({ orderBy: { order: 'asc' } }),
    db.article.groupBy({ by: ['categoryId'], _count: { categoryId: true } }),
  ]);
  const countMap = new Map(counts.map((c) => [c.categoryId, c._count.categoryId] as const));
  return ok({ categories: rows.map((c) => serializeCategory(c, countMap.get(c.id) ?? 0)) });
}

async function handleCategoryCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const name = String(body.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Le nom de la catégorie est obligatoire.');
  const slug = await findFreeSlug(
    (s) => db.category.findUnique({ where: { slug: s }, select: { id: true } }),
    typeof body.slug === 'string' && body.slug ? body.slug : name,
  );
  const created = await db.category.create({
    data: {
      name,
      slug,
      description: String(body.description ?? ''),
      imageUrl: String(body.imageUrl ?? ''),
      color: String(body.color ?? '#d97706'),
      parentId: typeof body.parentId === 'string' && body.parentId ? body.parentId : null,
      order: Math.trunc(toNumberOr(body.order, 0)),
      showInMenu: toBool(body.showInMenu, true),
      showInHome: toBool(body.showInHome),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'CATEGORY_CREATE', `Catégorie « ${name} » créée`);
  await translateEntity('category', created.id, { name: created.name, description: created.description });
  return ok({ category: serializeCategory(created) });
}

async function handleCategoryUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Catégorie introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.CategoryUpdateInput = {};
  if (body.name !== undefined) data.name = String(body.name).trim() || existing.name;
  if (body.description !== undefined) data.description = String(body.description);
  if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl);
  if (body.color !== undefined) data.color = String(body.color);
  if (body.parentId !== undefined) {
    const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null;
    if (parentId === id) throw new HttpError(400, 'Une catégorie ne peut pas être sa propre parente.');
    data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
  }
  if (body.order !== undefined) data.order = Math.trunc(toNumberOr(body.order, existing.order));
  if (body.showInMenu !== undefined) data.showInMenu = toBool(body.showInMenu, true);
  if (body.showInHome !== undefined) data.showInHome = toBool(body.showInHome);
  const updated = await db.category.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'CATEGORY_UPDATE', `Catégorie « ${updated.name} » modifiée`);
  await translateEntity('category', updated.id, { name: updated.name, description: updated.description });
  return ok({ category: serializeCategory(updated) });
}

async function handleCategoryDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Catégorie introuvable.');
  const [articleCount, childCount] = await Promise.all([
    db.article.count({ where: { categoryId: id } }),
    db.category.count({ where: { parentId: id } }),
  ]);
  if (articleCount > 0) {
    throw new HttpError(400, `Impossible de supprimer : ${articleCount} article(s) sont liés à cette catégorie.`);
  }
  if (childCount > 0) {
    throw new HttpError(400, 'Impossible de supprimer : cette catégorie contient des sous-catégories.');
  }
  await db.category.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'CATEGORY_DELETE', `Catégorie « ${existing.name} » supprimée`);
  return ok({ ok: true });
}

async function handleCategoryReorder(ctx: Ctx) {
  const body = await readBody<{ ids?: unknown }>(ctx.req);
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  await db.$transaction(ids.map((id, index) => db.category.update({ where: { id }, data: { order: index } })));
  logAudit(ctx.user.id, ctx.user.name, 'CATEGORY_REORDER', `Réordonnancement de ${ids.length} catégorie(s)`);
  return ok({ ok: true });
}

async function handleTagsList() {
  const tags = await db.tag.findMany({ orderBy: { name: 'asc' } });
  return ok({ tags: tags.map((t) => t.name) });
}

// ═══════════════════════════════════════════════════════════════
// MÉDIAS
// ═══════════════════════════════════════════════════════════════

async function handleMediaList(ctx: Ctx) {
  const { page, limit, skip, take } = getPageParams(ctx.sp, 24);
  const search = (ctx.sp.get('search') ?? '').trim();
  const where: Prisma.MediaWhereInput = search
    ? { OR: [{ filename: { contains: search } }, { alt: { contains: search } }, { tags: { contains: search } }] }
    : {};
  const [rows, total] = await Promise.all([
    db.media.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.media.count({ where }),
  ]);
  return ok({ ...paginated(rows.map(serializeMedia), total, page, limit) });
}

async function handleMediaCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const missing = requireFields(body, ['url', 'filename']);
  if (missing) throw new HttpError(400, missing);
  const created = await db.media.create({
    data: {
      url: String(body.url),
      filename: String(body.filename),
      publicId: String(body.publicId ?? ''),
      alt: String(body.alt ?? ''),
      caption: String(body.caption ?? ''),
      credit: String(body.credit ?? ''),
      tags: typeof body.tags === 'string' ? body.tags : '',
      type: String(body.type ?? 'image'),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'MEDIA_CREATE', `Média « ${created.filename} » ajouté`);
  return ok({ media: serializeMedia(created) });
}

async function handleMediaUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.media.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Média introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.MediaUpdateInput = {};
  if (body.url !== undefined) data.url = String(body.url);
  if (body.publicId !== undefined) data.publicId = String(body.publicId);
  if (body.filename !== undefined) data.filename = String(body.filename);
  if (body.alt !== undefined) data.alt = String(body.alt);
  if (body.caption !== undefined) data.caption = String(body.caption);
  if (body.credit !== undefined) data.credit = String(body.credit);
  if (body.tags !== undefined) data.tags = String(body.tags);
  if (body.type !== undefined) data.type = String(body.type);
  const updated = await db.media.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'MEDIA_UPDATE', `Média « ${updated.filename} » modifié`);
  return ok({ media: serializeMedia(updated) });
}

async function handleMediaDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.media.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Média introuvable.');
  // Supprime aussi l'image sur Cloudinary si elle en provient.
  if (existing.publicId) {
    try {
      const { destroyImage } = await import('@/lib/server/cloudinary');
      await destroyImage(existing.publicId);
    } catch {
      // Cloudinary indisponible : on supprime quand même la métadonnée.
    }
  }
  await db.media.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'MEDIA_DELETE', `Média « ${existing.filename} » supprimé`);
  return ok({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// VIDÉOS (+ métadonnées YouTube)
// ═══════════════════════════════════════════════════════════════

async function handleVideosList(ctx: Ctx) {
  const { page, limit, skip, take } = getPageParams(ctx.sp, 20);
  const where: Prisma.VideoWhereInput = {};
  const published = ctx.sp.get('published');
  if (published === 'true') where.published = true;
  if (published === 'false') where.published = false;
  const search = (ctx.sp.get('search') ?? '').trim();
  if (search) where.title = { contains: search };
  const [rows, total] = await Promise.all([
    db.video.findMany({ where, orderBy: { publishedAt: 'desc' }, skip, take }),
    db.video.count({ where }),
  ]);
  return ok({ ...paginated(rows.map(serializeVideo), total, page, limit) });
}

async function handleVideoCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const missing = requireFields(body, ['title', 'youtubeId']);
  if (missing) throw new HttpError(400, missing);
  const youtubeId = extractYouTubeId(String(body.youtubeId)) ?? String(body.youtubeId).trim();
  const created = await db.video.create({
    data: {
      title: String(body.title),
      description: String(body.description ?? ''),
      youtubeId,
      thumbnailUrl: String(body.thumbnailUrl ?? '') || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      duration: String(body.duration ?? ''),
      playlist: String(body.playlist ?? 'Général'),
      published: toBool(body.published, true),
      publishedAt: parseDateOrNull(body.publishedAt) ?? new Date(),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'VIDEO_CREATE', `Vidéo « ${created.title} » créée`);
  await translateEntity('video', created.id, { title: created.title, description: created.description });
  if (created.published && pushConfigured()) {
    await broadcastPush({
      title: 'Nouvelle vidéo — Réussite Magazine',
      body: created.title,
      url: `/#/video/${created.id}`,
      tag: `video-${created.id}`,
    }).catch(() => {});
  }
  return ok({ video: serializeVideo(created) });
}

async function handleVideoUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.video.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Vidéo introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.VideoUpdateInput = {};
  if (body.title !== undefined) data.title = String(body.title);
  if (body.description !== undefined) data.description = String(body.description);
  if (body.youtubeId !== undefined) {
    data.youtubeId = extractYouTubeId(String(body.youtubeId)) ?? String(body.youtubeId).trim();
  }
  if (body.thumbnailUrl !== undefined) data.thumbnailUrl = String(body.thumbnailUrl);
  if (body.duration !== undefined) data.duration = String(body.duration);
  if (body.playlist !== undefined) data.playlist = String(body.playlist);
  if (body.published !== undefined) data.published = toBool(body.published, true);
  if (body.publishedAt !== undefined) data.publishedAt = parseDateOrNull(body.publishedAt) ?? existing.publishedAt;
  const updated = await db.video.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'VIDEO_UPDATE', `Vidéo « ${updated.title} » modifiée`);
  await translateEntity('video', updated.id, { title: updated.title, description: updated.description });
  return ok({ video: serializeVideo(updated) });
}

/** Renomme une playlist sur toutes les vidéos concernées. */
async function handlePlaylistRename(ctx: Ctx) {
  const body = await readBody<{ from?: string; to?: string }>(ctx.req);
  const from = String(body.from ?? '').trim();
  const to = String(body.to ?? '').trim();
  if (!from || !to) throw new HttpError(400, 'Les noms de playlist (avant/après) sont obligatoires.');
  const result = await db.video.updateMany({ where: { playlist: from }, data: { playlist: to } });
  logAudit(ctx.user.id, ctx.user.name, 'PLAYLIST_RENAME', `Playlist « ${from} » → « ${to} » (${result.count} vidéo(s))`);
  return ok({ updated: result.count });
}

async function handleVideoDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.video.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Vidéo introuvable.');
  await db.video.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'VIDEO_DELETE', `Vidéo « ${existing.title} » supprimée`);
  return ok({ ok: true });
}

/** oEmbed YouTube via noembed (3,5 s max) — ne JAMAIS échouer en 500. */
async function handleYouTubeMeta(ctx: Ctx) {
  const raw = ctx.sp.get('urlOrId') ?? '';
  const id = extractYouTubeId(raw);
  if (!id) return ok({ title: '', thumbnailUrl: '', duration: '' });
  let title = '';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    if (res.ok) {
      const json = (await res.json()) as { title?: unknown };
      if (typeof json.title === 'string') title = json.title;
    }
  } catch {
    title = '';
  }
  return ok({ title, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, duration: '' });
}

// ═══════════════════════════════════════════════════════════════
// PODCASTS
// ═══════════════════════════════════════════════════════════════

async function handlePodcastsList(ctx: Ctx) {
  const { page, limit, skip, take } = getPageParams(ctx.sp, 20);
  const search = (ctx.sp.get('search') ?? '').trim();
  const where: Prisma.PodcastWhereInput = search ? { title: { contains: search } } : {};
  const [rows, total] = await Promise.all([
    db.podcast.findMany({ where, orderBy: { publishedAt: 'desc' }, skip, take }),
    db.podcast.count({ where }),
  ]);
  return ok({ ...paginated(rows.map(serializePodcast), total, page, limit) });
}

async function handlePodcastCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const missing = requireFields(body, ['title', 'audioUrl']);
  if (missing) throw new HttpError(400, missing);
  const created = await db.podcast.create({
    data: {
      title: String(body.title),
      description: String(body.description ?? ''),
      audioUrl: String(body.audioUrl),
      duration: String(body.duration ?? ''),
      season: Math.max(1, Math.trunc(toNumberOr(body.season, 1))),
      episode: Math.max(1, Math.trunc(toNumberOr(body.episode, 1))),
      collectionId:
        typeof body.collectionId === 'string' && body.collectionId ? body.collectionId : null,
      coverImage: String(body.coverImage ?? ''),
      guests: String(body.guests ?? ''),
      published: toBool(body.published, true),
      publishedAt: parseDateOrNull(body.publishedAt) ?? new Date(),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'PODCAST_CREATE', `Podcast « ${created.title} » créé`);
  await translateEntity('podcast', created.id, { title: created.title, description: created.description });
  if (created.published && pushConfigured()) {
    await broadcastPush({
      title: 'Nouvel épisode podcast — Réussite Magazine',
      body: created.title,
      url: '/#/podcasts',
      tag: `podcast-${created.id}`,
    }).catch(() => {});
  }
  return ok({ podcast: serializePodcast(created) });
}

async function handlePodcastUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.podcast.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Podcast introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.PodcastUpdateInput = {};
  if (body.title !== undefined) data.title = String(body.title);
  if (body.description !== undefined) data.description = String(body.description);
  if (body.audioUrl !== undefined) data.audioUrl = String(body.audioUrl);
  if (body.duration !== undefined) data.duration = String(body.duration);
  if (body.season !== undefined) data.season = Math.max(1, Math.trunc(toNumberOr(body.season, existing.season)));
  if (body.episode !== undefined) data.episode = Math.max(1, Math.trunc(toNumberOr(body.episode, existing.episode)));
  if (body.collectionId !== undefined) {
    const collectionId = typeof body.collectionId === 'string' && body.collectionId ? body.collectionId : null;
    if (collectionId) {
      const col = await db.podcastCollection.findUnique({ where: { id: collectionId }, select: { id: true } });
      if (!col) throw new HttpError(400, 'Collection invalide.');
      data.collection = { connect: { id: col.id } };
    } else {
      data.collection = { disconnect: true };
    }
  }
  if (body.coverImage !== undefined) data.coverImage = String(body.coverImage);
  if (body.guests !== undefined) data.guests = String(body.guests);
  if (body.published !== undefined) data.published = toBool(body.published, true);
  if (body.publishedAt !== undefined) data.publishedAt = parseDateOrNull(body.publishedAt) ?? existing.publishedAt;
  const updated = await db.podcast.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'PODCAST_UPDATE', `Podcast « ${updated.title} » modifié`);
  await translateEntity('podcast', updated.id, { title: updated.title, description: updated.description });
  return ok({ podcast: serializePodcast(updated) });
}

async function handlePodcastDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.podcast.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Podcast introuvable.');
  await db.podcast.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'PODCAST_DELETE', `Podcast « ${existing.title} » supprimé`);
  return ok({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// PAGES STATIQUES & MENUS
// ═══════════════════════════════════════════════════════════════

async function handlePagesList() {
  const rows = await db.staticPage.findMany({ orderBy: { updatedAt: 'desc' } });
  return ok({ pages: rows.map(serializePage) });
}

async function handlePageGet(ctx: Ctx) {
  const row = await db.staticPage.findUnique({ where: { id: ctx.seg[1] } });
  if (!row) throw new HttpError(404, 'Page introuvable.');
  return ok({ page: serializePage(row) });
}

async function handlePageCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const title = String(body.title ?? '').trim();
  if (!title) throw new HttpError(400, 'Le titre est obligatoire.');
  const slug = await findFreeSlug(
    (s) => db.staticPage.findUnique({ where: { slug: s }, select: { id: true } }),
    typeof body.slug === 'string' && body.slug ? body.slug : title,
  );
  const created = await db.staticPage.create({
    data: {
      slug,
      title,
      content: String(body.content ?? ''),
      seoTitle: String(body.seoTitle ?? ''),
      seoDescription: String(body.seoDescription ?? ''),
      published: toBool(body.published, true),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'PAGE_CREATE', `Page « ${created.title} » créée`);
  await translateEntity('page', created.id, { title: created.title, content: created.content });
  return ok({ page: serializePage(created) });
}

async function handlePageUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.staticPage.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Page introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.StaticPageUpdateInput = {};
  if (body.title !== undefined) data.title = String(body.title).trim() || existing.title;
  if (body.slug !== undefined && String(body.slug).trim() && String(body.slug) !== existing.slug) {
    data.slug = await findFreeSlug(
      (s) => db.staticPage.findUnique({ where: { slug: s }, select: { id: true } }),
      String(body.slug),
      existing.id,
    );
  }
  if (body.content !== undefined) data.content = String(body.content);
  if (body.seoTitle !== undefined) data.seoTitle = String(body.seoTitle);
  if (body.seoDescription !== undefined) data.seoDescription = String(body.seoDescription);
  if (body.published !== undefined) data.published = toBool(body.published, true);
  const updated = await db.staticPage.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'PAGE_UPDATE', `Page « ${updated.title} » modifiée`);
  await translateEntity('page', updated.id, { title: updated.title, content: updated.content });
  return ok({ page: serializePage(updated) });
}

async function handlePageDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.staticPage.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Page introuvable.');
  await db.staticPage.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'PAGE_DELETE', `Page « ${existing.title} » supprimée`);
  return ok({ ok: true });
}

async function handleMenusList() {
  const rows = await db.menuItem.findMany({ orderBy: [{ location: 'asc' }, { order: 'asc' }] });
  return ok({ items: rows.map(serializeMenuItem) });
}

async function handleMenuCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const missing = requireFields(body, ['label']);
  if (missing) throw new HttpError(400, missing);
  const location = body.location === 'footer' ? 'footer' : 'header';
  const maxOrder = await db.menuItem.aggregate({ where: { location }, _max: { order: true } });
  const created = await db.menuItem.create({
    data: {
      label: String(body.label),
      url: String(body.url ?? ''),
      location,
      parentId: typeof body.parentId === 'string' && body.parentId ? body.parentId : null,
      order: Math.trunc(toNumberOr(body.order, (maxOrder._max.order ?? -1) + 1)),
      active: toBool(body.active, true),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'MENU_CREATE', `Entrée de menu « ${created.label} » créée`);
  return ok({ item: serializeMenuItem(created) });
}

async function handleMenuUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.menuItem.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Entrée de menu introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.MenuItemUpdateInput = {};
  if (body.label !== undefined) data.label = String(body.label);
  if (body.url !== undefined) data.url = String(body.url);
  if (body.location !== undefined) data.location = body.location === 'footer' ? 'footer' : 'header';
  if (body.parentId !== undefined) {
    data.parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null;
  }
  if (body.order !== undefined) data.order = Math.trunc(toNumberOr(body.order, existing.order));
  if (body.active !== undefined) data.active = toBool(body.active, true);
  const updated = await db.menuItem.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'MENU_UPDATE', `Entrée de menu « ${updated.label} » modifiée`);
  return ok({ item: serializeMenuItem(updated) });
}

async function handleMenuDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.menuItem.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Entrée de menu introuvable.');
  await db.menuItem.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'MENU_DELETE', `Entrée de menu « ${existing.label} » supprimée`);
  return ok({ ok: true });
}

async function handleMenuReorder(ctx: Ctx) {
  const body = await readBody<{ ids?: unknown }>(ctx.req);
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  await db.$transaction(ids.map((id, index) => db.menuItem.update({ where: { id }, data: { order: index } })));
  logAudit(ctx.user.id, ctx.user.name, 'MENU_REORDER', `Réordonnancement de ${ids.length} entrée(s)`);
  return ok({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// MODÉRATION COMMENTAIRES
// ═══════════════════════════════════════════════════════════════

async function handleCommentsList(ctx: Ctx) {
  const { page, limit, skip, take } = getPageParams(ctx.sp, 20);
  const status = ctx.sp.get('status');
  const where: Prisma.CommentWhereInput = status ? { status: status.toUpperCase() } : {};
  const [rows, total] = await Promise.all([
    db.comment.findMany({
      where,
      include: { article: { select: { id: true, title: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    db.comment.count({ where }),
  ]);
  return ok({ ...paginated(rows.map(serializeComment), total, page, limit) });
}

async function handleCommentUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Commentaire introuvable.');
  const body = await readBody<{ status?: unknown; reply?: unknown }>(ctx.req);
  const data: Prisma.CommentUpdateInput = {};
  if (body.status !== undefined) {
    const status = String(body.status).toUpperCase();
    if (!COMMENT_STATUSES.includes(status)) throw new HttpError(400, 'Statut de modération invalide.');
    data.status = status;
  }
  if (body.reply !== undefined) data.reply = String(body.reply);
  const updated = await db.comment.update({
    where: { id },
    data,
    include: { article: { select: { id: true, title: true, slug: true } } },
  });
  logAudit(ctx.user.id, ctx.user.name, 'COMMENT_MODERATE', `Commentaire ${updated.id} → ${updated.status}`);
  return ok({ comment: serializeComment(updated) });
}

async function handleCommentDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Commentaire introuvable.');
  await db.comment.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'COMMENT_DELETE', `Commentaire ${id} supprimé`);
  return ok({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// NEWSLETTER
// ═══════════════════════════════════════════════════════════════

async function handleSubscribersList(ctx: Ctx) {
  const { page, limit, skip, take } = getPageParams(ctx.sp, 20);
  const where: Prisma.NewsletterSubscriberWhereInput = {};
  const search = (ctx.sp.get('search') ?? '').trim();
  if (search) where.OR = [{ email: { contains: search } }, { name: { contains: search } }];
  const active = ctx.sp.get('active');
  if (active === 'true') where.active = true;
  if (active === 'false') where.active = false;
  const [rows, total] = await Promise.all([
    db.newsletterSubscriber.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.newsletterSubscriber.count({ where }),
  ]);
  return ok({ ...paginated(rows.map(serializeSubscriber), total, page, limit) });
}

async function handleSubscriberUpdate(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.newsletterSubscriber.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Abonné introuvable.');
  const body = await readBody<{ active?: unknown }>(ctx.req);
  const data: Prisma.NewsletterSubscriberUpdateInput = {};
  if (body.active !== undefined) data.active = toBool(body.active, true);
  const updated = await db.newsletterSubscriber.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'SUBSCRIBER_UPDATE', `Abonné ${updated.email} modifié`);
  return ok({ subscriber: serializeSubscriber(updated) });
}

async function handleSubscriberDelete(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.newsletterSubscriber.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Abonné introuvable.');
  await db.newsletterSubscriber.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'SUBSCRIBER_DELETE', `Abonné ${existing.email} supprimé`);
  return ok({ ok: true });
}

function normalizeArticleIds(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map(String).filter(Boolean));
  if (typeof value === 'string') return value;
  return '';
}

async function handleCampaignsList() {
  const rows = await db.newsletterCampaign.findMany({ orderBy: { createdAt: 'desc' } });
  return ok({ campaigns: rows.map(serializeCampaign) });
}

async function handleCampaignCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const missing = requireFields(body, ['subject']);
  if (missing) throw new HttpError(400, missing);
  const created = await db.newsletterCampaign.create({
    data: {
      subject: String(body.subject),
      intro: String(body.intro ?? ''),
      articleIds: normalizeArticleIds(body.articleIds),
      status: body.status === 'SCHEDULED' ? 'SCHEDULED' : 'DRAFT',
      scheduledAt: parseDateOrNull(body.scheduledAt),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'CAMPAIGN_CREATE', `Campagne « ${created.subject} » créée`);
  return ok({ campaign: serializeCampaign(created) });
}

async function handleCampaignUpdate(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.newsletterCampaign.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Campagne introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.NewsletterCampaignUpdateInput = {};
  if (body.subject !== undefined) data.subject = String(body.subject);
  if (body.intro !== undefined) data.intro = String(body.intro);
  if (body.articleIds !== undefined) data.articleIds = normalizeArticleIds(body.articleIds);
  if (body.status !== undefined && ['DRAFT', 'SCHEDULED', 'SENT'].includes(String(body.status))) {
    data.status = String(body.status);
  }
  if (body.scheduledAt !== undefined) data.scheduledAt = parseDateOrNull(body.scheduledAt);
  const updated = await db.newsletterCampaign.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'CAMPAIGN_UPDATE', `Campagne « ${updated.subject} » modifiée`);
  return ok({ campaign: serializeCampaign(updated) });
}

async function handleCampaignDelete(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.newsletterCampaign.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Campagne introuvable.');
  await db.newsletterCampaign.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'CAMPAIGN_DELETE', `Campagne « ${existing.subject} » supprimée`);
  return ok({ ok: true });
}

async function handleCampaignSend(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.newsletterCampaign.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Campagne introuvable.');
  if (existing.status === 'SENT') throw new HttpError(400, 'Cette campagne a déjà été envoyée.');

  const subscribers = await db.newsletterSubscriber.findMany({
    where: { active: true },
    select: { email: true },
  });
  const recipients = subscribers.length;

  // ─── Envoi RÉEL via Resend si configuré, sinon simulation ───
  let sent = false;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && recipients > 0) {
    const ids = JSON.parse(existing.articleIds || '[]') as string[];
    const articles = ids.length
      ? await db.article.findMany({ where: { id: { in: ids } }, select: { title: true, slug: true, subtitle: true } })
      : [];
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const itemsHtml = articles
      .map(
        (a) =>
          `<li style="margin:0 0 14px"><a href="${baseUrl}/#/article/${a.slug}" style="color:#d97706;font-weight:700;text-decoration:none">${a.title}</a>` +
          (a.subtitle ? `<p style="margin:4px 0 0;color:#555;font-size:14px">${a.subtitle}</p>` : '') +
          '</li>',
      )
      .join('');
    const html = `<div style="font-family:Georgia,serif;max-width:600px;margin:auto">
  <h2 style="color:#0a0a0a">${existing.subject}</h2>
  ${existing.intro ? `<p style="color:#444">${existing.intro}</p>` : ''}
  <ul style="list-style:none;padding:0">${itemsHtml}</ul>
  <p style="margin-top:28px;font-size:12px;color:#999">Réussite Magazine — <a href="${baseUrl}" style="color:#d97706">reussitemagazine.com</a></p>
</div>`;
    try {
      // Resend : envoi par lots de 50 destinataires (bcc).
      for (let i = 0; i < recipients; i += 50) {
        const batch = subscribers.slice(i, i + 50).map((s) => s.email);
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.NEWSLETTER_FROM || 'Réussite Magazine <newsletter@resend.dev>',
            to: [process.env.NEWSLETTER_FROM || 'newsletter@resend.dev'],
            bcc: batch,
            subject: existing.subject,
            html,
          }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}`);
      }
      sent = true;
    } catch (e) {
      logAudit(ctx.user.id, ctx.user.name, 'CAMPAIGN_SEND_FAIL', e instanceof Error ? e.message : 'Erreur Resend');
      throw new HttpError(502, `Envoi email impossible (${e instanceof Error ? e.message : 'erreur Resend'}).`);
    }
  }

  const updated = await db.newsletterCampaign.update({
    where: { id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      recipients,
      // Taux réels mesurés plus tard (pixels de tracking) — repli simulé
      // uniquement quand l'envoi réel n'est pas configuré.
      openRate: sent ? 0 : 0.42,
      clickRate: sent ? 0 : 0.12,
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'CAMPAIGN_SEND', `Campagne « ${updated.subject} » ${sent ? 'envoyée réellement' : 'simulée (RESEND_API_KEY absent)'} à ${recipients} abonné(s)`);
  return ok({ campaign: serializeCampaign(updated), realSend: sent });
}

// ═══════════════════════════════════════════════════════════════
// RÉGIE PUBLICITAIRE
// ═══════════════════════════════════════════════════════════════

async function handlePlacementsList() {
  await ensureDefaultPlacements();
  const rows = await db.adPlacement.findMany({
    include: { _count: { select: { campaigns: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return ok({ placements: rows.map((p) => serializePlacement(p)) });
}

async function handlePlacementUpdate(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.adPlacement.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Emplacement introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.AdPlacementUpdateInput = {};
  if (body.label !== undefined) data.label = String(body.label);
  if (body.format !== undefined) data.format = String(body.format);
  if (body.active !== undefined) data.active = toBool(body.active, true);
  const updated = await db.adPlacement.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'AD_PLACEMENT_UPDATE', `Emplacement « ${updated.key} » modifié`);
  return ok({ placement: serializePlacement(updated) });
}

async function handleAdCampaignsList(ctx: Ctx) {
  const where: Prisma.AdCampaignWhereInput = {};
  const placementId = ctx.sp.get('placementId');
  if (placementId) where.placementId = placementId;
  const active = ctx.sp.get('active');
  if (active === 'true') where.active = true;
  if (active === 'false') where.active = false;
  const rows = await db.adCampaign.findMany({
    where,
    include: { placement: true },
    orderBy: { createdAt: 'desc' },
  });
  return ok({ campaigns: rows.map(serializeAdCampaign) });
}

async function handleAdCampaignCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const missing = requireFields(body, ['name', 'advertiser', 'placementId']);
  if (missing) throw new HttpError(400, missing);
  const placement = await db.adPlacement.findUnique({ where: { id: String(body.placementId) } });
  if (!placement) throw new HttpError(400, 'Emplacement publicitaire invalide.');
  const created = await db.adCampaign.create({
    data: {
      placementId: placement.id,
      name: String(body.name),
      advertiser: String(body.advertiser),
      imageUrl: String(body.imageUrl ?? ''),
      htmlCode: sanitizeAdHtml(String(body.htmlCode ?? '')),
      mediaType: ['IMAGE', 'GIF', 'VIDEO'].includes(String(body.mediaType)) ? String(body.mediaType) : 'IMAGE',
      videoUrl: String(body.videoUrl ?? ''),
      targetUrl: String(body.targetUrl ?? ''),
      weight: Math.max(1, Math.trunc(toNumberOr(body.weight, 1))),
      deviceTargeting: ['ALL', 'MOBILE', 'DESKTOP'].includes(String(body.deviceTargeting))
        ? String(body.deviceTargeting)
        : 'ALL',
      categoryTargeting: String(body.categoryTargeting ?? ''),
      startDate: parseDateOrNull(body.startDate),
      endDate: parseDateOrNull(body.endDate),
      active: toBool(body.active, true),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'AD_CAMPAIGN_CREATE', `Campagne « ${created.name} » créée`);
  const full = await db.adCampaign.findUnique({ where: { id: created.id }, include: { placement: true } });
  return ok({ campaign: full ? serializeAdCampaign(full) : serializeAdCampaign({ ...created, placement }) });
}

async function handleAdCampaignUpdate(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.adCampaign.findUnique({ where: { id }, include: { placement: true } });
  if (!existing) throw new HttpError(404, 'Campagne introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.AdCampaignUpdateInput = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.advertiser !== undefined) data.advertiser = String(body.advertiser);
  if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl);
  if (body.htmlCode !== undefined) data.htmlCode = sanitizeAdHtml(String(body.htmlCode));
  if (body.mediaType !== undefined && ['IMAGE', 'GIF', 'VIDEO'].includes(String(body.mediaType))) {
    data.mediaType = String(body.mediaType);
  }
  if (body.videoUrl !== undefined) data.videoUrl = String(body.videoUrl);
  if (body.targetUrl !== undefined) data.targetUrl = String(body.targetUrl);
  if (body.weight !== undefined) data.weight = Math.max(1, Math.trunc(toNumberOr(body.weight, existing.weight)));
  if (body.deviceTargeting !== undefined && ['ALL', 'MOBILE', 'DESKTOP'].includes(String(body.deviceTargeting))) {
    data.deviceTargeting = String(body.deviceTargeting);
  }
  if (body.categoryTargeting !== undefined) data.categoryTargeting = String(body.categoryTargeting);
  if (body.startDate !== undefined) data.startDate = parseDateOrNull(body.startDate);
  if (body.endDate !== undefined) data.endDate = parseDateOrNull(body.endDate);
  if (body.active !== undefined) data.active = toBool(body.active, true);
  const updated = await db.adCampaign.update({ where: { id }, data, include: { placement: true } });
  logAudit(ctx.user.id, ctx.user.name, 'AD_CAMPAIGN_UPDATE', `Campagne « ${updated.name} » modifiée`);
  return ok({ campaign: serializeAdCampaign(updated) });
}

async function handleAdCampaignDelete(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.adCampaign.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Campagne introuvable.');
  await db.adCampaign.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'AD_CAMPAIGN_DELETE', `Campagne « ${existing.name} » supprimée`);
  return ok({ ok: true });
}

async function handleAdStats() {
  const rows = await db.adCampaign.findMany({ include: { placement: true }, orderBy: { createdAt: 'desc' } });
  const stats = rows.map((c) => ({
    campaignId: c.id,
    name: c.name,
    advertiser: c.advertiser,
    placementLabel: c.placement.label,
    impressions: c.impressions,
    clicks: c.clicks,
    ctr: c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 10000 : 0,
  }));
  return ok({ stats });
}

// ═══════════════════════════════════════════════════════════════
// FLASH INFO
// ═══════════════════════════════════════════════════════════════

async function handleFlashList() {
  const rows = await db.flashInfo.findMany({ orderBy: { order: 'asc' } });
  return ok({ items: rows.map(serializeFlashInfo) });
}

async function handleFlashCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const missing = requireFields(body, ['text']);
  if (missing) throw new HttpError(400, missing);
  const maxOrder = await db.flashInfo.aggregate({ _max: { order: true } });
  const created = await db.flashInfo.create({
    data: {
      text: String(body.text),
      link: String(body.link ?? ''),
      active: toBool(body.active, true),
      order: Math.trunc(toNumberOr(body.order, (maxOrder._max.order ?? -1) + 1)),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'FLASH_CREATE', 'Flash info créé');
  await translateEntity('flashInfo', created.id, { text: created.text });
  return ok({ item: serializeFlashInfo(created) });
}

async function handleFlashUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.flashInfo.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Flash info introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.FlashInfoUpdateInput = {};
  if (body.text !== undefined) data.text = String(body.text);
  if (body.link !== undefined) data.link = String(body.link);
  if (body.active !== undefined) data.active = toBool(body.active, true);
  if (body.order !== undefined) data.order = Math.trunc(toNumberOr(body.order, existing.order));
  const updated = await db.flashInfo.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'FLASH_UPDATE', `Flash info modifié`);
  await translateEntity('flashInfo', updated.id, { text: updated.text });
  return ok({ item: serializeFlashInfo(updated) });
}

async function handleFlashDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.flashInfo.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Flash info introuvable.');
  await db.flashInfo.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'FLASH_DELETE', 'Flash info supprimé');
  return ok({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// PAGE D'ACCUEIL (blocs + mise en avant)
// ═══════════════════════════════════════════════════════════════

async function handleHomeBlocksGet() {
  return ok({ blocks: await loadHomeBlocks() });
}

async function handleHomeBlocksPut(ctx: Ctx) {
  const body = await readBody<{ blocks?: unknown }>(ctx.req);
  if (!Array.isArray(body.blocks)) throw new HttpError(400, 'Liste de blocs invalide.');
  const blocks = await saveHomeBlocks(body.blocks as HomeBlockConfig[]);
  logAudit(ctx.user.id, ctx.user.name, 'HOMEPAGE_BLOCKS', `${blocks.length} bloc(s) enregistré(s)`);
  return ok({ blocks });
}

async function handleFeaturedPut(ctx: Ctx) {
  const body = await readBody<{ articleIds?: unknown }>(ctx.req);
  const ids = Array.isArray(body.articleIds) ? body.articleIds.map(String).filter(Boolean) : [];
  await db.$transaction([
    db.article.updateMany({ data: { featured: false, featuredOrder: 0 } }),
    ...ids.map((id, index) =>
      db.article.update({ where: { id }, data: { featured: true, featuredOrder: index } }),
    ),
  ]);
  logAudit(ctx.user.id, ctx.user.name, 'HOMEPAGE_FEATURED', `${ids.length} article(s) à la une`);
  return ok({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// RÉGLAGES
// ═══════════════════════════════════════════════════════════════

async function handleSettingsGet() {
  return ok({ settings: await loadSettings() });
}

async function handleSettingsPut(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const settings = await mergeSettings(body);
  // Traduit les textes éditoriaux modifiés (popup, blocs accueil).
  await translateEntity('setting', 'site', settings as unknown as Record<string, unknown>).catch(() => {});
  logAudit(ctx.user.id, ctx.user.name, 'SETTINGS_UPDATE', `${Object.keys(body).length} réglage(s) modifié(s)`);
  return ok({ settings });
}

// ═══════════════════════════════════════════════════════════════
// UTILISATEURS
// ═══════════════════════════════════════════════════════════════

async function handleUsersList() {
  const rows = await db.adminUser.findMany({
    include: { _count: { select: { articles: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return ok({ users: rows.map((u) => serializeUser(u)) });
}

async function handleUserCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const missing = requireFields(body, ['email', 'name', 'password', 'role']);
  if (missing) throw new HttpError(400, missing);
  const email = String(body.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Adresse email invalide.');
  const role = String(body.role).toUpperCase();
  if (!USER_ROLES.includes(role)) throw new HttpError(400, `Rôle invalide (${USER_ROLES.join(', ')}).`);
  const password = String(body.password);
  if (password.length < 6) throw new HttpError(400, 'Le mot de passe doit contenir au moins 6 caractères.');
  const exists = await db.adminUser.findUnique({ where: { email } });
  if (exists) throw new HttpError(400, 'Cet email est déjà utilisé.');

  const created = await db.adminUser.create({
    data: {
      email,
      name: String(body.name).trim(),
      password: hashPassword(password),
      role,
      bio: String(body.bio ?? ''),
      avatarUrl: String(body.avatarUrl ?? ''),
      twitter: String(body.twitter ?? ''),
      linkedin: String(body.linkedin ?? ''),
      active: toBool(body.active, true),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'USER_CREATE', `Utilisateur « ${created.name} » créé`);
  return ok({ user: serializeUser(created) });
}

async function handleUserUpdate(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.adminUser.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Utilisateur introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.AdminUserUpdateInput = {};

  if (body.name !== undefined) data.name = String(body.name).trim() || existing.name;
  if (body.bio !== undefined) data.bio = String(body.bio);
  if (body.avatarUrl !== undefined) data.avatarUrl = String(body.avatarUrl);
  if (body.twitter !== undefined) data.twitter = String(body.twitter);
  if (body.linkedin !== undefined) data.linkedin = String(body.linkedin);
  if (body.active !== undefined) data.active = toBool(body.active, true);
  if (body.role !== undefined) {
    const role = String(body.role).toUpperCase();
    if (!USER_ROLES.includes(role)) throw new HttpError(400, `Rôle invalide (${USER_ROLES.join(', ')}).`);
    // Empêche le retrait de son propre rôle ADMIN si l'on est le dernier admin.
    if (id === ctx.user.id && existing.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await db.adminUser.count({ where: { role: 'ADMIN', active: true } });
      if (adminCount <= 1) {
        throw new HttpError(400, 'Impossible de retirer votre rôle ADMIN : vous êtes le dernier administrateur.');
      }
    }
    data.role = role;
  }
  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < 6) throw new HttpError(400, 'Le mot de passe doit contenir au moins 6 caractères.');
    data.password = hashPassword(body.password);
  }

  const updated = await db.adminUser.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'USER_UPDATE', `Utilisateur « ${updated.name} » modifié`);
  return ok({ user: serializeUser(updated) });
}

async function handleUserDelete(ctx: Ctx) {
  const id = ctx.seg[1];
  const existing = await db.adminUser.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Utilisateur introuvable.');
  if (id === ctx.user.id) throw new HttpError(400, 'Vous ne pouvez pas supprimer votre propre compte.');
  if (existing.role === 'ADMIN') {
    const adminCount = await db.adminUser.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) throw new HttpError(400, 'Impossible de supprimer le dernier administrateur.');
  }
  // Réaffecte les articles à l'administrateur courant pour préserver l'intégrité.
  await db.article.updateMany({ where: { authorId: id }, data: { authorId: ctx.user.id } });
  await db.adminUser.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'USER_DELETE', `Utilisateur « ${existing.name} » supprimé`);
  return ok({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// STATISTIQUES / ANALYTICS
// ═══════════════════════════════════════════════════════════════

async function buildChart(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const events = await db.analyticsEvent.findMany({
    where: { type: { in: ['PAGE_VIEW', 'ARTICLE_VIEW'] }, createdAt: { gte: start } },
    select: { type: true, createdAt: true },
  });
  const buckets = new Map<string, { views: number; visits: number }>();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { views: 0, visits: 0 });
  }
  for (const e of events) {
    const bucket = buckets.get(e.createdAt.toISOString().slice(0, 10));
    if (!bucket) continue;
    if (e.type === 'ARTICLE_VIEW') bucket.views += 1;
    else bucket.visits += 1;
  }
  return [...buckets.entries()].map(([date, v]) => ({ date, views: v.views, visits: v.visits }));
}

async function buildStats(days: number) {
  const window = Math.min(90, Math.max(1, days));
  const now = new Date();
  const start30 = new Date(now);
  start30.setDate(now.getDate() - 30);
  const start7 = new Date(now);
  start7.setDate(now.getDate() - 7);

  const [
    visits30d, visits7d, articlesPublished, articlesDraft, commentsPending,
    newsletterSubscribers, newsletterActive, videos, podcasts, adsActive,
    campaigns, totalViewsAgg, chart, topRows, trafficRows, visitMetaRows,
  ] = await Promise.all([
    db.analyticsEvent.count({ where: { type: 'PAGE_VIEW', createdAt: { gte: start30 } } }),
    db.analyticsEvent.count({ where: { type: 'PAGE_VIEW', createdAt: { gte: start7 } } }),
    db.article.count({ where: { status: 'PUBLISHED' } }),
    db.article.count({ where: { status: 'DRAFT' } }),
    db.comment.count({ where: { status: 'PENDING' } }),
    db.newsletterSubscriber.count(),
    db.newsletterSubscriber.count({ where: { active: true } }),
    db.video.count(),
    db.podcast.count(),
    db.adCampaign.count({ where: { active: true } }),
    db.adCampaign.findMany({ include: { placement: true } }),
    db.article.aggregate({ _sum: { views: true } }),
    buildChart(window),
    db.article.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { views: 'desc' },
      take: 8,
      include: { category: { select: { name: true } } },
    }),
    db.analyticsEvent.groupBy({ by: ['type'], _count: { type: true }, where: { createdAt: { gte: start30 } } }),
    // Méta des visites (referrer/appareil/langue réels enregistrés côté client)
    db.analyticsEvent.findMany({
      where: { type: 'PAGE_VIEW', createdAt: { gte: start30 } },
      select: { meta: true },
      take: 20000,
    }),
  ]);

  const impressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const clicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);

  return ok({
    overview: {
      visits30d,
      visits7d,
      articlesPublished,
      articlesDraft,
      commentsPending,
      newsletterSubscribers,
      newsletterActive,
      adImpressions30d: impressions,
      adClicks30d: clicks,
      adCtr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 10000 : 0,
      totalViews: totalViewsAgg._sum.views ?? 0,
      videos,
      podcasts,
      adsActive,
    },
    chart,
    topArticles: topRows.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      views: a.views,
      categoryName: a.category.name,
    })),
    adStats: campaigns.map((c) => ({
      campaignId: c.id,
      name: c.name,
      advertiser: c.advertiser,
      placementLabel: c.placement.label,
      impressions: c.impressions,
      clicks: c.clicks,
      ctr: c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 10000) / 10000 : 0,
    })),
    // ─── Sources de trafic RÉELLES (referrer enregistré par le navigateur) ───
    trafficSources: buildRealSources(visitMetaRows),
    devices: buildDeviceSplit(visitMetaRows),
  });
}

/** Classe un referrer en source lisible. */
function classifyReferrer(referrer: string | undefined): string {
  if (!referrer) return 'Direct';
  let host = '';
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'Direct';
  }
  if (/^(google|bing|duckduckgo|qwant|ecosia|yahoo|baidu)\./i.test(host)) return 'Moteurs de recherche';
  if (/^(facebook|instagram|m\.facebook|l\.facebook)\./i.test(host)) return 'Facebook / Instagram';
  if (/^(x|twitter|t)\./i.test(host)) return 'X (Twitter)';
  if (/^(linkedin)\./i.test(host)) return 'LinkedIn';
  if (/^(youtube|youtu)\./i.test(host)) return 'YouTube';
  if (/^(whatsapp|t\.me|telegram)\./i.test(host)) return 'Messageries';
  if (/(reussitemagazine|localhost)/i.test(host)) return 'Interne';
  return host;
}

/** Agrège les referrers en sources (top 6 + autres). */
function buildRealSources(rows: { meta: string }[]): { source: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(r.meta || '{}');
    } catch {
      meta = {};
    }
    const source = classifyReferrer(
      typeof meta.referrer === 'string' ? meta.referrer : undefined,
    );
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  const sorted = [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
  if (sorted.length <= 7) return sorted;
  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6).reduce((sum, x) => sum + x.count, 0);
  return [...top, { source: 'Autres', count: rest }];
}

/** Répartition appareils (meta.device enregistré côté client). */
function buildDeviceSplit(rows: { meta: string }[]): { device: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(r.meta || '{}');
    } catch {
      meta = {};
    }
    const device = meta.device === 'mobile' || meta.device === 'desktop' || meta.device === 'tablet'
      ? String(meta.device)
      : 'inconnu';
    counts.set(device, (counts.get(device) ?? 0) + 1);
  }
  return [...counts.entries()].map(([device, count]) => ({ device, count }));
}

async function handleAuditLogs(ctx: Ctx) {
  const { page, limit, skip, take } = getPageParams(ctx.sp, 20);
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
    db.auditLog.count(),
  ]);
  return ok({
    ...paginated(
      rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.userName,
        action: r.action,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    ),
  });
}

// ═══════════════════════════════════════════════════════════════
// EXPORT (JSON / CSV)
// ═══════════════════════════════════════════════════════════════

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(';'), ...rows.map((r) => r.map(csvCell).join(';'))];
  return `\ufeff${lines.join('\r\n')}`;
}

async function handleExport(ctx: Ctx) {
  const type = (ctx.sp.get('type') ?? 'articles').toLowerCase();
  const format = (ctx.sp.get('format') ?? 'json').toLowerCase();

  if (type === 'articles') {
    const rows = await db.article.findMany({
      include: { category: { select: { name: true } }, author: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const data = rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      status: a.status,
      category: a.category.name,
      author: a.author.name,
      publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
      views: a.views,
    }));
    if (format === 'csv') {
      return ok({
        data: toCsv(
          ['ID', 'Slug', 'Titre', 'Statut', 'Catégorie', 'Auteur', 'Date de publication', 'Vues'],
          data.map((a) => [a.id, a.slug, a.title, a.status, a.category, a.author, a.publishedAt ?? '', a.views]),
        ),
      });
    }
    return ok({ data: JSON.stringify(data, null, 2) });
  }

  if (type === 'subscribers') {
    const rows = await db.newsletterSubscriber.findMany({ orderBy: { createdAt: 'desc' } });
    const data = rows.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name,
      interests: s.interests,
      source: s.source,
      active: s.active,
      createdAt: s.createdAt.toISOString(),
    }));
    if (format === 'csv') {
      return ok({
        data: toCsv(
          ['ID', 'Email', 'Nom', 'Intérêts', 'Source', 'Actif', "Date d'inscription"],
          data.map((s) => [s.id, s.email, s.name, s.interests, s.source, s.active ? 'oui' : 'non', s.createdAt]),
        ),
      });
    }
    return ok({ data: JSON.stringify(data, null, 2) });
  }

  if (type === 'comments') {
    const rows = await db.comment.findMany({
      include: { article: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const data = rows.map((c) => ({
      id: c.id,
      articleTitle: c.article.title,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      content: c.content,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
    }));
    if (format === 'csv') {
      return ok({
        data: toCsv(
          ['ID', 'Article', 'Auteur', 'Email', 'Contenu', 'Statut', 'Date'],
          data.map((c) => [c.id, c.articleTitle, c.authorName, c.authorEmail, c.content, c.status, c.createdAt]),
        ),
      });
    }
    return ok({ data: JSON.stringify(data, null, 2) });
  }

  throw new HttpError(400, 'Type d\'export invalide (articles, subscribers ou comments).');
}

// ═══════════════════════════════════════════════════════════════
// COLLECTIONS DE PODCASTS (saisons renommables, mère/fille)
// ═══════════════════════════════════════════════════════════════

async function handlePodcastCollectionsList() {
  const rows = await db.podcastCollection.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { podcasts: true } } },
  });
  const byParent = new Map<string | null, typeof rows>();
  for (const c of rows) {
    const key = c.parentId;
    const list = byParent.get(key) ?? [];
    list.push(c);
    byParent.set(key, list);
  }
  type Node = {
    id: string; title: string; description: string; parentId: string | null;
    order: number; podcastCount: number; children: Node[];
  };
  const build = (parent: string | null): Node[] =>
    (byParent.get(parent) ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      parentId: c.parentId,
      order: c.order,
      podcastCount: c._count.podcasts,
      children: build(c.id),
    }));
  return ok({ collections: build(null) });
}

async function handlePodcastCollectionCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const title = String(body.title ?? '').trim();
  if (!title) throw new HttpError(400, 'Le titre de la collection est obligatoire.');
  const maxOrder = await db.podcastCollection.aggregate({ _max: { order: true } });
  const created = await db.podcastCollection.create({
    data: {
      title,
      description: String(body.description ?? ''),
      parentId:
        typeof body.parentId === 'string' && body.parentId ? body.parentId : null,
      order: Math.trunc(toNumberOr(body.order, (maxOrder._max.order ?? -1) + 1)),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'PODCAST_COLLECTION_CREATE', `Collection « ${created.title} » créée`);
  return ok({ collection: { ...created, children: [], podcastCount: 0 } });
}

async function handlePodcastCollectionUpdate(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.podcastCollection.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Collection introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.PodcastCollectionUpdateInput = {};
  if (body.title !== undefined) data.title = String(body.title).trim() || existing.title;
  if (body.description !== undefined) data.description = String(body.description);
  if (body.order !== undefined) data.order = Math.trunc(toNumberOr(body.order, existing.order));
  if (body.parentId !== undefined) {
    const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null;
    if (parentId === id) throw new HttpError(400, 'Une collection ne peut pas être sa propre parente.');
    data.parent = parentId ? { connect: { id: parentId } } : { disconnect: true };
  }
  const updated = await db.podcastCollection.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'PODCAST_COLLECTION_UPDATE', `Collection « ${updated.title} » modifiée`);
  return ok({ collection: updated });
}

async function handlePodcastCollectionDelete(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.podcastCollection.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Collection introuvable.');
  const childCount = await db.podcastCollection.count({ where: { parentId: id } });
  if (childCount > 0) throw new HttpError(400, 'Supprimez ou déplacez d’abord les sous-collections.');
  // Les épisodes sont détachés (collectionId → null), jamais supprimés.
  await db.podcast.updateMany({ where: { collectionId: id }, data: { collectionId: null } });
  await db.podcastCollection.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'PODCAST_COLLECTION_DELETE', `Collection « ${existing.title} » supprimée`);
  return ok({ ok: true });
}

async function handlePodcastCollectionReorder(ctx: Ctx) {
  const body = await readBody<{ ids?: unknown }>(ctx.req);
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
  await db.$transaction(ids.map((id, index) => db.podcastCollection.update({ where: { id }, data: { order: index } })));
  return ok({ ok: true });
}


// ═══════════════════════════════════════════════════════════════
// BOUTIQUE (numéros, formules d'abonnement, commandes)
// ═══════════════════════════════════════════════════════════════

async function handleShopIssuesList() {
  const rows = await db.magazineIssue.findMany({ orderBy: { releaseDate: 'desc' } });
  const orderCounts = await db.order.groupBy({ by: ['issueId'], _count: { id: true }, where: { type: 'SINGLE', status: 'PAID' } });
  const countMap = new Map(orderCounts.map((o) => [o.issueId ?? '', o._count.id]));
  return ok({
    issues: rows.map((i) => ({ ...i, previewImages: JSON.parse(i.previewImages || '[]'), paidOrders: countMap.get(i.id) ?? 0 })),
  });
}

async function handleShopIssueCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const title = String(body.title ?? '').trim();
  if (!title) throw new HttpError(400, 'Le titre du numéro est obligatoire.');
  const slug = await findFreeSlug(
    (sl) => db.magazineIssue.findUnique({ where: { slug: sl }, select: { id: true } }),
    typeof body.slug === 'string' && body.slug ? body.slug : title,
  );
  const created = await db.magazineIssue.create({
    data: {
      slug,
      title,
      issueNumber: Math.max(1, Math.trunc(toNumberOr(body.issueNumber, 1))),
      description: String(body.description ?? ''),
      coverUrl: String(body.coverUrl ?? ''),
      previewImages: JSON.stringify(Array.isArray(body.previewImages) ? body.previewImages.map(String) : []),
      priceCfa: Math.max(0, Math.trunc(toNumberOr(body.priceCfa, 5000))),
      priceEur: Math.max(0, Math.trunc(toNumberOr(body.priceEur, 8))),
      pricePrintCfa: Math.max(0, Math.trunc(toNumberOr(body.pricePrintCfa, 30000))),
      pricePrintEur: Math.max(0, Math.trunc(toNumberOr(body.pricePrintEur, 3))),
      pdfUrl: String(body.pdfUrl ?? ''),
      previewPages: Math.min(50, Math.max(0, Math.trunc(toNumberOr(body.previewPages, 5)))),
      featured: toBool(body.featured),
      published: toBool(body.published, true),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'SHOP_ISSUE_CREATE', `Numéro « ${created.title} » créé`);
  return ok({ issue: created });
}

async function handleShopIssueUpdate(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.magazineIssue.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Numéro introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.MagazineIssueUpdateInput = {};
  if (body.title !== undefined) data.title = String(body.title).trim() || existing.title;
  if (body.description !== undefined) data.description = String(body.description);
  if (body.coverUrl !== undefined) data.coverUrl = String(body.coverUrl);
  if (body.previewImages !== undefined) data.previewImages = JSON.stringify(Array.isArray(body.previewImages) ? body.previewImages.map(String) : []);
  if (body.priceCfa !== undefined) data.priceCfa = Math.max(0, Math.trunc(toNumberOr(body.priceCfa, existing.priceCfa)));
  if (body.priceEur !== undefined) data.priceEur = Math.max(0, Math.trunc(toNumberOr(body.priceEur, existing.priceEur)));
  if (body.pricePrintCfa !== undefined) data.pricePrintCfa = Math.max(0, Math.trunc(toNumberOr(body.pricePrintCfa, existing.pricePrintCfa)));
  if (body.pricePrintEur !== undefined) data.pricePrintEur = Math.max(0, Math.trunc(toNumberOr(body.pricePrintEur, existing.pricePrintEur)));
  if (body.pdfUrl !== undefined) data.pdfUrl = String(body.pdfUrl);
  if (body.previewPages !== undefined) data.previewPages = Math.min(50, Math.max(0, Math.trunc(toNumberOr(body.previewPages, existing.previewPages))));
  if (body.issueNumber !== undefined) data.issueNumber = Math.max(1, Math.trunc(toNumberOr(body.issueNumber, existing.issueNumber)));
  if (body.featured !== undefined) data.featured = toBool(body.featured);
  if (body.published !== undefined) data.published = toBool(body.published, true);
  const updated = await db.magazineIssue.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'SHOP_ISSUE_UPDATE', `Numéro « ${updated.title} » modifié`);
  return ok({ issue: updated });
}

async function handleShopIssueDelete(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.magazineIssue.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Numéro introuvable.');
  await db.magazineIssue.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'SHOP_ISSUE_DELETE', `Numéro « ${existing.title} » supprimé`);
  return ok({ ok: true });
}

async function handleShopPlansList() {
  const rows = await db.subscriptionPlan.findMany({ orderBy: { priceCfa: 'asc' } });
  return ok({ plans: rows.map((p) => ({ ...p, perks: JSON.parse(p.perks || '[]') })) });
}

async function handleShopPlanCreate(ctx: Ctx) {
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const name = String(body.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Le nom de la formule est obligatoire.');
  const created = await db.subscriptionPlan.create({
    data: {
      name,
      description: String(body.description ?? ''),
      durationMonths: Math.max(1, Math.trunc(toNumberOr(body.durationMonths, 12))),
      issuesCount: Math.max(1, Math.trunc(toNumberOr(body.issuesCount, 4))),
      priceCfa: Math.max(0, Math.trunc(toNumberOr(body.priceCfa, 15000))),
      priceEur: Math.max(0, Math.trunc(toNumberOr(body.priceEur, 25))),
      perks: JSON.stringify(Array.isArray(body.perks) ? body.perks.map(String) : []),
      active: toBool(body.active, true),
    },
  });
  logAudit(ctx.user.id, ctx.user.name, 'SHOP_PLAN_CREATE', `Formule « ${created.name} » créée`);
  return ok({ plan: created });
}

async function handleShopPlanUpdate(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.subscriptionPlan.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Formule introuvable.');
  const body = await readBody<Record<string, unknown>>(ctx.req);
  const data: Prisma.SubscriptionPlanUpdateInput = {};
  if (body.name !== undefined) data.name = String(body.name).trim() || existing.name;
  if (body.description !== undefined) data.description = String(body.description);
  if (body.durationMonths !== undefined) data.durationMonths = Math.max(1, Math.trunc(toNumberOr(body.durationMonths, existing.durationMonths)));
  if (body.issuesCount !== undefined) data.issuesCount = Math.max(1, Math.trunc(toNumberOr(body.issuesCount, existing.issuesCount)));
  if (body.priceCfa !== undefined) data.priceCfa = Math.max(0, Math.trunc(toNumberOr(body.priceCfa, existing.priceCfa)));
  if (body.priceEur !== undefined) data.priceEur = Math.max(0, Math.trunc(toNumberOr(body.priceEur, existing.priceEur)));
  if (body.perks !== undefined) data.perks = JSON.stringify(Array.isArray(body.perks) ? body.perks.map(String) : []);
  if (body.active !== undefined) data.active = toBool(body.active, true);
  const updated = await db.subscriptionPlan.update({ where: { id }, data });
  logAudit(ctx.user.id, ctx.user.name, 'SHOP_PLAN_UPDATE', `Formule « ${updated.name} » modifiée`);
  return ok({ plan: updated });
}

async function handleShopPlanDelete(ctx: Ctx) {
  const id = ctx.seg[2];
  const existing = await db.subscriptionPlan.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Formule introuvable.');
  await db.subscriptionPlan.delete({ where: { id } });
  logAudit(ctx.user.id, ctx.user.name, 'SHOP_PLAN_DELETE', `Formule « ${existing.name} » supprimée`);
  return ok({ ok: true });
}

async function handleShopOrdersList(ctx: Ctx) {
  const status = ctx.sp.get('status');
  const where: Prisma.OrderWhereInput = status ? { status: status.toUpperCase() } : {};
  const rows = await db.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { issue: { select: { title: true } }, plan: { select: { name: true } } },
    take: 200,
  });
  return ok({
    orders: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      type: o.type,
      item: o.issue?.title ?? o.plan?.name ?? '—',
      buyerName: o.buyerName,
      buyerEmail: o.buyerEmail,
      buyerPhone: o.buyerPhone,
      amountCfa: o.amountCfa,
      amountEur: o.amountEur,
      currency: o.currency,
      paymentMethod: o.paymentMethod,
      paymentRef: o.paymentRef,
      variant: o.variant,
      deliveryAddress: o.deliveryAddress,
      deliveryCity: o.deliveryCity,
      deliveryNote: o.deliveryNote,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}

async function handleShopOrderStatus(ctx: Ctx) {
  const id = ctx.seg[2];
  const body = await readBody<{ status?: string }>(ctx.req);
  const status = String(body.status ?? '').toUpperCase();
  if (!['PENDING', 'PAID', 'CANCELLED'].includes(status)) throw new HttpError(400, 'Statut invalide.');
  const existing = await db.order.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'Commande introuvable.');
  const updated = await db.order.update({ where: { id }, data: { status } });
  logAudit(ctx.user.id, ctx.user.name, 'SHOP_ORDER_STATUS', `Commande ${updated.orderNumber} → ${status}`);
  return ok({ order: { id: updated.id, orderNumber: updated.orderNumber, status: updated.status } });
}

// ─── Envoi manuel de notification push (back-office) ──────────
async function handlePushSend(ctx: Ctx) {
  const body = await readBody<{ title?: string; body?: string; url?: string }>(ctx.req);
  const title = String(body.title ?? '').trim();
  const message = String(body.body ?? '').trim();
  if (!title || !message) throw new HttpError(400, 'Titre et message requis.');
  if (!pushConfigured()) {
    throw new HttpError(503, 'Notifications non configurées : générez les clés VAPID (voir .env) puis redémarrez.');
  }
  const result = await broadcastPush({ title, body: message, url: body.url || '/' });
  logAudit(ctx.user.id, ctx.user.name, 'PUSH_SEND', `Notification « ${title} » envoyée (${result.sent} abonné(s))`);
  return ok(result);
}

// ═══════════════════════════════════════════════════════════════
// TRADUCTIONS (gestion manuelle / re-traduction)
// ═══════════════════════════════════════════════════════════════

const ENTITY_TYPES = ['article', 'flashInfo', 'podcast', 'video', 'category', 'setting', 'page'] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

async function readEntityType(sp: URLSearchParams): Promise<EntityType> {
  const t = String(sp.get('entityType') ?? '');
  if (!(ENTITY_TYPES as readonly string[]).includes(t)) {
    throw new HttpError(400, 'entityType invalide (article, flashInfo, podcast, video, category).');
  }
  return t as EntityType;
}

/** Récupère l'entité source FR selon son type (pour re-traduction). */
async function fetchEntitySource(type: EntityType, id: string): Promise<Record<string, unknown> | null> {
  switch (type) {
    case 'article': {
      const a = await db.article.findUnique({ where: { id } });
      return a ? { title: a.title, subtitle: a.subtitle, excerpt: a.excerpt, content: a.content } : null;
    }
    case 'flashInfo': {
      const f = await db.flashInfo.findUnique({ where: { id } });
      return f ? { text: f.text } : null;
    }
    case 'podcast': {
      const p = await db.podcast.findUnique({ where: { id } });
      return p ? { title: p.title, description: p.description } : null;
    }
    case 'video': {
      const v = await db.video.findUnique({ where: { id } });
      return v ? { title: v.title, description: v.description } : null;
    }
    case 'category': {
      const c = await db.category.findUnique({ where: { id } });
      return c ? { name: c.name, description: c.description } : null;
    }
    case 'setting':
      return loadSettings() as unknown as Record<string, unknown>;
    case 'page': {
      const pg = await db.staticPage.findUnique({ where: { id } });
      return pg ? { title: pg.title, content: pg.content } : null;
    }
  }
}

async function handleTranslationsGet(ctx: Ctx) {
  const entityType = await readEntityType(ctx.sp);
  const entityId = String(ctx.sp.get('entityId') ?? '');
  if (!entityId) throw new HttpError(400, 'entityId manquant.');
  const rows = await db.translation.findMany({ where: { entityType, entityId } });
  return ok({
    translations: rows.map((r) => ({
      locale: r.locale,
      auto: r.auto,
      data: JSON.parse(r.data || '{}'),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

/** Sauvegarde manuelle d'une traduction (auto=false : plus jamais écrasée). */
async function handleTranslationsPut(ctx: Ctx) {
  const body = await readBody<{ entityType?: string; entityId?: string; locale?: string; data?: Record<string, unknown> }>(ctx.req);
  const entityType = String(body.entityType ?? '');
  if (!(ENTITY_TYPES as readonly string[]).includes(entityType)) {
    throw new HttpError(400, 'entityType invalide.');
  }
  const entityId = String(body.entityId ?? '');
  const locale = String(body.locale ?? '');
  if (!entityId || !(TRANSLATE_LOCALES as readonly string[]).includes(locale)) {
    throw new HttpError(400, 'entityId ou locale invalide.');
  }
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  // Fusion avec les données existantes (on ne perd pas les champs non
  // envoyés, ex. le contenu traduit des blocs d'article).
  const existing = await db.translation.findUnique({
    where: { entityType_entityId_locale: { entityType, entityId, locale } },
  });
  const merged = existing ? { ...JSON.parse(existing.data || '{}'), ...data } : data;
  await db.translation.upsert({
    where: { entityType_entityId_locale: { entityType, entityId, locale } },
    update: { data: JSON.stringify(merged), auto: false },
    create: { entityType, entityId, locale, data: JSON.stringify(merged), auto: false },
  });
  logAudit(ctx.user.id, ctx.user.name, 'TRANSLATION_SAVE', `${entityType}/${entityId} [${locale}] corrigé manuellement`);
  return ok({ ok: true });
}

/** Force une re-traduction automatique (supprime les versions auto existantes). */
async function handleTranslationsRetranslate(ctx: Ctx) {
  const body = await readBody<{ entityType?: string; entityId?: string; locale?: string }>(ctx.req);
  const entityType = String(body.entityType ?? '');
  if (!(ENTITY_TYPES as readonly string[]).includes(entityType)) {
    throw new HttpError(400, 'entityType invalide.');
  }
  const entityId = String(body.entityId ?? '');
  if (!entityId) throw new HttpError(400, 'entityId manquant.');
  const source = await fetchEntitySource(entityType as EntityType, entityId);
  if (!source) throw new HttpError(404, 'Entité introuvable.');

  // Supprime les traductions auto ciblées (toutes si aucune locale précisée,
  // ou seulement la locale demandée), puis re-traduit.
  await db.translation.deleteMany({
    where: { entityType, entityId, ...(body.locale ? { locale: String(body.locale) } : {}), auto: true },
  });
  if (body.locale) {
    const locale = String(body.locale) as 'en' | 'es' | 'ar' | 'zh';
    const data = await buildTranslationData(entityType as EntityType, source, locale);
    await db.translation.upsert({
      where: { entityType_entityId_locale: { entityType, entityId, locale } },
      update: { data: JSON.stringify(data), auto: true },
      create: { entityType, entityId, locale, data: JSON.stringify(data), auto: true },
    });
  } else {
    await translateEntity(entityType as EntityType, entityId, source);
  }
  logAudit(ctx.user.id, ctx.user.name, 'TRANSLATION_REBUILD', `${entityType}/${entityId} re-traduit automatiquement`);
  return ok({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// DISPATCH GET / POST / PUT / DELETE
// ═══════════════════════════════════════════════════════════════

async function makeCtx(req: NextRequest, ctxParams: { path?: string[] }): Promise<Ctx> {
  const user = await requireAuth(req);
  return { req, sp: req.nextUrl.searchParams, seg: ctxParams.path ?? [], user };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const c = await makeCtx(req, await ctx.params);
    const [root, second, third] = c.seg;

    switch (root) {
      case 'stats':
        return buildStats(30);
      case 'analytics':
        return buildStats(parseIntSafe(c.sp.get('days'), 30));
      case 'audit-logs':
        return handleAuditLogs(c);
      case 'articles':
        if (!second) return handleArticlesList(c);
        if (third === 'versions') return handleVersionsList(c);
        {
          const article = await fetchArticleFull(second);
          return ok({ article: serializeArticleFull(article) });
        }
      case 'categories':
        return handleCategoriesList();
      case 'tags':
        return handleTagsList();
      case 'media':
        if (!second) return handleMediaList(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'videos':
        if (!second) return handleVideosList(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'youtube':
        return handleYouTubeMeta(c);
      case 'podcasts':
        if (!second) return handlePodcastsList(c);
        if (second === 'collections') return handlePodcastCollectionsList();
        throw new HttpError(404, 'Ressource introuvable.');
      case 'pages':
        if (!second) return handlePagesList();
        return handlePageGet(c);
      case 'menus':
        return handleMenusList();
      case 'comments':
        return handleCommentsList(c);
      case 'newsletter':
        if (second === 'subscribers') return handleSubscribersList(c);
        if (second === 'campaigns') return handleCampaignsList();
        throw new HttpError(404, 'Ressource introuvable.');
      case 'ads':
        if (second === 'placements') return handlePlacementsList();
        if (second === 'campaigns') return handleAdCampaignsList(c);
        if (second === 'stats') return handleAdStats();
        throw new HttpError(404, 'Ressource introuvable.');
      case 'flash-info':
        return handleFlashList();
      case 'homepage':
        return handleHomeBlocksGet();
      case 'settings':
        return handleSettingsGet();
      case 'users':
        return handleUsersList();
      case 'translations':
        return handleTranslationsGet(c);
      case 'shop':
        if (second === 'issues') return handleShopIssuesList();
        if (second === 'plans') return handleShopPlansList();
        if (second === 'orders') return handleShopOrdersList(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'export':
        return handleExport(c);
      default:
        return jsonError(404, 'Ressource introuvable.');
    }
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const c = await makeCtx(req, await ctx.params);
    const [root, second, third] = c.seg;

    switch (root) {
      case 'articles':
        if (second === 'bulk') return handleArticleBulk(c);
        if (!second) return handleArticleCreate(c);
        if (third === 'versions') return handleVersionRestore(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'categories':
        if (second === 'reorder') return handleCategoryReorder(c);
        if (!second) return handleCategoryCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'media':
        if (!second) return handleMediaCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'videos':
        if (!second) return handleVideoCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'podcasts':
        if (second === 'collections' && third === 'reorder') return handlePodcastCollectionReorder(c);
        if (second === 'collections' && !third) return handlePodcastCollectionCreate(c);
        if (!second) return handlePodcastCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'pages':
        if (!second) return handlePageCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'menus':
        if (second === 'reorder') return handleMenuReorder(c);
        if (!second) return handleMenuCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'newsletter':
        if (second === 'campaigns' && third && c.seg[3] === 'send') return handleCampaignSend(c);
        if (second === 'campaigns' && !third) return handleCampaignCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'ads':
        if (second === 'campaigns' && !third) return handleAdCampaignCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'flash-info':
        if (!second) return handleFlashCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'users':
        if (!second) return handleUserCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'translations':
        if (second === 'retranslate') return handleTranslationsRetranslate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'shop':
        if (second === 'issues' && !third) return handleShopIssueCreate(c);
        if (second === 'plans' && !third) return handleShopPlanCreate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'push':
        if (second === 'send') return handlePushSend(c);
        throw new HttpError(404, 'Ressource introuvable.');
      default:
        return jsonError(404, 'Ressource introuvable.');
    }
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const c = await makeCtx(req, await ctx.params);
    const [root, second, third] = c.seg;

    switch (root) {
      case 'articles':
        if (second && !third) return handleArticleUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'categories':
        if (second) return handleCategoryUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'media':
        if (second) return handleMediaUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'videos':
        if (second === 'playlists') return handlePlaylistRename(c);
        if (second) return handleVideoUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'podcasts':
        if (second === 'collections' && third) return handlePodcastCollectionUpdate(c);
        if (second) return handlePodcastUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'pages':
        if (second) return handlePageUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'menus':
        if (second) return handleMenuUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'comments':
        if (second) return handleCommentUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'newsletter':
        if (second === 'subscribers' && third) return handleSubscriberUpdate(c);
        if (second === 'campaigns' && third) return handleCampaignUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'ads':
        if (second === 'placements' && third) return handlePlacementUpdate(c);
        if (second === 'campaigns' && third) return handleAdCampaignUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'flash-info':
        if (second) return handleFlashUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'homepage':
        if (second === 'featured') return handleFeaturedPut(c);
        if (!second) return handleHomeBlocksPut(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'settings':
        return handleSettingsPut(c);
      case 'users':
        if (second) return handleUserUpdate(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'translations':
        return handleTranslationsPut(c);
      case 'shop':
        if (second === 'issues' && third) return handleShopIssueUpdate(c);
        if (second === 'plans' && third) return handleShopPlanUpdate(c);
        if (second === 'orders' && third) return handleShopOrderStatus(c);
        throw new HttpError(404, 'Ressource introuvable.');
      default:
        return jsonError(404, 'Ressource introuvable.');
    }
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const c = await makeCtx(req, await ctx.params);
    const [root, second, third] = c.seg;

    switch (root) {
      case 'articles':
        if (second && !third) return handleArticleDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'categories':
        if (second) return handleCategoryDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'media':
        if (second) return handleMediaDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'videos':
        if (second) return handleVideoDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'podcasts':
        if (second === 'collections' && third) return handlePodcastCollectionDelete(c);
        if (second) return handlePodcastDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'pages':
        if (second) return handlePageDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'menus':
        if (second) return handleMenuDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'comments':
        if (second) return handleCommentDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'newsletter':
        if (second === 'subscribers' && third) return handleSubscriberDelete(c);
        if (second === 'campaigns' && third) return handleCampaignDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'ads':
        if (second === 'campaigns' && third) return handleAdCampaignDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'flash-info':
        if (second) return handleFlashDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'users':
        if (second) return handleUserDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      case 'shop':
        if (second === 'issues' && third) return handleShopIssueDelete(c);
        if (second === 'plans' && third) return handleShopPlanDelete(c);
        throw new HttpError(404, 'Ressource introuvable.');
      default:
        return jsonError(404, 'Ressource introuvable.');
    }
  } catch (err) {
    return handleRouteError(err);
  }
}
