'use client';

// ═══════════════════════════════════════════════════════════════
// VIDEOS PAGE — sections par playlist (hiérarchisation) :
// chaque playlist a sa section (SectionTitle + grille de cartes).
// Les cartes sont des liens vers la page dédiée #/video/[id].
// Filtre par playlist en haut (filtre/scroll vers la section).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Play } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useI18n, useFormatDate } from '@/lib/i18n';
import type { VideoItem } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SmartImage } from '../mag/SmartImage';
import { SectionTitle } from '../mag/SectionTitle';
import { formatViews } from '../mag/helpers';

const PER_SECTION = 12;

interface Section {
  playlist: string;
  videos: VideoItem[];
}

export function VideosPage() {
  const { t } = useI18n();
  useDocumentTitle(t('videos.title'));
  const { relative } = useFormatDate();
  const [sections, setSections] = useState<Section[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Chargement : playlists une fois, puis vidéos de chaque playlist en parallèle
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { playlists } = await publicApi.videoPlaylists();
        const lists = playlists.filter(Boolean);
        const results = await Promise.all(
          lists.map((p) => publicApi.videos({ playlist: p, page: 1, limit: PER_SECTION }).catch(() => null)),
        );
        if (cancelled) return;
        setSections(
          lists
            .map((p, i) => ({ playlist: p, videos: results[i]?.items ?? [] }))
            .filter((s) => s.videos.length > 0),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('article.loadingError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    publicApi.track('PAGE_VIEW', '/videos');
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleSections = useMemo(
    () => (sections || []).filter((s) => filter === 'all' || s.playlist === filter),
    [sections, filter],
  );

  const onSelectPlaylist = (v: string) => {
    setFilter(v);
    // Scroll vers la section correspondante (vue « toutes » empilée)
    if (v !== 'all' && sectionRefs.current[v]) {
      sectionRefs.current[v]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const thumb = (v: VideoItem) =>
    v.thumbnailUrl || (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/hqdefault.jpg` : '');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <p className="eyebrow text-primary">{t('videos.eyebrow')}</p>
        <h1 className="font-editorial text-3xl font-bold sm:text-4xl">{t('videos.title')}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('videos.intro')}</p>
      </header>

      {/* Filtre playlist */}
      {sections && sections.length > 0 ? (
        <div className="mb-8">
          <Select value={filter} onValueChange={onSelectPlaylist}>
            <SelectTrigger className="h-11 w-full rounded-lg sm:w-64" aria-label={t('videos.filterPlaylist')}>
              <SelectValue placeholder={t('videos.allPlaylists')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('videos.allPlaylists')}</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s.playlist} value={s.playlist}>
                  {s.playlist}
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
        <div className="space-y-12">
          {Array.from({ length: 2 }).map((_, s) => (
            <section key={s}>
              <div className="mb-5 space-y-2">
                <div className="skeleton-shimmer h-3 w-24 rounded" />
                <div className="skeleton-shimmer h-6 w-48 rounded" />
              </div>
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
            </section>
          ))}
        </div>
      ) : visibleSections.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center">
          <p className="font-editorial text-xl font-bold">{t('videos.none')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('videos.noneDesc')}</p>
        </div>
      ) : (
        <div className="space-y-12">
          {visibleSections.map((section) => (
            <section
              key={section.playlist}
              ref={(el) => {
                sectionRefs.current[section.playlist] = el;
              }}
            >
              <SectionTitle eyebrow={t('videos.eyebrow')} title={section.playlist} />
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {section.videos.map((video) => (
                  <a
                    key={video.id}
                    href={`#/video/${video.id}`}
                    className="article-card group overflow-hidden rounded-xl border bg-card"
                    aria-label={`${t('videos.play')} ${video.title}`}
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <SmartImage
                        src={thumb(video)}
                        alt={video.title}
                        className="h-full w-full object-cover"
                        fallbackLabel={t('videos.fallback')}
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity group-hover:opacity-90"
                        aria-hidden="true"
                      >
                        <span className="flex size-14 items-center justify-center rounded-full bg-white/90 text-black shadow-lg transition-transform group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                          <Play className="ml-0.5 size-6" />
                        </span>
                      </div>
                      {video.duration ? (
                        <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
                          {video.duration}
                        </span>
                      ) : null}
                      <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                        {section.playlist}
                      </span>
                    </div>
                    <div className="p-4">
                      <h2 className="font-editorial text-base font-bold leading-snug transition-colors group-hover:text-primary">
                        <span className="line-clamp-2">{video.title}</span>
                      </h2>
                      <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="size-3.5" aria-hidden="true" />
                          {formatViews(video.views)} {t('views')}
                        </span>
                        <span>{relative(video.publishedAt)}</span>
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
