'use client';

// ═══════════════════════════════════════════════════════════════
// FAVORITES PAGE — articles enregistrés par le lecteur (readerKey),
// possibilité de retirer un favori.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { Bookmark, BookmarkX } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import type { ArticleSummary } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArticleCard } from '../mag/ArticleCard';
import { ArticleCardSkeleton } from '../mag/Skeletons';

export function FavoritesPage() {
  const readerKey = useMagazineStore((s) => s.readerKey);
  const toggleFavoriteLocal = useMagazineStore((s) => s.toggleFavoriteLocal);
  const { toast } = useToast();
  const [items, setItems] = useState<ArticleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!readerKey) return;
    let cancelled = false;
    publicApi
      .favorites(readerKey)
      .then((res) => {
        if (!cancelled) {
          setItems(res.articles);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      });
    publicApi.track('PAGE_VIEW', '/favorites');
    return () => {
      cancelled = true;
    };
  }, [readerKey, reloadKey]);

  const remove = async (article: ArticleSummary) => {
    try {
      await publicApi.toggleFavorite(readerKey, article.id);
      toggleFavoriteLocal(article.id);
      setItems((prev) => (prev || []).filter((a) => a.id !== article.id));
      toast({ title: 'Article retiré de vos favoris' });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Action impossible.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="eyebrow text-primary">Ma bibliothèque</p>
        <h1 className="font-editorial text-3xl font-bold sm:text-4xl">Mes favoris</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Retrouvez ici les articles que vous avez enregistrés pour plus tard.
        </p>
      </header>

      {error ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4 rounded-full" onClick={() => setReloadKey((k) => k + 1)}>
            Réessayer
          </Button>
        </div>
      ) : !items ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ArticleCardSkeleton key={i} variant="grid" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Bookmark className="mx-auto size-12 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-4 font-editorial text-xl font-bold">Aucun favori pour le moment</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Cliquez sur le bouton « Favori » en haut d'un article pour le conserver ici.
          </p>
          <Button className="mt-6 rounded-full" onClick={() => (window.location.hash = '#/')}>
            Découvrir les articles
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((article) => (
            <div key={article.id} className="relative">
              <ArticleCard article={article} variant="grid" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => remove(article)}
                aria-label={`Retirer « ${article.title} » des favoris`}
                className="absolute right-3 top-3 h-9 rounded-full border bg-card/95 px-3 text-xs backdrop-blur hover:border-destructive hover:bg-destructive hover:text-white"
              >
                <BookmarkX className="size-4" />
                Retirer
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
