'use client';

// ═══════════════════════════════════════════════════════════════
// STATIC PAGE VIEW — pages éditoriales (Mentions légales, CGU,
// À propos…). Contenu texte (\n\n) ou blocs JSON.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { publicApi } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import type { ContentBlock, StaticPageItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '../mag/Skeletons';
import { BlocksRenderer } from '../article/BlocksRenderer';
import { formatFrDate } from '../mag/helpers';

export function StaticPageView({ slug }: { slug: string }) {
  const [page, setPage] = useState<StaticPageItem | null>(null);
  useDocumentTitle(page?.title);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Réinitialisation au changement de slug (pattern React : reset au rendu)
  const [prevSlug, setPrevSlug] = useState(slug);
  if (prevSlug !== slug) {
    setPrevSlug(slug);
    setLoading(true);
    setError(null);
    setPage(null);
  }

  useEffect(() => {
    let cancelled = false;
    publicApi
      .page(slug)
      .then((res) => {
        if (!cancelled) setPage(res.page);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Page introuvable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    publicApi.track('PAGE_VIEW', `/page/${slug}`);
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) return <PageSkeleton />;

  if (error || !page) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-editorial text-5xl font-bold text-primary/70">404</p>
        <p className="mt-4 font-editorial text-xl font-bold">Page introuvable</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error || "Cette page n'existe pas ou n'est pas publiée."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="outline" className="rounded-full" onClick={() => (window.location.hash = '#/')}>
            Retour à l'accueil
          </Button>
          <Button variant="ghost" className="rounded-full" onClick={() => (window.location.hash = '#/contact')}>
            Nous contacter
          </Button>
        </div>
      </div>
    );
  }

  // Contenu : soit blocs JSON, soit paragraphes séparés par \n\n
  let blocks: ContentBlock[] | null = null;
  const raw = (page.content || '').trim();
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) blocks = parsed as ContentBlock[];
    } catch {
      blocks = null;
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <p className="eyebrow text-primary">Réussite Magazine</p>
        <h1 className="mt-1 font-editorial text-3xl font-bold sm:text-4xl">{page.title}</h1>
        <div className="mt-4 h-1 w-16 rounded-full bg-primary" aria-hidden="true" />
        {page.updatedAt ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Mis à jour le {formatFrDate(page.updatedAt, "d MMMM yyyy 'à' HH'h'mm")}
          </p>
        ) : null}
      </header>

      {blocks ? (
        <BlocksRenderer blocks={blocks} />
      ) : (
        <div className="article-body">
          {raw
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
