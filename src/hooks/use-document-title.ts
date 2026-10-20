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
