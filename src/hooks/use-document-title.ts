'use client';

// ═══════════════════════════════════════════════════════════════
// USE DOCUMENT TITLE — titre d'onglet dynamique par vue (SEO /
// partage). Usage : useDocumentTitle(article.title) ou
// useDocumentTitle(t('videos.title'), true) pour suffixer le nom
// du magazine.
// ═══════════════════════════════════════════════════════════════
import { useEffect } from 'react';

const SITE = 'Réussite Magazine';

export function useDocumentTitle(title?: string | null, withSuffix = true) {
  useEffect(() => {
    const clean = (title ?? '').trim();
    document.title = clean
      ? withSuffix
        ? `${clean} — ${SITE}`
        : clean
      : `${SITE} — Trimestriel des décideurs africains`;
  }, [title, withSuffix]);
}

/** Métadonnées Open Graph / Twitter dynamiques (partage réseaux sociaux). */
export function useSocialMeta({ title, description, image }: { title?: string; description?: string; image?: string }) {
  useEffect(() => {
    const set = (prop: string, content: string, attr: 'property' | 'name' = 'property') => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${prop}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, prop);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    if (title) {
      set('og:title', title);
      set('twitter:title', title, 'name');
    }
    if (description) {
      set('og:description', description);
      set('twitter:description', description, 'name');
    }
    if (image) {
      set('og:image', new URL(image, window.location.origin).toString());
      set('twitter:image', image, 'name');
    }
    set('og:url', window.location.href);
    set('og:type', 'article');
  }, [title, description, image]);
}
