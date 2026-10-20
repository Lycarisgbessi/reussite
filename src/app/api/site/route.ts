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
import { applyTranslations } from '@/lib/server/translate';
import { publishDueScheduledArticles } from '@/app/api/cron/publish-scheduled/route';
import type { Category, SiteBootstrap } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const lang = req.nextUrl.searchParams.get('lang') || 'fr';
    // Secours au cron Vercel : publie les articles planifiés échus
    // (fire-and-forget, sans ralentir le bootstrap).
    void publishDueScheduledArticles().catch(() => {});
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
    const translatedTops = await applyTranslations(all, 'category', lang);
    // Les traductions sont au niveau plat : on propage aux objets enfants.
    const topMap = new Map(translatedTops.map((c) => [c.id, c]));
    for (const c of all) {
      const t = topMap.get(c.id);
      if (t && t.name !== c.name) {
        c.name = t.name;
        if (t.description) c.description = t.description;
      }
    }
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
    let flashInfos = flashRows.map((f) => ({ id: f.id, text: f.text, link: f.link, active: f.active, order: f.order }));

    // Mode auto : sans message actif, le ticker diffuse automatiquement les
    // titres des derniers articles publiés — le flash info tourne toujours.
    if (flashInfos.length === 0 && settings.flashInfoAuto) {
      const latest = await db.article.findMany({
        where: { status: 'PUBLISHED', OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
        orderBy: { publishedAt: 'desc' },
        take: 8,
        select: { id: true, title: true, slug: true },
      });
      flashInfos = latest.map((a, i) => ({
        id: `auto-${a.id}`,
        text: a.title,
        link: `#/article/${a.slug}`,
        active: true,
        order: i,
      }));
      // Titres traduits dans la langue du lecteur quand disponibles.
      if (lang !== 'fr') {
        const translated = await applyTranslations(
          latest.map((a) => ({ id: a.id, title: a.title })),
          'article',
          lang,
        );
        const titleMap = new Map(translated.map((t) => [t.id, t.title]));
        flashInfos = flashInfos.map((f) => ({
          ...f,
          text: titleMap.get(f.id.replace('auto-', '')) ?? f.text,
        }));
      }
    }
    const translatedFlash = await applyTranslations(flashInfos.filter((f) => !f.id.startsWith('auto-')), 'flashInfo', lang);
    // On remplace uniquement les items manuels par leurs versions traduites.
    if (lang !== 'fr' && translatedFlash.length > 0) {
      const map = new Map(translatedFlash.map((f) => [f.id, f]));
      flashInfos = flashInfos.map((f) => map.get(f.id) ?? f);
    }

    if (lang !== 'fr') {
      const [settingTr] = await applyTranslations([{ id: 'site' }], 'setting', lang);
      const overlay = settingTr as unknown as Record<string, string>;
      for (const k of ['newsletterPopupTitle', 'newsletterPopupText', 'newsletterHeroTitle', 'newsletterHeroText', 'partnersTitle', 'footerAbout']) {
        if (overlay[k]) (settings as unknown as Record<string, string>)[k] = overlay[k];
      }
    }

    const payload: SiteBootstrap = {
      settings,
      menus: {
        header: menus.filter((m) => m.location === 'header'),
        footer: menus.filter((m) => m.location === 'footer'),
      },
      categories,
      flashInfos: translatedFlash,
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
