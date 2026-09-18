'use client';

// ═══════════════════════════════════════════════════════════════
// VIDEOS PAGE — grille de vidéos YouTube (miniatures + fallback),
// filtre par playlist, lecture en Dialog (embed autoplay), tri récent,
// pagination.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { Eye, Play } from 'lucide-react';
import { publicApi, type PaginatedVideos } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import type { VideoItem } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartImage } from '../mag/SmartImage';
import { Pagination } from '../mag/Pagination';
import { formatViews, frRelative } from '../mag/helpers';

export function VideosPage() {
  const [data, setData] = useState<PaginatedVideos | null>(null);
  const [page, setPage] = useState(1);
  const [playlist, setPlaylist] = useState('all');
  const [playlists, setPlaylists] = useState<string[]>([]);
  const [selected, setSelected] = useState<VideoItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset du chargement quand les filtres changent (pattern React : reset au rendu)
  const fetchKey = `${playlist}|${page}`;
  const [prevKey, setPrevKey] = useState(fetchKey);
  if (prevKey !== fetchKey) {
    setPrevKey(fetchKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    publicApi
      .videos({ playlist: playlist === 'all' ? undefined : playlist, page, limit: 12 })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setPlaylists((prev) =>
          Array.from(new Set([...prev, ...res.items.map((v) => v.playlist).filter(Boolean)])).sort(),
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    publicApi.track('PAGE_VIEW', '/videos');
    return () => {
      cancelled = true;
    };
  }, [playlist, page]);

  const thumb = (v: VideoItem) =>
    v.thumbnailUrl || (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : '');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <p className="eyebrow text-primary">Format vidéo</p>
        <h1 className="font-editorial text-3xl font-bold sm:text-4xl">Vidéos</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Interviews, décryptages et coulisses de l'économie en images.
        </p>
      </header>

      {/* Filtre playlist */}
      {playlists.length > 0 ? (
        <div className="mb-8">
          <Select
            value={playlist}
            onValueChange={(v) => {
              setPlaylist(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-11 w-full rounded-lg sm:w-64" aria-label="Filtrer par playlist">
              <SelectValue placeholder="Toutes les playlists" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les playlists</SelectItem>
              {playlists.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {error ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border bg-card">
              <div className="skeleton-shimmer aspect-video" />
              <div className="space-y-2 p-4">
                <div className="skeleton-shimmer h-4 w-3/4 rounded" />
                <div className="skeleton-shimmer h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="font-editorial text-xl font-bold">Aucune vidéo disponible</p>
          <p className="mt-2 text-sm text-muted-foreground">Revenez bientôt, la chaîne se prépare.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => setSelected(video)}
                className="article-card group overflow-hidden rounded-xl border bg-card text-left"
                aria-label={`Lire la vidéo ${video.title}`}
              >
                <div className="relative aspect-video overflow-hidden">
                  <SmartImage
                    src={thumb(video)}
                    alt={video.title}
                    className="h-full w-full object-cover"
                    fallbackLabel="Vidéo"
                  />
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity group-hover:opacity-90"
                    aria-hidden="true"
                  >
                    <span className="flex size-14 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform group-hover:scale-110">
                      <Play className="ml-0.5 size-6" />
                    </span>
                  </div>
                  {video.duration ? (
                    <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
                      {video.duration}
                    </span>
                  ) : null}
                  {video.playlist ? (
                    <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      {video.playlist}
                    </span>
                  ) : null}
                </div>
                <div className="p-4">
                  <h2 className="font-editorial text-base font-bold leading-snug transition-colors group-hover:text-primary">
                    <span className="line-clamp-2">{video.title}</span>
                  </h2>
                  <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="size-3.5" aria-hidden="true" />
                      {formatViews(video.views)} vues
                    </span>
                    <span>{frRelative(video.publishedAt)}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Lecteur en Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="pr-8 font-editorial text-lg font-bold leading-snug">
              {selected?.title}
            </DialogTitle>
            <DialogDescription>
              {selected?.playlist ? `Playlist : ${selected.playlist}` : 'Vidéo Business Horizon'}
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video w-full bg-black">
            {selected ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selected.youtubeId}?autoplay=1`}
                title={selected.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            ) : null}
          </div>
          {selected?.description ? (
            <div className="custom-scrollbar max-h-44 overflow-y-auto px-5 pb-5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {selected.description}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
