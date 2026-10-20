'use client';

// ═══════════════════════════════════════════════════════════════
// I18N CORE — store Zustand + hook t() + locale date-fns + RTL.
// Langues : fr (source) · en · es · ar (RTL) · zh.
// Persistance : localStorage « bh_locale ».
// ═══════════════════════════════════════════════════════════════
import { create } from 'zustand';
import { format, formatDistanceToNow } from 'date-fns';
import { fr as dfFr, enUS as dfEn, es as dfEs, ar as dfAr, zhCN as dfZh } from 'date-fns/locale';
import { fr } from './fr';
import { en } from './en';
import { es } from './es';
import { ar } from './ar';
import { zh } from './zh';

export const LOCALES = ['fr', 'en', 'es', 'ar', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const RTL_LOCALES: Locale[] = ['ar'];

const DICTS: Record<Locale, typeof fr> = { fr, en, es, ar, zh };
const DF_LOCALES = { fr: dfFr, en: dfEn, es: dfEs, ar: dfAr, zh: dfZh };

const STORAGE_KEY = 'bh_locale';

export function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

let localeInitialized = false;

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: 'fr',
  setLocale: (locale) => {
    const changed = localeInitialized && get().locale !== locale;
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
    }
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, locale);
    localeInitialized = true;
    set({ locale });
    // Au changement de langue (pas à l'init), recharge les données publiques
    // traduites. Import dynamique pour éviter la dépendance circulaire.
    if (changed) {
      void import('../store').then(({ useMagazineStore }) => {
        useMagazineStore.getState().loadBootstrap();
      });
    }
  },
}));

/** Init : restaure la langue sauvegardée (appelé dans initClient). */
export function initLocale() {
  if (typeof window === 'undefined') return;
  const saved = localStorage.getItem(STORAGE_KEY);
  const nav = navigator.language?.slice(0, 2);
  const locale = isLocale(saved) ? saved : isLocale(nav) ? (nav as Locale) : 'fr';
  useI18nStore.getState().setLocale(locale);
}

/** Traduction : fallback français si la clé est absente. */
export function translate(locale: Locale, key: string): string {
  return DICTS[locale]?.[key as keyof typeof fr] ?? fr[key as keyof typeof fr] ?? key;
}

/** Hook principal : const { t, locale } = useI18n(); */
export function useI18n() {
  const locale = useI18nStore((s) => s.locale);
  const setLocale = useI18nStore((s) => s.setLocale);
  return {
    locale,
    setLocale,
    rtl: RTL_LOCALES.includes(locale),
    t: (key: string) => translate(locale, key),
  };
}

/** Date localisée. */
export function useFormatDate() {
  const locale = useI18nStore((s) => s.locale);
  return {
    formatDate: (value: string | Date | null | undefined, pattern = 'd MMMM yyyy') => {
      if (!value) return '';
      try {
        const d = typeof value === 'string' ? new Date(value) : value;
        if (Number.isNaN(d.getTime())) return '';
        return format(d, pattern, { locale: DF_LOCALES[locale] });
      } catch {
        return '';
      }
    },
    relative: (value: string | Date | null | undefined) => {
      if (!value) return '';
      try {
        const d = typeof value === 'string' ? new Date(value) : value;
        if (Number.isNaN(d.getTime())) return '';
        return formatDistanceToNow(d, { locale: DF_LOCALES[locale], addSuffix: true });
      } catch {
        return '';
      }
    },
  };
}
