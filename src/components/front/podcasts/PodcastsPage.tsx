'use client';

// ═══════════════════════════════════════════════════════════════
// PODCASTS PAGE — épisodes hiérarchisés par COLLECTION mère/fille
// (arbre via publicApi.podcastCollections, épisodes groupés côté
// client par collectionId). Épisodes sans collection regroupés par
// saison (« Saison N »). Lecture via le lecteur GLOBAL usePlayerStore
// (barre flottante montée dans FrontOffice) : plus d'<audio> local.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, Check, Headphones, Pause, Play, Rss } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useI18n, useFormatDate } from '@/lib/i18n';
import { usePlayerStore } from '@/lib/playerStore';
import { useToast } from '@/hooks/use-toast';
import type { PodcastCollection, PodcastItem } from '@/lib/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { SmartImage } from '../mag/SmartImage';

const LATER_KEY = 'bh_listen_later';

interface CollectionNode extends PodcastCollection {
  episodes: PodcastItem[];
  children: (CollectionNode & { episodes: PodcastItem[] })[];
}

interface SeasonGroup {
  key: string;
  label: string;
  episodes: PodcastItem[];
}

/** Carte épisode (design conservé) — lecture via le lecteur global. */
function EpisodeRow({ ep }: { ep: PodcastItem }) {
  const { t } = useI18n();
  useDocumentTitle(t('podcasts.title'));
  const { relative } = useFormatDate();
  const { toast } = useToast();
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const closed = usePlayerStore((s) => s.closed);
  const playEp = usePlayerStore((s) => s.play);
  const [later, setLater] = useState(false);

  useEffect(() => {
    try {
      setLater(JSON.parse(localStorage.getItem(LATER_KEY) || '[]').includes(ep.id));
    } catch {
      /* ignore */
    }
  }, [ep.id]);

  const toggleLater = () => {
    let ids: string[] = [];
    try {
      ids = JSON.parse(localStorage.getItem(LATER_KEY) || '[]');
    } catch {
      /* ignore */
    }
    const has = ids.includes(ep.id);
    const next = has ? ids.filter((id) => id !== ep.id) : [...ids, ep.id];
    localStorage.setItem(LATER_KEY, JSON.stringify(next));
    setLater(!has);
    toast({ title: has ? t('podcasts.removedLater') : t('podcasts.addedLater') });
  };

  const isCurrent = current?.id === ep.id && !closed;
  const isPlaying = isCurrent && playing;

  return (
    <li className={isCurrent ? 'rounded-xl border border-primary/40 bg-card p-4 shadow-sm' : 'rounded-xl border bg-card p-4'}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg sm:size-24">
          <SmartImage
            src={ep.coverImage}
            alt={ep.title}
            className="h-full w-full object-cover"
            fallbackLabel={t('podcasts.fallback')}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
            {t('podcasts.season')} {ep.season} · {t('podcasts.episode')} {ep.episode}
          </p>
          <h3 className="mt-0.5 font-editorial text-lg font-bold leading-snug">{ep.title}</h3>
          {ep.guests ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{t('podcasts.with')} {ep.guests}</p>
          ) : null}
          {ep.description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">{ep.description}</p>
          ) : null}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{ep.duration || '—'}</span>
            <span aria-hidden="true">·</span>
            <span>{relative(ep.publishedAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{ep.plays} {t('podcasts.listens')}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleLater}
            aria-label={later ? t('podcasts.removedLater') : t('podcasts.listenLater')}
            title={t('podcasts.listenLater')}
            className="size-11 rounded-full"
          >
            {later ? <Check className="size-5 text-primary" /> : <BookmarkPlus className="size-5" />}
          </Button>
          <Button
            onClick={() => playEp(ep)}
            className="size-11 rounded-full p-0"
            aria-label={isPlaying ? `${t('podcasts.pauseEpisode')} ${ep.title}` : `${t('podcasts.play')} ${ep.title}`}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
          </Button>
        </div>
      </div>
    </li>
  );
}

