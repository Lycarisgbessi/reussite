'use client';

// ═══════════════════════════════════════════════════════════════
// CATEGORY PAGE — bannière (image ou couleur), tri, onglets
// sous-catégories, 1re carte large + grille 3 colonnes, pagination.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import type { ArticlesResponse, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArticleCard } from '../mag/ArticleCard';
import { Pagination } from '../mag/Pagination';
import { SmartImage } from '../mag/SmartImage';
import { ArticleCardSkeleton } from '../mag/Skeletons';
import { AdSlot } from '../ads/AdSlot';

type SortKey = 'RECENT' | 'POPULAR' | 'AZ';

export function CategoryPage({ slug }: { slug: string }) {
  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const [sort, setSort] = useState<SortKey>('RECENT');
  const [page, setPage] = useState(1);
  const [activeCat, setActiveCat] = useState(slug);
  const [data, setData] = useState<ArticlesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Trouve la catégorie (racine ou sous-catégorie) dans le bootstrap
  const info = findCategory(bootstrap?.categories || [], slug);

  // Reset au changement de rubrique (pattern React : reset au rendu)
  const [prevSlug, setPrevSlug] = useState(slug);
  if (prevSlug !== slug) {
    setPrevSlug(slug);
    setActiveCat(slug);
    setPage(1);
    setSort('RECENT');
  }

  // Reset du chargement quand les paramètres de requête changent
  const fetchKey = `${activeCat}|${sort}|${page}|${slug}|${reloadKey}`;
  const [prevKey, setPrevKey] = useState(fetchKey);
  if (prevKey !== fetchKey) {
    setPrevKey(fetchKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    publicApi
      .articles({ category: activeCat, sort, page, limit: 9 })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    publicApi.track('PAGE_VIEW', `/category/${slug}`);
    return () => {
      cancelled = true;
    };
  }, [activeCat, sort, page, slug]);

  const children = info?.children || [];

  return (
    <div className="pb-6">
      {/* Pub en tête de rubrique */}
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <AdSlot placement="HEADER_BANNER" category={slug} />
      </div>

      {/* Bannière */}
      <section
        className="relative mt-6 overflow-hidden"
        style={!info?.cat.imageUrl ? { backgroundColor: info?.cat.color || '#b45309' } : undefined}
        aria-label={`Rubrique ${info?.cat.name || slug}`}
      >
        {info?.cat.imageUrl ? (
          <>
            <SmartImage
              src={info.cat.imageUrl}
              alt={info.cat.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/50 to-black/20" aria-hidden="true" />
          </>
        ) : (
          <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        )}
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-16">
          <nav aria-label="Fil d'Ariane" className="mb-3 flex items-center gap-1 text-xs text-white/70">
            <a href="#/" className="transition-colors hover:text-white">
              Accueil
            </a>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span>{info?.cat.name || 'Rubrique'}</span>
          </nav>
          <h1 className="font-editorial text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            {info?.cat.name || slug}
          </h1>
          {info?.cat.description ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
              {info.cat.description}
            </p>
          ) : null}
          {info?.cat.articleCount !== undefined ? (
            <p className="mt-3 text-xs uppercase tracking-widest text-white/60">
              {info.cat.articleCount} article{info.cat.articleCount === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Filtres */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {children.length > 0 ? (
            <Tabs value={activeCat} onValueChange={(v) => { setActiveCat(v); setPage(1); }}>
              <TabsList className="h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value={slug} className="min-h-[40px]">
                  Tout
                </TabsTrigger>
                {children.map((child) => (
                  <TabsTrigger key={child.id} value={child.slug} className="min-h-[40px]">
                    {child.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <div />
          )}
          <div className="shrink-0">
            <Select value={sort} onValueChange={(v) => { setSort(v as SortKey); setPage(1); }}>
              <SelectTrigger className="h-11 w-full rounded-lg sm:w-48" aria-label="Trier les articles">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECENT">Plus récents</SelectItem>
                <SelectItem value="POPULAR">Populaires</SelectItem>
                <SelectItem value="AZ">A → Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Liste des articles */}
        {error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4 rounded-full" onClick={() => setReloadKey((k) => k + 1)}>
              Réessayer
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-6">
            <ArticleCardSkeleton variant="horizontal" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ArticleCardSkeleton key={i} variant="grid" />
              ))}
            </div>
          </div>
        ) : !data || data.articles.length === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <p className="font-editorial text-xl font-bold">Aucun article pour le moment</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Cette rubrique sera bientôt alimentée par la rédaction.
            </p>
            <Button variant="outline" className="mt-5 rounded-full" onClick={() => (window.location.hash = '#/')}>
              Explorer l'accueil
            </Button>
          </div>
        ) : (
          <>
            {/* 1re carte large */}
            <ArticleCard article={data.articles[0]} variant="horizontal" className="mb-8" />
            {/* Grille */}
            {data.articles.length > 1 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.articles.slice(1).map((a) => (
                  <ArticleCard key={a.id} article={a} variant="grid" />
                ))}
              </div>
            ) : null}
            <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

/** Recherche d'une catégorie (racine ou enfant) par slug. */
function findCategory(
  cats: Category[],
  slug: string,
): { cat: Category; children: Category[] } | null {
  for (const c of cats) {
    if (c.slug === slug) return { cat: c, children: c.children || [] };
    for (const child of c.children || []) {
      if (child.slug === slug) return { cat: child, children: [] };
    }
  }
  return null;
}
