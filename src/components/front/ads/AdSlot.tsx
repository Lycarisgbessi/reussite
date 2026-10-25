'use client';

// ═══════════════════════════════════════════════════════════════
// AD SLOT — emplacements publicitaires (section 6 du CDC)
// HEADER_BANNER · SIDEBAR_TOP · SIDEBAR_STICKY · IN_ARTICLE ·
// NATIVE · FOOTER_BANNER · STICKY_MOBILE · INTERSTITIAL
// Respecte les flags settings.ads*Enabled + tracking impressions/clics.
// ANIMATION : rotation automatique entre les créas disponibles, et
// si une seule (ou aucune) créa est active, un slide « réservez cet
// espace » s'intercale pour inciter les visiteurs à publiciter.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { Clapperboard, Megaphone, TrendingUp, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { publicApi } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import type { AdBanner, SiteSettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useBottomLayers } from '@/lib/bottomLayers';
import { SmartImage } from '../mag/SmartImage';

/** Flag de settings correspondant à chaque emplacement. */
const PLACEMENT_FLAGS: Record<string, keyof SiteSettings> = {
  HEADER_BANNER: 'adsHeaderEnabled',
  SIDEBAR_TOP: 'adsSidebarEnabled',
  SIDEBAR_STICKY: 'adsSidebarEnabled',
  IN_ARTICLE: 'adsInArticleEnabled',
  NATIVE: 'adsNativeEnabled',
  FOOTER_BANNER: 'adsFooterEnabled',
  STICKY_MOBILE: 'adsStickyMobileEnabled',
  INTERSTITIAL: 'adsInterstitialEnabled',
};

/**
 * Classes de dimensions selon l'emplacement (CDC section 6.1).
 * Bannières header/footer : format « leaderboard » compact et centré.
 */
const SIZE_CLASSES: Record<string, string> = {
  HEADER_BANNER: 'mx-auto h-28 w-[calc(100%-1rem)] max-w-5xl overflow-hidden rounded-md border bg-card md:h-36',
  SIDEBAR_TOP: 'h-[250px] w-full overflow-hidden rounded-md border bg-card',
  SIDEBAR_STICKY: 'h-[600px] w-full overflow-hidden rounded-md border bg-card',
  IN_ARTICLE: 'mx-auto h-[170px] w-[calc(100%+2rem)] -mx-4 max-w-[680px] overflow-hidden rounded-md border bg-card md:h-[180px]',
  NATIVE: 'aspect-[4/3] w-full',
  FOOTER_BANNER: 'mx-auto h-28 w-[calc(100%-1rem)] max-w-5xl overflow-hidden rounded-md border bg-card md:h-36',
};

const ROTATE_MS = 5000;

interface AdSlotProps {
  placement: string;
  className?: string;
  /** Ciblage par rubrique (in-article, natifs…). */
  category?: string;
  label?: string;
}

