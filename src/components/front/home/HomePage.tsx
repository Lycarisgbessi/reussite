'use client';

// ═══════════════════════════════════════════════════════════════
// HOME PAGE — Hero (À la Une), derniers articles + sidebar (pubs,
// populaires), blocs thématiques, vidéos, podcasts, partenaires,
// CTA newsletter. Chargement paginé « Plus d'articles ».
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { Clock3, Headphones, Loader2, Mail, Play, Users , ChevronRight , Mic } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import type { ArticleSummary, PodcastItem, VideoItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArticleCard } from '../mag/ArticleCard';
import { Reveal } from '../mag/Reveal';
import { SectionTitle } from '../mag/SectionTitle';
import { SmartImage } from '../mag/SmartImage';
import { DrawCheck } from '../mag/DrawCheck';
import { HomeSkeleton } from '../mag/Skeletons';
import { AdSlot } from '../ads/AdSlot';
import { HeroSlider } from './HeroSlider';
import { CategoryBlocks } from './CategoryBlocks';
import { isValidEmail } from '../mag/helpers';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useI18n } from '@/lib/i18n';

interface HomeData {
  featured: ArticleSummary[];
  latest: ArticleSummary[];
  popular: ArticleSummary[];
  categoryBlocks: { category: import('@/lib/types').Category; articles: ArticleSummary[] }[];
  latestVideos: VideoItem[];
  latestPodcasts: PodcastItem[];
  partners: { id: string; imageUrl: string; htmlCode: string; targetUrl: string; advertiser: string }[];
}

