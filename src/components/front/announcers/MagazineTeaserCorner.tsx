'use client';

// ═══════════════════════════════════════════════════════════════
// MAGAZINE TEASER CORNER — encart animé fixe en bas à gauche de
// l'écran, qui attire l'attention sur les numéros du magazine :
// miniatures des unes qui se relaient + CTA vers la boutique.
// Discret (fermable), masqué sur mobile si le lecteur podcast est
// visible, n'apparaît qu'après un léger scroll.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, X } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useBottomLayers } from '@/lib/bottomLayers';
import { cn } from '@/lib/utils';

interface TeaserIssue { id: string; title: string; coverUrl: string; }

export function MagazineTeaserCorner() {
  const [issues, setIssues] = useState<TeaserIssue[]>([]);
  const [idx, setIdx] = useState(0);
  const [closed, setClosed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [bumped, setBumped] = useState(false);
  const playerVisible = useBottomLayers((st) => st.playerVisible);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('rm_teaser_closed') === '1') setClosed(true);
    } catch { /* ignore */ }
    publicApi
      .shop()
      .then((res) => {
        const list = res.issues.filter((i) => i.coverUrl).slice(0, 6);
        setIssues(list);
      })
      .catch(() => {});
  }, []);

  // Apparition après un léger scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Relayé des miniatures + « bump » périodique pour capter l'œil
  useEffect(() => {
    if (issues.length < 1) return;
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % issues.length);
      setBumped(true);
      setTimeout(() => setBumped(false), 700);
    }, 4200);
    return () => clearInterval(id);
  }, [issues.length]);

  if (closed || issues.length === 0 || !scrolled) return null;
  const current = issues[idx];

  const close = () => {
    setClosed(true);
    try { sessionStorage.setItem('rm_teaser_closed', '1'); } catch { /* ignore */ }
  };

  return (
    <div
      className={cn(
        'fixed left-3 z-30 hidden transition-[bottom] sm:block',
        playerVisible ? 'bottom-[104px]' : 'bottom-3',
      )}
      role="complementary"
      aria-label="Numéros du magazine"
    >
      <div
        className={cn(
          'relative flex items-center gap-3 overflow-hidden rounded-xl border-2 border-primary/70 bg-card pl-2 pr-3 py-2 shadow-xl shadow-primary/20 transition-transform duration-500',
          bumped && 'teaser-bump',
        )}
      >
        {/* Halo pulsé */}
        <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-primary/40 teaser-glow" aria-hidden="true" />

        <a href="#/shop" className="relative flex items-center gap-3" aria-label={`Découvrir le magazine : ${current.title}`}>
          <span className="relative block h-16 w-11 shrink-0 overflow-hidden rounded-md border border-primary/30 shadow-md">
            {issues.map((iss, i) => (
              <img
                key={iss.id}
                src={iss.coverUrl}
                alt=""
                className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-all duration-700',
                  i === idx ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
                )}
                loading="lazy"
              />
            ))}
          </span>
          <span className="max-w-44">
            <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
              <BookOpen className="size-3" aria-hidden="true" /> Le magazine
            </span>
            <span className="mt-0.5 line-clamp-2 block text-[12px] font-bold leading-tight">
              {current.title}
            </span>
            <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Feuilleter & commander
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </span>
          </span>
        </a>

        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>

        {/* Indicateurs de rotation */}
        <span className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5" aria-hidden="true">
          {issues.slice(0, 5).map((_, i) => (
            <span
              key={i}
              className={cn('h-0.5 rounded-full transition-all', i === idx % 5 ? 'w-3 bg-primary' : 'w-1 bg-primary/35')}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
