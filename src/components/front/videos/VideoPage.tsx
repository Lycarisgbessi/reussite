'use client';

// ═══════════════════════════════════════════════════════════════
// VIDEO PAGE — page dédiée #/video/:id : lecteur YouTube 16:9
// plein cadre, métadonnées, description, vidéos liées (playlist).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, Eye, Play } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { navigate } from '@/lib/store';
import { useDocumentTitle, useSocialMeta } from '@/hooks/use-document-title';
import { useI18n, useFormatDate } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import type { VideoItem } from '@/lib/types';
import { SmartImage } from '../mag/SmartImage';
import { formatViews } from '../mag/helpers';

export function VideoPage({ id }: { id: string }) {
  const { t } = useI18n();
  const { relative } = useFormatDate();
  const [video, setVideo] = useState<VideoItem | null>(null);
  useDocumentTitle(video?.title || t('videos.title'));
  useSocialMeta({
    title: video?.title,
    description: video?.description || undefined,
    image: video?.thumbnailUrl || undefined,
  });
  const [related, setRelated] = useState<VideoItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [prevId, setPrevId] = useState(id);
  if (prevId !== id) {
    setPrevId(id);
    setLoading(true);
    setError(null);
    setVideo(null);
  }

  useEffect(() => {
    let cancelled = false;
    window.scrollTo({ top: 0 });
    publicApi
      .video(id)
      .then((res) => {
        if (cancelled) return;
        setVideo(res.video);
        setRelated(res.related || []);
        publicApi.track('PAGE_VIEW', `/video/${id}`);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('article.loadingError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="skeleton-shimmer aspect-video w-full rounded-xl" />
        <div className="skeleton-shimmer mt-4 h-6 w-2/3 rounded" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-editorial text-2xl font-bold">{t('videos.none')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{error || t('videos.noneDesc')}</p>
        <Button variant="outline" className="mt-6 rounded-full" onClick={() => navigate('/videos')}>
          <ArrowLeft className="size-4" /> {t('nav.videos')}
        </Button>
      </div>
    );
  }

  return (
    <article>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Fil d'Ariane */}
        <nav aria-label={t('article.breadcrumb')} className="mb-4 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <a href="#/" className="transition-colors hover:text-primary">{t('nav.home')}</a>
          <ChevronRight className="size-3" aria-hidden="true" />
          <a href="#/videos" className="transition-colors hover:text-primary">{t('nav.videos')}</a>
          {video.playlist ? (
            <>
              <ChevronRight className="size-3" aria-hidden="true" />
              <span>{video.playlist}</span>
            </>
          ) : null}
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {/* Lecteur principal */}
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1`}
                title={video.title}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>

            {/* Titre + métadonnées */}
            <h1 className="mt-4 font-editorial text-2xl font-bold leading-tight sm:text-3xl">
              {video.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-y py-3 text-sm text-muted-foreground">
              {video.playlist ? (
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary">
                  {video.playlist}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Eye className="size-4" aria-hidden="true" />
                {formatViews(video.views)} {t('views')}
              </span>
              <span>{relative(video.publishedAt)}</span>
              {video.duration ? <span>{video.duration}</span> : null}
            </div>

            {video.description ? (
              <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-foreground/90">
                {video.description}
              </p>
            ) : null}
          </div>

          {/* Vidéos liées */}
          {related.length > 0 ? (
            <aside aria-label={t('article.relatedTitle')}>
              <p className="eyebrow mb-3 text-primary">{t('article.relatedEyebrow')}</p>
              <ul className="space-y-3">
                {related.map((v) => (
                  <li key={v.id}>
                    <a
                      href={`#/video/${v.id}`}
                      className="article-card group flex gap-3 rounded-xl border bg-card p-2"
                      aria-label={`${t('videos.play')} ${v.title}`}
                    >
                      <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg">
                        <SmartImage
                          src={v.thumbnailUrl || (v.youtubeId ? `https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg` : '')}
                          alt={v.title}
                          className="h-full w-full object-cover"
                          fallbackLabel="▶"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                          <Play className="size-6 text-white" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
                          {v.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatViews(v.views)} {t('views')} · {relative(v.publishedAt)}
                        </p>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>
    </article>
  );
}
