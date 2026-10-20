// ═══════════════════════════════════════════════════════════════
// AUTO FEATURE + AUTO FLASH — chaque nouvel article PUBLISHED passe
// automatiquement à la une (jusqu'à 6) ET alimente le flash info.
// L'éditeur garde la main : décocher « À la une » désactive la mise
// en avant (elle ne sera réactivée que par une nouvelle publication
// explicite ou manuellement).
// ═══════════════════════════════════════════════════════════════
import { db } from '@/lib/db';

const FEATURED_MAX = 6;
const FLASH_AUTO_PREFIX = 'AUTO-ARTICLE-';

/**
 * Met l'article à la une s'il reste de la place (ou remplace le plus
 * ancien ordre le plus bas). Ne touche pas aux autres mises en avant.
 */
export async function autoFeatureArticle(articleId: string): Promise<void> {
  try {
    const article = await db.article.findUnique({
      where: { id: articleId },
      select: { id: true, featured: true },
    });
    if (!article || article.featured) return;

    const settingsRows = await db.siteSetting.findMany({
      where: { key: { in: ['autoFeature', 'flashInfoAuto'] } },
    });
    const settings = new Map(settingsRows.map((r) => [r.key, r.value]));
    if (settings.get('autoFeature') === 'false') return; // désactivable

    const current = await db.article.findMany({
      where: { featured: true, status: 'PUBLISHED' },
      orderBy: { featuredOrder: 'asc' },
      select: { id: true, featuredOrder: true },
    });

    if (current.length < FEATURED_MAX) {
      // Place libre : ordre 0 (tête d'affiche), on décale les autres.
      await db.$transaction([
        ...current.map((a) =>
          db.article.update({ where: { id: a.id }, data: { featuredOrder: a.featuredOrder + 1 } }),
        ),
        db.article.update({ where: { id: articleId }, data: { featured: true, featuredOrder: 0 } }),
      ]);
    } else {
      // Une une pleine : remplace l'article d'ordre max (le plus ancien
      // positionné) SAUF s'il a été mis en avant manuellement récemment —
      // simplicité : on remplace le dernier de la liste.
      const last = current[current.length - 1];
      await db.$transaction([
        db.article.update({ where: { id: last.id }, data: { featured: false, featuredOrder: 0 } }),
        ...current.slice(0, -1).map((a) =>
          db.article.update({ where: { id: a.id }, data: { featuredOrder: a.featuredOrder + 1 } }),
        ),
        db.article.update({ where: { id: articleId }, data: { featured: true, featuredOrder: 0 } }),
      ]);
    }
  } catch (e) {
    console.warn('[autoFeature] ignoré:', e instanceof Error ? e.message : e);
  }
}

/**
 * Crée/met à jour l'entrée flash info automatique de l'article
 * (id stable : une republication ne crée pas de doublon).
 */
export async function autoFlashArticle(articleId: string): Promise<void> {
  try {
    const article = await db.article.findUnique({
      where: { id: articleId },
      select: { id: true, title: true, slug: true },
    });
    if (!article) return;

    const settingsRows = await db.siteSetting.findMany({ where: { key: { in: ['flashInfoAuto'] } } });
    const settings = new Map(settingsRows.map((r) => [r.key, r.value]));
    if (settings.get('flashInfoAuto') === 'false') return; // désactivable

    const dedupId = `${FLASH_AUTO_PREFIX}${article.id}`;
    const maxOrder = await db.flashInfo.aggregate({ _max: { order: true } });
    await db.flashInfo.upsert({
      where: { id: dedupId },
      update: { text: article.title, link: `#/article/${article.slug}`, active: true },
      create: {
        id: dedupId,
        text: article.title,
        link: `#/article/${article.slug}`,
        active: true,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });
    // Limite l'historique auto aux 5 derniers (les plus récents d'abord).
    const autoItems = await db.flashInfo.findMany({
      where: { id: { startsWith: FLASH_AUTO_PREFIX } },
      orderBy: { order: 'desc' },
      select: { id: true },
    });
    const stale = autoItems.slice(5);
    if (stale.length > 0) {
      await db.flashInfo.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
  } catch (e) {
    console.warn('[autoFlash] ignoré:', e instanceof Error ? e.message : e);
  }
}
