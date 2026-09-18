// ═══════════════════════════════════════════════════════════════
// GET /api/site — Bootstrap du site public
// Réglages + menus + catégories (arborescence + compteurs) +
// flash infos + blocs d'accueil + configuration pop-up newsletter.
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  handleRouteError, loadHomeBlocks, loadSettings, ok, serializeCategory, serializeMenuItem,
} from '@/lib/server/utils';
import type { Category, SiteBootstrap } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const [settings, menuRows, categoryRows, flashRows, homeBlocks] = await Promise.all([
      loadSettings(),
      db.menuItem.findMany({ where: { active: true }, orderBy: [{ location: 'asc' }, { order: 'asc' }] }),
      db.category.findMany({ orderBy: { order: 'asc' } }),
      db.flashInfo.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      loadHomeBlocks(),
    ]);

    // Compteurs d'articles PUBLISHED par catégorie (pour la nav publique).
    const counts = await db.article.groupBy({
      by: ['categoryId'],
      where: { status: 'PUBLISHED' },
      _count: { categoryId: true },
    });
    const countMap = new Map(counts.map((c) => [c.categoryId, c._count.categoryId] as const));

    // Arborescence : racines d'abord, enfants imbriqués (triés par order).
    // Le compteur d'une rubrique parente agrège ceux de ses enfants.
    const all = categoryRows.map((c) => serializeCategory(c, countMap.get(c.id) ?? 0));
    const byParent = new Map<string, Category[]>();
    for (const c of all) {
      const key = c.parentId ?? '__root__';
      const list = byParent.get(key) ?? [];
      list.push(c);
      byParent.set(key, list);
    }
    const categories: Category[] = (byParent.get('__root__') ?? []).map((c) => {
      const children = byParent.get(c.id) ?? [];
      const childTotal = children.reduce((sum, ch) => sum + (ch.articleCount ?? 0), 0);
      return {
        ...c,
        articleCount: (c.articleCount ?? 0) + childTotal,
        children,
      };
    });

    const menus = menuRows.map(serializeMenuItem);

    const payload: SiteBootstrap = {
      settings,
      menus: {
        header: menus.filter((m) => m.location === 'header'),
        footer: menus.filter((m) => m.location === 'footer'),
      },
      categories,
      flashInfos: flashRows.map((f) => ({ id: f.id, text: f.text, link: f.link, active: f.active, order: f.order })),
      homeBlocks,
      popup: {
        enabled: settings.newsletterPopupEnabled,
        title: settings.newsletterPopupTitle,
        text: settings.newsletterPopupText,
        trigger: settings.newsletterPopupTrigger,
        delaySeconds: settings.newsletterPopupDelay,
        scrollPercent: settings.newsletterPopupScroll,
        frequency: settings.newsletterPopupFrequency,
      },
    };

    return ok(payload);
  } catch (err) {
    return handleRouteError(err);
  }
}
