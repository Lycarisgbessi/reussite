'use client';

// ═══════════════════════════════════════════════════════════════
// SEARCH OVERLAY — Dialog plein écran : autocomplétion debounced
// (publicApi.suggest) + validation Entrée → page de recherche.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Search } from 'lucide-react';
import { navigate, useMagazineStore } from '@/lib/store';
import { publicApi } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const TYPE_LABELS: Record<string, string> = {
  ARTICLE: 'Article',
  VIDEO: 'Vidéo',
  PODCAST: 'Podcast',
  PAGE: 'Page',
};

export function SearchOverlay() {
  const open = useMagazineStore((s) => s.searchOpen);
  const setSearchOpen = useMagazineStore((s) => s.setSearchOpen);
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<{ slug: string; title: string; type: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Réinitialisation à la fermeture (pattern React : reset au rendu)
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) {
      setQ('');
      setSuggestions([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    // Tous les setState sont asynchrones (callback du debounce)
    const t = setTimeout(() => {
      if (term.length < 2) {
        setSuggestions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      publicApi
        .suggest(term)
        .then((res) => setSuggestions(res.suggestions || []))
        .catch(() => setSuggestions([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, open]);

  const goSuggestion = (slug: string, type: string) => {
    setSearchOpen(false);
    if (type === 'ARTICLE') navigate(`/article/${slug}`);
    else if (type === 'VIDEO') navigate('/videos');
    else if (type === 'PODCAST') navigate('/podcasts');
    else navigate(`/page/${slug}`);
  };

  const submit = () => {
    const term = q.trim();
    if (!term) return;
    setSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <Dialog open={open} onOpenChange={setSearchOpen}>
      <DialogContent className="top-[12%] gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="px-5 pb-0 pt-5">
          <DialogTitle className="font-editorial text-xl font-bold">Rechercher</DialogTitle>
          <DialogDescription>
            Articles, vidéos, podcasts et pages du magazine.
          </DialogDescription>
        </DialogHeader>
        <div className="p-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="Rechercher un article, une vidéo, un podcast…"
              className="h-12 rounded-xl pl-11 pr-11 text-base"
              aria-label="Terme de recherche"
            />
            {loading ? (
              <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Appuyez sur <kbd className="rounded border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">Entrée</kbd> pour
            lancer la recherche complète.
          </p>

          {q.trim().length >= 2 && !loading && suggestions.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Aucune suggestion pour « {q.trim()} ».
            </p>
          ) : null}

          {suggestions.length > 0 ? (
            <ul className="mt-4 divide-y overflow-hidden rounded-xl border" aria-label="Suggestions">
              {suggestions.map((s, i) => (
                <li key={`${s.type}-${s.slug}-${i}`}>
                  <button
                    type="button"
                    onClick={() => goSuggestion(s.slug, s.type)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                      {TYPE_LABELS[s.type] || s.type}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium">{s.title}</span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