export function PodcastsPage() {
  const { t } = useI18n();
  const [collections, setCollections] = useState<PodcastCollection[] | null>(null);
  const [episodes, setEpisodes] = useState<PodcastItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chargement : arbre des collections + tous les épisodes (groupés côté client)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      publicApi.podcastCollections().catch(() => ({ collections: [] as PodcastCollection[] })),
      publicApi.podcasts({ page: 1, limit: 200 }),
    ])
      .then(([cols, pods]) => {
        if (cancelled) return;
        setCollections(cols.collections);
        setEpisodes(pods.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('article.loadingError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    publicApi.track('PAGE_VIEW', '/podcasts');
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hiérarchie mère/fille : épisodes groupés par collectionId
  const tree = useMemo<CollectionNode[]>(() => {
    if (!collections || !episodes) return [];
    const byParent = new Map<string | null, PodcastCollection[]>();
    for (const c of collections) {
      const list = byParent.get(c.parentId ?? null) ?? [];
      list.push(c);
      byParent.set(c.parentId ?? null, list);
    }
    const build = (col: PodcastCollection): CollectionNode => {
      const children = (byParent.get(col.id) ?? []).sort((a, b) => a.order - b.order).map(build);
      const direct = episodes.filter((e) => e.collectionId === col.id);
      return { ...col, episodes: direct, children };
    };
    return (byParent.get(null) ?? []).sort((a, b) => a.order - b.order).map(build);
  }, [collections, episodes]);

  // Épisodes hors hiérarchie → regroupés par saison (« Saison N »)
  const seasonGroups = useMemo<SeasonGroup[]>(() => {
    if (!collections || !episodes) return [];
    const known = new Set<string>();
    const walk = (cols: PodcastCollection[]) => {
      for (const c of cols) {
        known.add(c.id);
        if (c.children) walk(c.children);
      }
    };
    walk(collections);
    const orphans = episodes.filter((e) => !e.collectionId || !known.has(e.collectionId));
    const bySeason = new Map<number, PodcastItem[]>();
    for (const e of orphans) {
      const list = bySeason.get(e.season) ?? [];
      list.push(e);
      bySeason.set(e.season, list);
    }
    return Array.from(bySeason.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([season, eps]) => ({
        key: `season-${season}`,
        label: `${t('podcasts.season')} ${season}`,
        episodes: eps.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
      }));
  }, [collections, episodes, t]);

  const hasContent = tree.length > 0 || seasonGroups.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">{t('podcasts.eyebrow')}</p>
          <h1 className="font-editorial text-3xl font-bold sm:text-4xl">{t('podcasts.title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('podcasts.intro')}</p>
        </div>
        <a
          href="/api/rss"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
        >
          <Rss className="size-4 text-primary" aria-hidden="true" />
          {t('podcasts.rss')}
        </a>
      </header>

      {error ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-xl border bg-card p-4">
              <div className="skeleton-shimmer size-20 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-4 w-24 rounded" />
                <div className="skeleton-shimmer h-5 w-2/3 rounded" />
                <div className="skeleton-shimmer h-3 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !hasContent ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Headphones className="mx-auto size-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-3 font-editorial text-xl font-bold">{t('podcasts.none')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('podcasts.noneDesc')}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Navigation collections (accordion mère/fille) */}
          {tree.length > 0 ? (
            <section aria-label={t('podcasts.collections')}>
              <p className="eyebrow mb-1 text-primary">{t('podcasts.collections')}</p>
              <Accordion type="multiple" defaultValue={tree.map((c) => c.id)}>
                {tree.map((col) => {
                  const total =
                    col.episodes.length + col.children.reduce((n, ch) => n + ch.episodes.length, 0);
                  return (
                    <AccordionItem key={col.id} value={col.id}>
                      <AccordionTrigger className="text-left">
                        <span>
                          <span className="font-editorial text-lg font-bold">{col.title}</span>
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {total} {t('podcasts.episodes')}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {col.description ? (
                          <p className="mb-4 text-sm text-muted-foreground">{col.description}</p>
                        ) : null}
                        {col.episodes.length > 0 ? (
                          <ul className="space-y-4">
                            {col.episodes.map((ep) => (
                              <EpisodeRow key={ep.id} ep={ep} />
                            ))}
                          </ul>
                        ) : null}
                        {col.children.length > 0 ? (
                          <div className={col.episodes.length > 0 ? 'mt-6 space-y-4' : 'space-y-4'}>
                            {col.children.map((child) => (
                              <div key={child.id} className="rounded-xl border bg-background/40 p-4">
                                <p className="eyebrow text-primary">{child.title}</p>
                                {child.description ? (
                                  <p className="mt-1 text-sm text-muted-foreground">{child.description}</p>
                                ) : null}
                                <ul className="mt-4 space-y-4">
                                  {child.episodes.map((ep) => (
                                    <EpisodeRow key={ep.id} ep={ep} />
                                  ))}
                                </ul>
                                {child.episodes.length === 0 ? (
                                  <p className="mt-3 text-sm text-muted-foreground">{t('podcasts.noneDesc')}</p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {col.episodes.length === 0 && col.children.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('podcasts.noneDesc')}</p>
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </section>
          ) : null}

          {/* Épisodes hors collection, regroupés par saison */}
          {seasonGroups.length > 0 ? (
            seasonGroups.map((g) => (
              <section key={g.key} aria-label={g.label}>
                <p className="eyebrow mb-1 text-primary">{g.label}</p>
                <h2 className="font-editorial text-xl font-bold leading-tight sm:text-2xl">{g.label}</h2>
                <div className="mt-1.5 mb-5 h-0.5 w-10 rounded-full bg-primary" aria-hidden="true" />
                <ul className="space-y-4">
                  {g.episodes.map((ep) => (
                    <EpisodeRow key={ep.id} ep={ep} />
                  ))}
                </ul>
              </section>
            ))
          ) : null}
        </div>
      )}
    </div>
  );
}
