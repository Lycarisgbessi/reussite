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
import { Megaphone, X } from 'lucide-react';
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

  // Rotation automatique : créas + slide « réservez cet espace »
  // intercalé dès qu'il y a de la place (toujours si 0 ou 1 créa).
  const promoCount = banners.length >= 3 ? 0 : 1;
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
  const onClick = () => {
    if (currentBanner && !isPromoSlide) publicApi.adClick(currentBanner.id).catch(() => {});
  };

  const adLabel = `Publicité ${currentBanner?.advertiser || ''}`.trim();
  const isVideoSlide = !isPromoSlide && currentBanner?.mediaType === 'VIDEO' && currentBanner.videoUrl;

  return (
    <div
      className={cn('group relative', SIZE_CLASSES[placement] || '', className)}
      role="complementary"
      aria-label="Espace publicitaire"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      <div className="relative h-full w-full overflow-hidden">
        {isPromoSlide ? (
          /* ── Slide « réservez cet espace » — animé, incite à publiciter ── */
          <a
            href="#/contact"
            className="ad-slide flex h-full w-full items-center justify-center gap-4 bg-ad-gradient px-5 text-center"
            aria-label="Réserver cet espace publicitaire"
          >
            <span className="relative hidden shrink-0 items-center justify-center sm:flex">
              <span className="ad-float flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/40" aria-hidden="true">
                <Megaphone className="size-6" />
              </span>
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="ad-slide-up block font-editorial text-base font-bold leading-tight text-foreground sm:text-lg">
                Votre marque ici ?
              </span>
              <span className="ad-slide-up mt-1 block text-xs leading-snug text-muted-foreground sm:text-[13px]" style={{ animationDelay: '120ms' }}>
                Réservez cet espace publicitaire et touchez des milliers de décideurs.
              </span>
              <span className="ad-slide-up mt-2 inline-block rounded-full bg-primary px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-md shadow-primary/30 cta-pulse" style={{ animationDelay: '220ms' }}>
                Réserver cet espace
              </span>
            </span>
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
