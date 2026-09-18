'use client';

// ═══════════════════════════════════════════════════════════════
// AD SLOT — emplacements publicitaires (section 6 du CDC)
// HEADER_BANNER · SIDEBAR_TOP · SIDEBAR_STICKY · IN_ARTICLE ·
// NATIVE · FOOTER_BANNER · STICKY_MOBILE · INTERSTITIAL
// Respecte les flags settings.ads*Enabled + tracking impressions/clics.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { publicApi } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import type { AdBanner, SiteSettings } from '@/lib/types';
import { cn } from '@/lib/utils';
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
  HEADER_BANNER: 'mx-auto h-16 w-full max-w-3xl overflow-hidden rounded-md border bg-card md:h-20',
  SIDEBAR_TOP: 'h-[250px] w-full overflow-hidden rounded-md border bg-card',
  SIDEBAR_STICKY: 'h-[600px] w-full overflow-hidden rounded-md border bg-card',
  IN_ARTICLE: 'mx-auto h-[250px] w-full max-w-[336px] overflow-hidden rounded-md border bg-card',
  NATIVE: 'aspect-[4/3] w-full',
  FOOTER_BANNER: 'mx-auto h-16 w-full max-w-3xl overflow-hidden rounded-md border bg-card md:h-20',
};

interface AdSlotProps {
  placement: string;
  className?: string;
  /** Ciblage par rubrique (in-article, natifs…). */
  category?: string;
  label?: string;
}

export function AdSlot({ placement, className, category, label = 'Publicité' }: AdSlotProps) {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const [banner, setBanner] = useState<AdBanner | null>(null);
  const [done, setDone] = useState(false);

  const enabled = !settings || !PLACEMENT_FLAGS[placement] || Boolean(settings[PLACEMENT_FLAGS[placement]]);

  // Réinitialisation quand l'emplacement change (pattern React : reset au rendu)
  const slotKey = `${placement}|${category || ''}|${enabled}`;
  const [prevKey, setPrevKey] = useState(slotKey);
  if (prevKey !== slotKey) {
    setPrevKey(slotKey);
    setBanner(null);
    setDone(false);
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    publicApi
      .ad(placement, category)
      .then((res) => {
        if (!cancelled) {
          setBanner(res.banner || null);
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

  if (!done || !enabled || !banner) return null;

  const onClick = () => {
    publicApi.adClick(banner.id).catch(() => {});
  };

  const creative = banner.imageUrl ? (
    <a
      href={banner.targetUrl || '#'}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={onClick}
      className="block h-full w-full overflow-hidden rounded-lg"
      aria-label={`Publicité ${banner.advertiser || ''}`}
    >
      <SmartImage
        src={banner.imageUrl}
        alt={`Publicité ${banner.advertiser || ''}`}
        className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
      />
    </a>
  ) : banner.htmlCode ? (
    <div
      className="h-full w-full overflow-hidden"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: banner.htmlCode }}
    />
  ) : null;

  if (!creative) return null;

  return (
    <div
      className={cn('relative', SIZE_CLASSES[placement] || '', className)}
      role="complementary"
      aria-label="Espace publicitaire"
    >
      {creative}
      <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white/90">
        {placement === 'NATIVE' ? 'Sponsorisé' : label}
      </span>
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

  if (!enabled || closed || !banner || !banner.imageUrl) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:hidden"
      role="complementary"
      aria-label="Publicité"
    >
      <a
        href={banner.targetUrl || '#'}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={() => publicApi.adClick(banner.id).catch(() => {})}
        className="block h-[50px] w-full overflow-hidden"
        aria-label={`Publicité ${banner.advertiser || ''}`}
      >
        <SmartImage
          src={banner.imageUrl}
          alt={`Publicité ${banner.advertiser || ''}`}
          className="h-[50px] w-full object-cover"
        />
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
          if (res.banner && (res.banner.imageUrl || res.banner.htmlCode)) {
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
        {banner.imageUrl ? (
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
