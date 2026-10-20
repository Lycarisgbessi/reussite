// ═══════════════════════════════════════════════════════════════
// TRADUCTION AUTOMATIQUE (DeepL) — FR source → EN/ES/AR/ZH.
// Appelée à la publication (article, flash info, podcast, vidéo,
// catégorie). Silencieuse si DEEPL_API_KEY absente (site 100 % FR).
// ═══════════════════════════════════════════════════════════════
import { db } from '@/lib/db';
import type { ContentBlock } from '@/lib/types';
import { parseJsonSafe } from './utils';

export const TRANSLATE_LOCALES = ['en', 'es', 'ar', 'zh'] as const;
export type TranslateLocale = (typeof TRANSLATE_LOCALES)[number];

const DEEPL_TARGET: Record<TranslateLocale, string> = {
  en: 'EN-US',
  es: 'ES',
  ar: 'AR',
  zh: 'ZH',
};

function deeplKey(): string | null {
  const key = process.env.DEEPL_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

/** Appel brut DeepL : traduit un lot de textes (max ~50 par appel). */
async function deeplTranslate(texts: string[], target: string): Promise<string[]> {
  const key = deeplKey();
  if (!key) throw new Error('DEEPL_API_KEY manquante');
  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  const res = await fetch(`${host}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: texts, target_lang: target, source_lang: 'FR' }),
  });
  if (!res.ok) {
    throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { translations: { text: string }[] };
  return json.translations.map((t) => t.text);
}

/** Traduit un tableau de textes en préservant les entrées vides. */
async function translateBatch(texts: string[], target: string): Promise<string[]> {
  const nonEmpty = texts.filter((t) => t && t.trim());
  if (nonEmpty.length === 0) return texts;
  const translated = await deeplTranslate(nonEmpty, target);
  const map = new Map<string, string>();
  nonEmpty.forEach((t, i) => map.set(t, translated[i] ?? t));
  return texts.map((t) => (t && t.trim() ? (map.get(t) as string) : t));
}

/** Traduit les champs textuels des blocs de contenu (structure conservée). */
async function translateBlocks(blocks: ContentBlock[], target: string): Promise<ContentBlock[]> {
  const texts: string[] = [];
  for (const b of blocks) {
    if (b.type === 'paragraph' || b.type === 'heading' || b.type === 'quote' || b.type === 'callout') {
      texts.push(b.text);
      if (b.type === 'quote' && b.author) texts.push(b.author);
      if (b.type === 'callout' && b.title) texts.push(b.title);
    } else if (b.type === 'list') {
      texts.push(...b.items);
    } else if (b.type === 'image') {
      if (b.caption) texts.push(b.caption);
    } else if (b.type === 'video' && b.title) {
      texts.push(b.title);
    }
  }
  const out = await translateBatch(texts, target);
  let i = 0;
  const next = (val: string) => out[i++] ?? val;
  return blocks.map((b) => {
    switch (b.type) {
      case 'paragraph':
      case 'heading':
        return { ...b, text: next(b.text) };
      case 'quote':
        return { ...b, text: next(b.text), ...(b.author ? { author: next(b.author) } : {}) };
      case 'callout':
        return { ...(b.title ? { ...b, title: next(b.title), text: next(b.text) } : { ...b, text: next(b.text) }) };
      case 'list':
        return { ...b, items: b.items.map((it) => next(it)) };
      case 'image':
        return b.caption ? { ...b, caption: next(b.caption) } : b;
      case 'video':
        return b.title ? { ...b, title: next(b.title) } : b;
      default:
        return b;
    }
  }) as ContentBlock[];
}

/** Champs traduits par type d'entité (source français). */
export async function buildTranslationData(
  entityType: 'article' | 'flashInfo' | 'podcast' | 'video' | 'category' | 'setting' | 'page',
  source: Record<string, unknown>,
  locale: TranslateLocale,
): Promise<Record<string, unknown>> {
  const target = DEEPL_TARGET[locale];
  const data: Record<string, unknown> = {};
  if (entityType === 'article') {
    const simple = [String(source.title ?? ''), String(source.subtitle ?? ''), String(source.excerpt ?? '')];
    const [title, subtitle, excerpt] = await translateBatch(simple, target);
    data.title = title;
    if (subtitle) data.subtitle = subtitle;
    if (excerpt) data.excerpt = excerpt;
    const blocks = parseJsonSafe<ContentBlock[]>(String(source.content ?? '[]'), []);
    if (Array.isArray(blocks) && blocks.length > 0) {
      data.content = await translateBlocks(blocks, target);
    }
  } else if (entityType === 'flashInfo') {
    const [text] = await translateBatch([String(source.text ?? '')], target);
    data.text = text;
  } else if (entityType === 'podcast' || entityType === 'video') {
    const [title, description] = await translateBatch(
      [String(source.title ?? ''), String(source.description ?? '')],
      target,
    );
    data.title = title;
    if (description) data.description = description;
  } else if (entityType === 'category') {
    const [name, description] = await translateBatch(
      [String(source.name ?? ''), String(source.description ?? '')],
      target,
    );
    data.name = name;
    if (description) data.description = description;
  } else if (entityType === 'setting') {
    // Champs éditoriaux des réglages (popup newsletter, blocs d'accueil…)
    const keys = ['newsletterPopupTitle', 'newsletterPopupText', 'newsletterHeroTitle', 'newsletterHeroText', 'partnersTitle', 'footerAbout'];
    const values = await translateBatch(keys.map((k) => String(source[k] ?? '')), target);
    keys.forEach((k, i) => {
      if (values[i]) data[k] = values[i];
    });
  } else if (entityType === 'page') {
    const [title, content] = await translateBatch(
      [String(source.title ?? ''), String(source.content ?? '')],
      target,
    );
    data.title = title;
    if (content) data.content = content;
  }
  return data;
}

/**
 * Traduit et persiste une entité dans les 4 langues cibles.
 * Ne touche jamais les traductions « manuelles » (auto=false).
 * Erreurs avalées (log seulement) : la publication ne doit jamais échouer
 * à cause de la traduction.
 */
export async function translateEntity(
  entityType: 'article' | 'flashInfo' | 'podcast' | 'video' | 'category' | 'setting' | 'page',
  entityId: string,
  source: Record<string, unknown>,
): Promise<void> {
  if (!deeplKey()) return;
  try {
    // Les 4 langues sont traduites EN PARALLÈLE (publication rapide).
    await Promise.all(
      TRANSLATE_LOCALES.map(async (locale) => {
        const existing = await db.translation.findUnique({
          where: { entityType_entityId_locale: { entityType, entityId, locale } },
        });
        if (existing && !existing.auto) return; // correction manuelle préservée
        const data = await buildTranslationData(entityType, source, locale);
        await db.translation.upsert({
          where: { entityType_entityId_locale: { entityType, entityId, locale } },
          update: { data: JSON.stringify(data), auto: true },
          create: { entityType, entityId, locale, data: JSON.stringify(data), auto: true },
        });
      }),
    );
  } catch (e) {
    console.warn(`[translate] ${entityType}/${entityId} ignoré:`, e instanceof Error ? e.message : e);
  }
}

/** Applique les traductions d'une liste d'objets sérialisés (overlay). */
export async function applyTranslations<T extends { id: string }>(
  items: T[],
  entityType: 'article' | 'flashInfo' | 'podcast' | 'video' | 'category' | 'setting' | 'page',
  locale: string,
): Promise<T[]> {
  if (!locale || locale === 'fr' || items.length === 0) return items;
  const ids = items.map((i) => i.id);
  const rows = await db.translation.findMany({
    where: { entityType, entityId: { in: ids }, locale },
  });
  const map = new Map(rows.map((r) => [r.entityId, parseJsonSafe<Record<string, unknown>>(r.data, {})]));
  return items.map((item) => {
    const t = map.get(item.id);
    if (!t) return item;
    const overlay: Record<string, unknown> = { ...(item as unknown as Record<string, unknown>) };
    for (const [k, v] of Object.entries(t)) {
      if (typeof v === 'string' && v.trim()) overlay[k] = v;
      else if (k === 'content' && Array.isArray(v) && v.length > 0) overlay[k] = v;
    }
    return overlay as unknown as T;
  });
}
