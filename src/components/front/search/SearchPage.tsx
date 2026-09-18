'use client';

// ═══════════════════════════════════════════════════════════════
// SEARCH PAGE — recherche full-text avec filtres (catégorie, type),
// résultats groupés avec compteurs, état vide soigné.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { FileText, Headphones, Loader2, Play, Search, SearchX } from 'lucide-react';
import { publicApi, type SearchResults } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArticleCard } from '../mag/ArticleCard';
import { SmartImage } from '../mag/SmartImage';
import { CategoryBadge } from '../mag/ArticleCard';
import { frRelative } from '../mag/helpers';

export function SearchPage({ query }: { query: string }) {
  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const [term, setTerm] = useState(query);
  const [category, setCategory] = useState('all');
  const [type, setType] = useState('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    setTerm(query);
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTouched(true);
    publicApi
      .search(q, {
        category: category === 'all' ? undefined : category,
        type: type === 'all' ? undefined : type,
      })
      .then((res) => !cancelled && setResults(res))
      .catch(() => !cancelled && setResults(null))
      .finally(() => !cancelled && setLoading(false));
    publicApi.track('SEARCH', '/search', { q });
    return () => {
      cancelled = true;
    };
  }, [query, category, type]);

  const roots = (bootstrap?.categories || []).filter((c) => !c.parentId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    window.location.hash = q ? `#/search?q=${encodeURIComponent(q)}` : '#/search';
  };

  const total =
    (results?.articles.length || 0) +
    (results?.videos.length || 0) +
    (results?.podcasts.length || 0) +
    (results?.pages.length || 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="eyebrow text-primary">Recherche</p>
        <h1 className="font-editorial text-3xl font-bold sm:text-4xl">Explorer le magazine</h1>
      </header>

      {/* Barre de recherche */}
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Mot-clé, auteur, thème…"
            className="h-12 rounded-full pl-11 text-base"
            aria-label="Terme de recherche"
          />
        </div>
        <Button type="submit" className="h-12 rounded-full px-8" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Rechercher
        </Button>
      </form>

      {/* Filtres */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={type} onValueChange={setType}>
          <TabsList className="h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="all" className="min-h-[40px]">Tout</TabsTrigger>
            <TabsTrigger value="ARTICLE" className="min-h-[40px]">Articles</TabsTrigger>
            <TabsTrigger value="VIDEO" className="min-h-[40px]">Vidéos</TabsTrigger>
            <TabsTrigger value="PODCAST" className="min-h-[40px]">Podcasts</TabsTrigger>
            <TabsTrigger value="PAGE" className="min-h-[40px]">Pages</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11 w-full rounded-lg sm:w-56" aria-label="Filtrer par rubrique">
            <SelectValue placeholder="Toutes les rubriques" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les rubriques</SelectItem>
            {roots.map((cat) => (
              <SelectItem key={cat.id} value={cat.slug}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Résultats */}
      <div className="mt-10">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border bg-card">
                <div className="skeleton-shimmer aspect-[16/10]" />
                <div className="space-y-2 p-4">
                  <div className="skeleton-shimmer h-4 w-3/4 rounded" />
                  <div className="skeleton-shimmer h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !results || total === 0 ? (
          <div className="rounded-xl border border-dashed py-16 text-center">
            <SearchX className="mx-auto size-12 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-4 font-editorial text-xl font-bold">
              {query ? 'Aucun résultat trouvé' : 'Saisissez un terme de recherche'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              {query
                ? `Essayez avec d'autres mots-clés ou modifiez les filtres.`
                : 'Retrouvez articles, vidéos, podcasts et pages en un instant.'}
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{results.total}</strong> résultat
              {results.total === 1 ? '' : 's'} pour « <strong className="text-foreground">{query.trim()}</strong> »
            </p>

            {/* Articles */}
            {results.articles.length > 0 ? (
              <section aria-label="Articles trouvés">
                <GroupHeader Icon={FileText} title="Articles" count={results.articles.length} />
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {results.articles.map((a) => (
                    <ArticleCard key={a.id} article={a} variant="grid" showExcerpt={false} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Vidéos */}
            {results.videos.length > 0 ? (
              <section aria-label="Vidéos trouvées">
                <GroupHeader Icon={Play} title="Vidéos" count={results.videos.length} />
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {results.videos.map((v) => (
                    <a key={v.id} href="#/videos" className="article-card group overflow-hidden rounded-xl border bg-card">
                      <div className="relative aspect-video overflow-hidden">
                        <SmartImage
                          src={v.thumbnailUrl || (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : '')}
                          alt={v.title}
                          className="h-full w-full object-cover"
                          fallbackLabel="Vidéo"
                        />
                        {v.duration ? (
                          <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] text-white">
                            {v.duration}
                          </span>
                        ) : null}
                      </div>
                      <div className="p-4">
                        <h3 className="font-editorial text-sm font-bold line-clamp-2 transition-colors group-hover:text-primary">
                          {v.title}
                        </h3>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Podcasts */}
            {results.podcasts.length > 0 ? (
              <section aria-label="Podcasts trouvés">
                <GroupHeader Icon={Headphones} title="Podcasts" count={results.podcasts.length} />
                <ul className="space-y-3">
                  {results.podcasts.map((p) => (
                    <li key={p.id}>
                      <a
                        href="#/podcasts"
                        className="article-card flex items-center gap-4 rounded-xl border bg-card p-4"
                      >
                        <div className="size-14 shrink-0 overflow-hidden rounded-lg">
                          <SmartImage src={p.coverImage} alt={p.title} className="h-full w-full object-cover" fallbackLabel="♪" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                            S{p.season} · E{p.episode}
                          </p>
                          <h3 className="font-editorial text-base font-bold line-clamp-1">{p.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {p.duration || '—'} · {frRelative(p.publishedAt)}
                          </p>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Pages */}
            {results.pages.length > 0 ? (
              <section aria-label="Pages trouvées">
                <GroupHeader Icon={FileText} title="Pages" count={results.pages.length} />
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {results.pages.map((p) => (
                    <li key={p.slug}>
                      <a
                        href={`#/page/${p.slug}`}
                        className="flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                      >
                        {p.title}
                        <Badge variant="secondary" className="rounded-full">Page</Badge>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupHeader({ Icon, title, count }: { Icon: React.ComponentType<{ className?: string }>; title: string; count: number }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-editorial text-xl font-bold">
      <Icon className="size-5 text-primary" aria-hidden="true" />
      {title}
      <Badge variant="secondary" className="rounded-full">{count}</Badge>
      <span className="ml-2 h-px flex-1 bg-border" aria-hidden="true" />
    </h2>
  );
}