export function HomePage() {
  useDocumentTitle(null);
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const { toast } = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<ArticleSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  // Interviews mises en avant en tête de sidebar (rubrique « Interview »,
  // repli sur l'ancienne rubrique « Interviews & Portraits »).
  const [interviews, setInterviews] = useState<ArticleSummary[]>([]);
  useEffect(() => {
    let cancelled = false;
    publicApi
      .articles({ category: 'interview', limit: 12 })
      .then((r) => {
        if (cancelled) return;
        if (r.articles.length > 0) setInterviews(r.articles);
        else return publicApi.articles({ category: 'interviews-portraits', limit: 12 }).then((r2) => {
          if (!cancelled) setInterviews(r2.articles);
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = () => {
    setError(null);
    publicApi
      .homepage()
      .then((res) => {
        setData(res);
        publicApi.track('PAGE_VIEW', '/');
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('article.loadingError')));
  };

  useEffect(load, []);

  const allLatest = useMemo(() => {
    if (!data) return [];
    const ids = new Set(data.latest.map((a) => a.id));
    return [...data.latest, ...extra.filter((a) => !ids.has(a.id))];
  }, [data, extra]);

  const hasMore = data ? (totalPages > 0 ? page < totalPages : data.latest.length >= 12) : false;

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await publicApi.articles({ page: page + 1, limit: 12 });
      setExtra((prev) => [...prev, ...res.articles]);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (e) {
      toast({
        title: t('form.error'),
        description: e instanceof Error ? e.message : t('home.loadMoreError'),
        variant: 'destructive',
      });
    } finally {
      setLoadingMore(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-editorial text-xl font-bold">{t('home.loadError')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-6" onClick={load}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (!data) return <HomeSkeleton />;

  return (
    <div className="pb-4">
      <HeroSlider articles={data.featured} />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        {/* ── Derniers articles + sidebar ──────────────────────── */}
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionTitle eyebrow={t('home.latestEyebrow')} title={t('home.latestTitle')} />
            <div className="grid gap-5 sm:grid-cols-2">
              {allLatest.map((article, i) => (
                <Reveal key={article.id} delay={(i % 4) * 60}>
                  <ArticleCard article={article} variant="grid" />
                </Reveal>
              ))}
            </div>
            {hasMore ? (
              <div className="mt-8 text-center">
                <Button
                  variant="outline"
                  size="lg"
                  disabled={loadingMore}
                  onClick={loadMore}
                  className="min-h-[44px] rounded-full px-8"
                >
                  {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                  {t('home.moreArticles')}
                </Button>
              </div>
            ) : null}
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            {/* ── INTERVIEWS — bloc signature, attirance immédiate sans excès ── */}
            {interviews.length > 0 ? (
              <section
                aria-label="Interviews"
                className="overflow-hidden rounded-xl border-2 border-primary/70 shadow-lg shadow-primary/10"
              >
                {/* Bandeau rouge signature */}
                <header className="flex items-center justify-between gap-2 bg-primary px-4 py-2.5 text-white">
                  <span className="flex items-center gap-2">
                    <Mic className="size-4" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                    <span className="text-[13px] font-bold uppercase tracking-[0.18em]">Interviews</span>
                  </span>
                  <a href="#/category/interview" className="text-[11px] font-semibold uppercase tracking-wide text-white/85 transition-colors hover:text-white">
                    {t('common.seeAll')} →
                  </a>
                </header>

                {/* Interview vedette : grande image + titre éditorial */}
                {(() => {
                  const hero = interviews[0];
                  return (
                    <a href={`#/article/${hero.slug}`} className="group relative block">
                      {hero.coverImage ? (
                        <img
                          src={hero.coverImage}
                          alt={hero.title}
                          className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          loading="lazy"
                        />
                      ) : (
                        <div className="aspect-[16/10] w-full bg-gradient-to-br from-primary/25 to-secondary" />
                      )}
                      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden="true" />
                      <span className="absolute inset-x-0 bottom-0 block p-3.5">
                        <span className="mb-1 block font-editorial text-2xl leading-none text-primary" aria-hidden="true">“</span>
                        <span className="line-clamp-3 block font-editorial text-[15.5px] font-bold leading-snug text-white">
                          {hero.title}
                        </span>
                        <span className="mt-1.5 block text-[11px] font-medium uppercase tracking-wide text-white/80">
                          {hero.author?.name} · {hero.readingTime} {t('common.min')}
                        </span>
                      </span>
                      <span className="absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
                        À la une
                      </span>
                    </a>
                  );
                })()}

                {/* Interviews suivantes : balayage animé — fenêtre de 3 qui
                    défile pour ramener les anciennes interviews à la vue */}
                <InterviewTicker items={interviews.slice(1)} />
              </section>
            ) : null}


            <AdSlot placement="SIDEBAR_TOP" />

            {/* ── TENDANCES : désormais sous les interviews ── */}
            <section aria-label={t('home.popularTitle')}>
              <SectionTitle eyebrow={t('home.popularEyebrow')} title={t('home.popularTitle')} />
              <div>
                {data.popular.slice(0, 5).map((article, i) => (
                  <ArticleCard key={article.id} article={article} variant="ranked" rank={i + 1} />
                ))}
              </div>
            </section>

            <div className="sticky top-24">
              <AdSlot placement="SIDEBAR_STICKY" />
            </div>
          </aside>
        </div>

        {/* ── Blocs thématiques ─────────────────────────────────── */}
        <div className="mt-12">
          <CategoryBlocks blocks={data.categoryBlocks} />
        </div>

        {/* ── Dernières vidéos ──────────────────────────────────── */}
        {data.latestVideos.length > 0 ? (
          <Reveal className="mt-12">
            <section aria-label={t('home.videosTitle')}>
              <SectionTitle eyebrow={t('videos.eyebrow')} title={t('home.videosTitle')} seeAllHref="/videos" />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.latestVideos.slice(0, 3).map((video) => (
                  <a
                    key={video.id}
                    href="#/videos"
                    className="article-card group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <SmartImage
                        src={video.thumbnailUrl || (video.youtubeId ? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg` : '')}
                        alt={video.title}
                        className="h-full w-full object-cover"
                        fallbackLabel={t('home.videoFallback')}
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      >
                        <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-black">
                          <Play className="ml-0.5 size-5" />
                        </span>
                      </div>
                      {video.duration ? (
                        <span className="absolute bottom-2 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
                          {video.duration}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
                        {video.playlist || t('home.videoFallback')}
                      </p>
                      <h3 className="mt-1 font-editorial text-[15px] font-bold leading-snug transition-colors group-hover:text-primary">
                        <span className="line-clamp-2">{video.title}</span>
                      </h3>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </Reveal>
        ) : null}

        {/* ── Derniers podcasts ─────────────────────────────────── */}
        {data.latestPodcasts.length > 0 ? (
          <Reveal className="mt-12">
            <section aria-label={t('home.podcastsTitle')}>
              <SectionTitle eyebrow={t('podcasts.eyebrow')} title={t('home.podcastsTitle')} seeAllHref="/podcasts" />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {data.latestPodcasts.slice(0, 3).map((pod) => (
                  <a
                    key={pod.id}
                    href="#/podcasts"
                    className="article-card group flex min-w-0 gap-3.5 overflow-hidden rounded-lg border bg-card p-3"
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-md sm:size-16">
                      <SmartImage
                        src={pod.coverImage}
                        alt={pod.title}
                        className="h-full w-full object-cover"
                        fallbackLabel={t('home.podcastFallback')}
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      >
                        <Play className="size-5 text-white" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
                        S{pod.season} · {t('podcasts.episode')} {pod.episode}
                      </p>
                      <h3 className="mt-0.5 font-editorial text-[13px] font-bold leading-snug transition-colors group-hover:text-primary sm:text-sm">
                        <span className="line-clamp-2">{pod.title}</span>
                      </h3>
                      <p className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-[11px] text-muted-foreground">
                        <Clock3 className="size-3 shrink-0" aria-hidden="true" />
                        {pod.duration || '—'}
                        {pod.guests ? <span className="min-w-0 truncate">· {pod.guests}</span> : null}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </Reveal>
        ) : null}

        {/* ── Partenaires / sponsorisés ─────────────────────────── */}
        {data.partners.length > 0 ? (
          <Reveal className="mt-12">
            <section aria-label={t('home.partnersTitle')}>
              <SectionTitle
                eyebrow={t('home.partnersEyebrow')}
                title={settings?.partnersTitle || t('home.partnersTitle')}
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {data.partners.slice(0, 6).map((p, i) => (
                  <a
                    key={p.id || i}
                    href={p.targetUrl || '#'}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    onClick={() => publicApi.adClick(p.id).catch(() => {})}
                    className="article-card relative block min-w-0 overflow-hidden rounded-lg border bg-card"
                    aria-label={`${t('home.partner')} ${p.advertiser || ''}`}
                  >
                    {p.imageUrl ? (
                      <SmartImage
                        src={p.imageUrl}
                        alt={`${t('home.partner')} ${p.advertiser || ''}`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <div
                        className="aspect-[4/3] w-full p-4"
                        dangerouslySetInnerHTML={{ __html: p.htmlCode || '' }}
                      />
                    )}
                    <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/90">
                      {t('ads.sponsored')}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          </Reveal>
        ) : null}

        {/* ── CTA newsletter ────────────────────────────────────── */}
        <Reveal className="mt-12">
          <NewsletterCta />
        </Reveal>
      </div>
    </div>
  );
}


// ─── Balayage des interviews : fenêtre de 3 qui tourne en continu ──
function InterviewTicker({ items }: { items: ArticleSummary[] }) {
  const { t } = useI18n();
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const visible = 3;
  const n = items.length;

  useEffect(() => {
    if (paused || n <= visible) return;
    const id = setInterval(() => setOffset((o) => (o + 1) % n), 3800);
    return () => clearInterval(id);
  }, [paused, n]);

  if (n === 0) return null;

  // Fenêtre cyclique : slice autour de offset
  const windowItems = Array.from({ length: Math.min(visible, n) }, (_, k) => items[(offset + k) % n]);

  return (
    <div
      className="relative divide-y divide-border/60 overflow-hidden bg-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Autres interviews"
    >
      {windowItems.map((article, k) => (
        <a
          key={`${article.id}-${offset}-${k}`}
          href={`#/article/${article.slug}`}
          className="interview-sweep group flex items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-secondary/60"
          style={{ animationDelay: `${k * 90}ms` }}
        >
          <Mic className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <h3 className="line-clamp-2 min-w-0 flex-1 text-[13.5px] font-semibold leading-snug transition-colors group-hover:text-primary">
            {article.title}
          </h3>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
        </a>
      ))}
      {n > visible ? (
        <button
          type="button"
          onClick={() => setOffset((o) => (o + 1) % n)}
          aria-label="Balayer d'autres interviews"
          className="flex w-full items-center justify-center gap-1.5 bg-primary/5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
        >
          Balayer les {n} interviews
          <ChevronRight className="size-3 animate-[sweep-arrow_1.6s_ease-in-out_infinite]" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

// ─── Bloc newsletter de la page d'accueil ───────────────────────
function NewsletterCta() {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const { toast } = useToast();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast({ title: t('form.invalidEmail'), variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await publicApi.subscribeNewsletter({ email: email.trim(), source: 'homepage' });
      setDone(true);
      toast({ title: t('form.subscribedTitle'), description: t('form.subscribedEmailDesc') });
    } catch (err) {
      toast({
        title: t('form.error'),
        description: err instanceof Error ? err.message : t('form.retryLater'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={t('footer.newsletter')}
      className="overflow-hidden rounded-xl border bg-gradient-to-br from-secondary via-card to-accent/40"
    >
      <div className="grid items-center gap-6 p-6 sm:gap-8 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-primary">{t('footer.newsletter')}</p>
          <h2 className="mt-1 font-editorial text-xl font-bold leading-tight sm:text-2xl">
            {settings?.newsletterHeroTitle || t('home.newsletterTitle')}
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            {settings?.newsletterHeroText || t('home.newsletterText')}
          </p>
          <div className="mt-3.5 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" aria-hidden="true" />
              {t('home.subscribersCount')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5 text-primary" aria-hidden="true" />
              {t('home.emailsPerWeek')}
            </span>
          </div>
        </div>
        {done ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
            <DrawCheck className="size-14" />
            <p className="font-editorial text-base font-bold">{t('footer.subscribed')}</p>
            <p className="text-[13px] text-muted-foreground">{t('home.thanksCommunity')}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2.5 sm:flex-row">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('form.emailPlaceholder')}
              aria-label={t('article.emailLabel')}
              className="h-11 flex-1 rounded-full"
            />
            <Button
              type="submit"
              disabled={busy}
              className="cta-pulse h-11 rounded-full px-7 text-sm font-semibold"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Headphones className="hidden" />}
              {busy ? t('home.subscribing') : t('home.subscribeCta')}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
