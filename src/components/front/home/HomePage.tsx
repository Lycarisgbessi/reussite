'use client';

// ═══════════════════════════════════════════════════════════════
// HOME PAGE — Hero (À la Une), derniers articles + sidebar (pubs,
// populaires), blocs thématiques, vidéos, podcasts, partenaires,
// CTA newsletter. Chargement paginé « Plus d'articles ».
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react';
import { Clock3, Headphones, Loader2, Mail, Play, Users } from 'lucide-react';
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
import { frRelative, isValidEmail } from '../mag/helpers';

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
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const { toast } = useToast();
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extra, setExtra] = useState<ArticleSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = () => {
    setError(null);
    publicApi
      .homepage()
      .then((res) => {
        setData(res);
        publicApi.track('PAGE_VIEW', '/');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur de chargement'));
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
        title: 'Erreur',
        description: e instanceof Error ? e.message : 'Impossible de charger plus d’articles.',
        variant: 'destructive',
      });
    } finally {
      setLoadingMore(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-editorial text-xl font-bold">Impossible de charger la page d'accueil</p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-6" onClick={load}>
          Réessayer
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
            <SectionTitle eyebrow="Actualités" title="Derniers articles" />
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
                  Plus d'articles
                </Button>
              </div>
            ) : null}
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            <AdSlot placement="SIDEBAR_TOP" />

            <section aria-label="Populaires de la semaine">
              <SectionTitle eyebrow="Tendance" title="Populaires de la semaine" />
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
            <section aria-label="Dernières vidéos">
              <SectionTitle eyebrow="Format vidéo" title="Dernières vidéos" seeAllHref="/videos" />
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
                        fallbackLabel="Vidéo"
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
                        {video.playlist || 'Vidéo'}
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
            <section aria-label="Derniers podcasts">
              <SectionTitle eyebrow="Format audio" title="Derniers podcasts" seeAllHref="/podcasts" />
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
                        fallbackLabel="Podcast"
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
                        S{pod.season} · Épisode {pod.episode}
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
            <section aria-label="Partenaires">
              <SectionTitle
                eyebrow="Ils nous soutiennent"
                title={settings?.partnersTitle || 'Nos partenaires'}
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
                    aria-label={`Partenaire ${p.advertiser || ''}`}
                  >
                    {p.imageUrl ? (
                      <SmartImage
                        src={p.imageUrl}
                        alt={`Partenaire ${p.advertiser || ''}`}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    ) : (
                      <div
                        className="aspect-[4/3] w-full p-4"
                        dangerouslySetInnerHTML={{ __html: p.htmlCode || '' }}
                      />
                    )}
                    <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/90">
                      Sponsorisé
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

// ─── Bloc newsletter de la page d'accueil ───────────────────────
function NewsletterCta() {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast({ title: 'Adresse email invalide', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await publicApi.subscribeNewsletter({ email: email.trim(), source: 'homepage' });
      setDone(true);
      toast({ title: 'Inscription confirmée', description: 'À très vite dans votre boîte mail !' });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Réessayez plus tard.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Newsletter"
      className="overflow-hidden rounded-xl border bg-gradient-to-br from-secondary via-card to-accent/40"
    >
      <div className="grid items-center gap-6 p-6 sm:gap-8 sm:p-8 lg:grid-cols-2">
        <div>
          <p className="eyebrow text-primary">Newsletter</p>
          <h2 className="mt-1 font-editorial text-xl font-bold leading-tight sm:text-2xl">
            {settings?.newsletterHeroTitle || "L'essentiel business, chaque semaine"}
          </h2>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
            {settings?.newsletterHeroText ||
              'Analyses exclusives, success stories et tendances à ne pas manquer. Rejoignez notre communauté de lecteurs.'}
          </p>
          <div className="mt-3.5 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 text-primary" aria-hidden="true" />
              +15 000 abonnés
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-3.5 text-primary" aria-hidden="true" />
              1 email / semaine
            </span>
          </div>
        </div>
        {done ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
            <DrawCheck className="size-14" />
            <p className="font-editorial text-base font-bold">Inscription confirmée !</p>
            <p className="text-[13px] text-muted-foreground">Merci de rejoindre la communauté Réussite Magazine.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2.5 sm:flex-row">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              aria-label="Adresse email"
              className="h-11 flex-1 rounded-full"
            />
            <Button
              type="submit"
              disabled={busy}
              className="cta-pulse h-11 rounded-full px-7 text-sm font-semibold"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Headphones className="hidden" />}
              {busy ? 'Inscription…' : "Je m'abonne"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
