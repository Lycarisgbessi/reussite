'use client';

// ═══════════════════════════════════════════════════════════════
// PODCASTS PAGE — liste des épisodes + lecteur audio HTML5 persistant
// (play/pause, progression, vitesse), comptage des écoutes,
// « Écouter plus tard », lien flux RSS.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Check, Headphones, Pause, Play, Rss } from 'lucide-react';
import { publicApi, type PaginatedPodcasts } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { PodcastItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { SmartImage } from '../mag/SmartImage';
import { Pagination } from '../mag/Pagination';
import { fmtTime, frRelative } from '../mag/helpers';

const LATER_KEY = 'bh_listen_later';

export function PodcastsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<PaginatedPodcasts | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<PodcastItem | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [later, setLater] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(LATER_KEY) || '[]');
    } catch {
      return [];
    }
  });

  // Reset du chargement quand la page change (pattern React : reset au rendu)
  const [prevPage, setPrevPage] = useState(page);
  if (prevPage !== page) {
    setPrevPage(page);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    publicApi
      .podcasts({ page, limit: 8 })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    publicApi.track('PAGE_VIEW', '/podcasts');
    return () => {
      cancelled = true;
    };
  }, [page]);

  // Lecture automatique au changement d'épisode
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.playbackRate = rate;
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [current]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const togglePlay = (ep: PodcastItem) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (current?.id === ep.id) {
      if (audio.paused) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
      return;
    }
    setCurrent(ep);
    setTime(0);
    setDuration(0);
    publicApi.incrementPodcastPlay(ep.id).catch(() => {});
  };

  const togglePlayCurrent = () => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };

  const toggleLater = (ep: PodcastItem) => {
    const has = later.includes(ep.id);
    const next = has ? later.filter((id) => id !== ep.id) : [...later, ep.id];
    setLater(next);
    localStorage.setItem(LATER_KEY, JSON.stringify(next));
    toast({ title: has ? 'Retiré de « Écouter plus tard »' : 'Ajouté à « Écouter plus tard »' });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">Format audio</p>
          <h1 className="font-editorial text-3xl font-bold sm:text-4xl">Podcasts</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Les grands entretiens et analyses du magazine, à écouter où que vous soyez.
          </p>
        </div>
        <a
          href="/api/rss"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
        >
          <Rss className="size-4 text-primary" aria-hidden="true" />
          Flux RSS
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
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <Headphones className="mx-auto size-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="mt-3 font-editorial text-xl font-bold">Aucun épisode disponible</p>
          <p className="mt-2 text-sm text-muted-foreground">Le premier épisode arrive bientôt.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {data.items.map((ep) => {
              const isCurrent = current?.id === ep.id;
              return (
                <li
                  key={ep.id}
                  className={
                    isCurrent
                      ? 'rounded-xl border border-primary/40 bg-card p-4 shadow-sm'
                      : 'rounded-xl border bg-card p-4'
                  }
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <div className="relative size-20 shrink-0 overflow-hidden rounded-lg sm:size-24">
                      <SmartImage
                        src={ep.coverImage}
                        alt={ep.title}
                        className="h-full w-full object-cover"
                        fallbackLabel="Podcast"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                        Saison {ep.season} · Épisode {ep.episode}
                      </p>
                      <h2 className="mt-0.5 font-editorial text-lg font-bold leading-snug">{ep.title}</h2>
                      {ep.guests ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">Avec : {ep.guests}</p>
                      ) : null}
                      {ep.description ? (
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                          {ep.description}
                        </p>
                      ) : null}
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{ep.duration || '—'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{frRelative(ep.publishedAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{ep.plays} écoutes</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleLater(ep)}
                        aria-label={later.includes(ep.id) ? 'Retirer de « Écouter plus tard »' : 'Écouter plus tard'}
                        title="Écouter plus tard"
                        className="size-11 rounded-full"
                      >
                        {later.includes(ep.id) ? (
                          <Check className="size-5 text-primary" />
                        ) : (
                          <BookmarkPlus className="size-5" />
                        )}
                      </Button>
                      <Button
                        onClick={() => togglePlay(ep)}
                        className="size-11 rounded-full p-0"
                        aria-label={isCurrent && playing ? `Mettre en pause ${ep.title}` : `Écouter ${ep.title}`}
                      >
                        {isCurrent && playing ? <Pause className="size-5" /> : <Play className="ml-0.5 size-5" />}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Lecteur persistant */}
      {current ? (
        <div
          className="sticky bottom-4 z-30 mt-8 flex items-center gap-3 rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur"
          role="region"
          aria-label="Lecteur audio"
        >
          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
            <SmartImage
              src={current.coverImage}
              alt={current.title}
              className="h-full w-full object-cover"
              fallbackLabel="♪"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{current.title}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {fmtTime(time)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(time, duration || 0)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTime(v);
                  if (audioRef.current) audioRef.current.currentTime = v;
                }}
                className="h-1.5 flex-1 cursor-pointer accent-[var(--primary)]"
                aria-label="Progression de la lecture"
              />
              <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {fmtTime(duration)}
              </span>
            </div>
          </div>
          <Button
            size="icon"
            onClick={togglePlayCurrent}
            aria-label={playing ? 'Mettre en pause' : 'Reprendre la lecture'}
            className="size-10 shrink-0 rounded-full"
          >
            {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRate((r) => (r === 1 ? 1.5 : 1))}
            aria-label="Vitesse de lecture"
            className="h-10 shrink-0 rounded-full px-3 text-xs font-semibold"
          >
            {rate}×
          </Button>
        </div>
      ) : null}

      {/* Élément audio réel */}
      <audio
        ref={audioRef}
        src={current?.audioUrl || undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
        className="hidden"
      />
    </div>
  );
}