export function AdSlot({ placement, className, category, label = 'Publicité' }: AdSlotProps) {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const [banners, setBanners] = useState<AdBanner[]>([]);
  const [done, setDone] = useState(false);
  const [slide, setSlide] = useState(0);
  const pausedRef = useRef(false);

  const enabled = !settings || !PLACEMENT_FLAGS[placement] || Boolean(settings[PLACEMENT_FLAGS[placement]]);

  // Réinitialisation quand l'emplacement change (pattern React : reset au rendu)
  const slotKey = `${placement}|${category || ''}|${enabled}`;
  const [prevKey, setPrevKey] = useState(slotKey);
  if (prevKey !== slotKey) {
    setPrevKey(slotKey);
    setBanners([]);
    setDone(false);
    setSlide(0);
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    publicApi
      .adMany(placement, category, 4)
      .then((res) => {
        if (!cancelled) {
          setBanners(res.banners);
          setDone(true);
        }
      })
      .catch(() => {
        if (!cancelled) setDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [placement, category, enabled]);

  // Rotation automatique : créas + slides auto-promo intercalés —
  // l'espace publicitaire fait SA propre publicité en continu, même
  // sans annonceur : c'est sa personnalité taquine.
  const promoCount = banners.length === 0 ? 3 : banners.length >= 3 ? 1 : 2;
  const totalSlides = banners.length + promoCount;

  useEffect(() => {
    if (totalSlides <= 1) return;
    const id = setInterval(() => {
      if (!pausedRef.current) setSlide((sl) => (sl + 1) % totalSlides);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [totalSlides]);

  if (!done || !enabled || totalSlides === 0) return null;

  const currentBanner = banners.length > 0 ? banners[slide % banners.length] : null;
  const isPromoSlide = currentBanner === null || slide >= banners.length;
  // Les slides auto-promo se relayaent entre elles (0=marque, 1=audience, 2=créa)
  const promoVariant = banners.length === 0 ? slide % 3 : (slide - banners.length + 3) % 3;
  const onClick = () => {
    if (currentBanner && !isPromoSlide) publicApi.adClick(currentBanner.id).catch(() => {});
  };

  const adLabel = `Publicité ${currentBanner?.advertiser || ''}`.trim();
  const isVideoSlide = !isPromoSlide && currentBanner?.mediaType === 'VIDEO' && currentBanner.videoUrl;

  return (
    <div
      className={cn('group relative ad-tease', SIZE_CLASSES[placement] || '', className)}
      role="complementary"
      aria-label="Espace publicitaire"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="relative h-full w-full overflow-hidden ad-creative-frame">
        {isPromoSlide ? (
          /* ── Slides auto-promo : 3 designs signature riches ── */
          <a
            href="#/contact"
            className={cn(
              'ad-slide relative flex h-full w-full items-center justify-center overflow-hidden px-5 text-center',
              promoVariant === 1
                ? 'bg-gradient-to-br from-primary via-primary/90 to-[#5d0d10] text-white'
                : 'bg-neutral-950 text-white',
            )}
            aria-label="Réserver cet espace publicitaire"
          >
            {/* Fond : halos + trame animée */}
            <span className="pointer-events-none absolute inset-0" aria-hidden="true">
              {promoVariant === 1 ? (
                <span className="absolute -left-10 -top-10 size-40 rounded-full bg-white/15 blur-3xl ad-float" />
              ) : (
                <>
                  <span className="absolute -right-8 -top-8 size-36 rounded-full bg-primary/30 blur-3xl" />
                  <span className="absolute -bottom-10 -left-6 size-32 rounded-full bg-primary/20 blur-3xl" />
                  <span className="ad-grid absolute inset-0 opacity-[0.14]" />
                </>
              )}
              <span className="teaser-sheen absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </span>

            {promoVariant === 2 ? (
              /* ── Design « Votre créa, en mouvement » : 3 mini-formats ── */
              <span className="relative flex w-full items-center justify-center gap-3">
                <span className="flex flex-col gap-2">
                  {[
                    { icon: Megaphone, label: 'BANNIÈRE', w: 'w-20' },
                    { icon: Clapperboard, label: 'VIDÉO', w: 'w-24' },
                    { icon: TrendingUp, label: 'NATIF', w: 'w-16' },
                  ].map(({ icon: Icon, label, w }, k) => (
                    <span
                      key={label}
                      className={cn(
                        'ad-slide-up flex h-8 items-center justify-center gap-1.5 rounded-md border border-white/25 bg-white/10 backdrop-blur-sm',
                        w,
                      )}
                      style={{ animationDelay: `${k * 130}ms` }}
                    >
                      <Icon className="size-3.5 text-white" aria-hidden="true" />
                      <span className="text-[9px] font-bold tracking-widest text-white">{label}</span>
                    </span>
                  ))}
                </span>
                <span className="max-w-[46%] text-left">
                  <span className="ad-slide-up block font-editorial text-base font-bold leading-tight sm:text-lg" style={{ animationDelay: '100ms' }}>
                    Votre créa, en mouvement.
                  </span>
                  <span className="ad-slide-up mt-1 block text-[11px] leading-snug text-white/75 sm:text-xs" style={{ animationDelay: '220ms' }}>
                    Elle tourne ici, toutes les 5 secondes, devant les décideurs.
                  </span>
                  <span className="ad-slide-up mt-2 inline-block rounded-full bg-white px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-primary cta-pulse" style={{ animationDelay: '320ms' }}>
                    Voir les formats
                  </span>
                </span>
              </span>
            ) : (
              <span className="relative flex w-full items-center justify-center gap-4">
                <span className="relative hidden shrink-0 items-center justify-center sm:flex">
                  <span className="ad-float flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/50" aria-hidden="true">
                    {promoVariant === 1 ? <TrendingUp className="size-6" /> : <Megaphone className="size-6" />}
                  </span>
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="ad-slide-up block font-editorial text-base font-bold leading-tight sm:text-lg" style={{ animationDelay: '60ms' }}>
                    {promoVariant === 1 ? 'Votre audience est ici.' : 'Votre marque ici ?'}
                  </span>
                  <span className="ad-slide-up mt-1 flex items-baseline gap-1.5" style={{ animationDelay: '150ms' }}>
                    <span className="ad-count text-2xl font-black tracking-tight text-white sm:text-3xl">10 000</span>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-white/75">lecteurs / mois</span>
                  </span>
                  <span className="ad-slide-up mt-1 block text-[11px] leading-snug text-white/75 sm:text-xs" style={{ animationDelay: '240ms' }}>
                    {promoVariant === 1
                      ? 'Des décideurs qui lisent, écoutent et regardent Réussite chaque semaine.'
                      : 'Réservez la une de nos espaces publicitaires les plus vus.'}
                  </span>
                  <span className="ad-slide-up mt-2 inline-block rounded-full bg-white px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-primary cta-pulse" style={{ animationDelay: '330ms' }}>
                    {promoVariant === 1 ? 'Lancer ma campagne' : 'Réserver cet espace'}
                  </span>
                </span>
              </span>
            )}
          </a>
        ) : isVideoSlide && currentBanner ? (
          <a
            href={currentBanner.targetUrl || '#'}
            target="_blank"
            rel="sponsored noopener noreferrer"
            onClick={onClick}
            className="ad-sweep block h-full w-full overflow-hidden rounded-lg"
            aria-label={adLabel}
          >
            <video
              src={currentBanner.videoUrl}
              muted
              loop
              autoPlay
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
              aria-label={adLabel}
            />
          </a>
        ) : currentBanner?.imageUrl ? (
          <a
            href={currentBanner.targetUrl || '#'}
            target="_blank"
            rel="sponsored noopener noreferrer"
            onClick={onClick}
            className="ad-sweep block h-full w-full overflow-hidden rounded-lg"
            aria-label={adLabel}
          >
            <SmartImage
              src={currentBanner.imageUrl}
              alt={adLabel}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
            />
          </a>
        ) : currentBanner?.htmlCode ? (
          <div
            className="ad-fade h-full w-full overflow-hidden"
            onClick={onClick}
            dangerouslySetInnerHTML={{ __html: currentBanner.htmlCode }}
          />
        ) : null}
      </div>

      {/* Étiquette + indicateurs de rotation */}
      <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/90">
        {isPromoSlide ? 'Publicité' : placement === 'NATIVE' ? 'Sponsorisé' : label}
      </span>
      {totalSlides > 1 ? (
        <span className="pointer-events-none absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1" aria-hidden="true">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 rounded-full transition-all',
                i === slide ? 'w-4 bg-white/90' : 'w-1 bg-white/45',
              )}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STICKY MOBILE — bannière fixe en bas d'écran (mobile uniquement)
// ═══════════════════════════════════════════════════════════════
export function StickyMobileAd() {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const [banner, setBanner] = useState<AdBanner | null>(null);
  const [closed, setClosed] = useState(false);

  const enabled = Boolean(settings?.adsStickyMobileEnabled);

  useEffect(() => {
    if (!enabled) return;
    publicApi
      .ad('STICKY_MOBILE')
      .then((res) => setBanner(res.banner))
      .catch(() => {});
  }, [enabled]);

  const playerVisible = useBottomLayers((st) => st.playerVisible);
  if (!enabled || closed || !banner || (!banner.imageUrl && !banner.videoUrl)) return null;
  const stickyLabel = `Publicité ${banner.advertiser || ''}`.trim();

  return (
    <div
      className={cn("fixed inset-x-0 z-30 border-t bg-card/95 backdrop-blur md:hidden transition-[bottom]", playerVisible ? "bottom-[86px]" : "bottom-0")}
      role="complementary"
      aria-label="Publicité"
    >
      <a
        href={banner.targetUrl || '#'}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => publicApi.adClick(banner.id).catch(() => {})}
        className="block h-[50px] w-full overflow-hidden"
        aria-label={stickyLabel}
      >
        {banner.mediaType === 'VIDEO' && banner.videoUrl ? (
          <video
            src={banner.videoUrl}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            className="h-[50px] w-full object-cover"
            aria-label={stickyLabel}
          />
        ) : (
          <SmartImage
            src={banner.imageUrl}
            alt={stickyLabel}
            className="h-[50px] w-full object-cover"
          />
        )}
      </a>
      <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-black/45 px-1 py-0.5 text-[8px] font-medium uppercase tracking-wider text-white/90">
        Publicité
      </span>
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Fermer la publicité"
        className="absolute -top-8 right-2 flex size-7 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INTERSTITIAL — pop-up plein écran, 1 fois par session
// ═══════════════════════════════════════════════════════════════
export function InterstitialAd() {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState<AdBanner | null>(null);

  const enabled = Boolean(settings?.adsInterstitialEnabled);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('bh_interstitial_seen') === '1') return;
    const timer = setTimeout(() => {
      publicApi
        .ad('INTERSTITIAL')
        .then((res) => {
          if (res.banner && (res.banner.imageUrl || res.banner.htmlCode || res.banner.videoUrl)) {
            setBanner(res.banner);
            setOpen(true);
            sessionStorage.setItem('bh_interstitial_seen', '1');
          }
        })
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, [enabled]);

  if (!banner) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Publicité</DialogTitle>
          <DialogDescription>Annonce de notre partenaire</DialogDescription>
        </DialogHeader>
        {banner.mediaType === 'VIDEO' && banner.videoUrl ? (
          <a
            href={banner.targetUrl || '#'}
            target="_blank"
            rel="sponsored noopener noreferrer"
            onClick={() => publicApi.adClick(banner.id).catch(() => {})}
            className="block w-full overflow-hidden"
            aria-label={`Publicité ${banner.advertiser || ''}`}
          >
            <video
              src={banner.videoUrl}
              muted
              loop
              autoPlay
              playsInline
              controls
              preload="metadata"
              className="max-h-[70vh] w-full bg-black object-contain"
              aria-label={`Publicité ${banner.advertiser || ''}`}
            />
          </a>
        ) : banner.imageUrl ? (
          <a
            href={banner.targetUrl || '#'}
            target="_blank"
            rel="sponsored noopener noreferrer"
            onClick={() => publicApi.adClick(banner.id).catch(() => {})}
            className="block w-full overflow-hidden"
            aria-label={`Publicité ${banner.advertiser || ''}`}
          >
            <SmartImage
              src={banner.imageUrl}
              alt={`Publicité ${banner.advertiser || ''}`}
              className="max-h-[70vh] w-full object-contain"
            />
          </a>
        ) : (
          <div
            className="p-4"
            dangerouslySetInnerHTML={{ __html: banner.htmlCode }}
          />
        )}
        <p className="pb-3 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
          Publicité — {banner.advertiser || 'Partenaire'}
        </p>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDE PEEK AD — encart publicitaire TAQUIN sur le flanc latéral
// droit : pendant la navigation, il se glisse depuis le bord,
// reste un moment, repart… puis revient plus tard. Pause au
// survol, fermable. Visible sur écrans larges uniquement.
// ═══════════════════════════════════════════════════════════════
import { motion } from 'framer-motion';

const PEEK_IN_MS = 11000;   // temps de présence
const PEEK_OUT_MS = 14000;  // temps d'absence avant de revenir
const PEEK_SPRING = { type: 'spring', stiffness: 110, damping: 16, mass: 0.9 } as const;

export function SidePeekAd() {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [closed, setClosed] = useState(false);
  const [armed, setArmed] = useState(false); // un peu de scroll d'abord

  useEffect(() => {
    try {
      if (sessionStorage.getItem('rm_sidepeek_closed') === '1') setClosed(true);
    } catch { /* ignore */ }
    const onScroll = () => setArmed(window.scrollY > 300);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (closed || !armed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const cycle = (shown: boolean) => {
      if (cancelled) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        if (hovered) { cycle(shown); return; } // survolé → il reste
        setVisible(!shown);
        cycle(!shown);
      }, shown ? PEEK_IN_MS : PEEK_OUT_MS);
    };
    // Première apparition rapide : il surprend le lecteur dès l'arrivée
    timer = setTimeout(() => { if (!cancelled) { setVisible(true); cycle(true); } }, 2500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [closed, armed, hovered]);

  if (closed || !armed) return null;

  const close = () => {
    setClosed(true);
    try { sessionStorage.setItem('rm_sidepeek_closed', '1'); } catch { /* ignore */ }
  };

  return (
    <motion.div
      className="fixed right-4 top-1/2 z-30 hidden w-[300px] -translate-y-1/2 xl:block"
      role="complementary"
      aria-label="Suggestion publicitaire"
      initial={{ x: '130%', opacity: 0, rotate: 2 }}
      animate={visible ? { x: 0, opacity: 1, rotate: 0 } : { x: '130%', opacity: 0, rotate: 3 }}
      transition={PEEK_SPRING}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="group relative rounded-xl p-[2px] shadow-[0_16px_50px_-12px_rgba(0,0,0,0.55)]"
        style={{ background: 'linear-gradient(135deg, rgba(164,22,26,0.9), rgba(255,255,255,0.25), rgba(164,22,26,0.55))' }}>
        <div className="overflow-hidden rounded-[10px] bg-card">
          <AdSlot placement="SIDEBAR_TOP" label="Suggestion" />
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute -left-2 -top-2 flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-colors hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </motion.div>
  );
}
