'use client';

// ═══════════════════════════════════════════════════════════════
// MAGAZINE TEASER CORNER — encart éditorial fixe en bas à gauche,
// élégant et discret, qui met les numéros du magazine en avant :
// unes en fondu enchaîné, typographie serif, filet rouge signature.
// Apparaît en glissement après un léger scroll, fermable.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useBottomLayers } from '@/lib/bottomLayers';
import { cn } from '@/lib/utils';

interface TeaserIssue { id: string; title: string; coverUrl: string; }

export function MagazineTeaserCorner() {
  const [issues, setIssues] = useState<TeaserIssue[]>([]);
  const [idx, setIdx] = useState(0);
  const [closed, setClosed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const playerVisible = useBottomLayers((st) => st.playerVisible);

  useEffect(() => {
    try {
      if (sessionStorage.getItem('rm_teaser_closed') === '1') setClosed(true);
    } catch { /* ignore */ }
    publicApi
      .shop()
      .then((res) => {
        setIssues(res.issues.filter((i) => i.coverUrl).slice(0, 6));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fondu enchaîné lent, en pause au survol
  useEffect(() => {
    if (hovered || issues.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % issues.length), 5200);
    return () => clearInterval(id);
  }, [hovered, issues.length]);

  if (closed || issues.length === 0 || !scrolled) return null;
  const current = issues[idx];

  const close = () => {
    setClosed(true);
    try { sessionStorage.setItem('rm_teaser_closed', '1'); } catch { /* ignore */ }
  };

  return (
    <div
      className={cn(
        'fixed left-4 z-30 hidden transition-all duration-700 sm:block',
        playerVisible ? 'bottom-[108px]' : 'bottom-4',
        scrolled ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      )}
      role="complementary"
      aria-label="Numéros du magazine"
    >
      <div
        className="group relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <a
          href="#/shop"
          aria-label={`Feuilleter le magazine : ${current.title}`}
          className="relative flex items-stretch gap-0 overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_10px_35px_-10px_rgba(0,0,0,0.45)] transition-shadow duration-500 hover:shadow-[0_14px_45px_-10px_rgba(164,22,26,0.35)]"
        >
          {/* Une du numéro : fondu enchaîné + léger travelling */}
          <span className="relative block h-[104px] w-[74px] shrink-0 overflow-hidden bg-neutral-200 dark:bg-neutral-800">
            {issues.map((iss, i) => (
              <img
                key={iss.id}
                src={iss.coverUrl}
                alt=""
                className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-all duration-[1200ms] ease-out',
                  i === idx ? 'scale-100 opacity-100' : 'scale-[1.06] opacity-0',
                )}
                loading="lazy"
              />
            ))}
            <span className="pointer-events-none absolute inset-0 rounded-l-lg ring-1 ring-inset ring-black/10" aria-hidden="true" />
          </span>

          {/* Texte éditorial */}
          <span className="flex w-44 flex-col justify-center gap-1 py-3 pl-3.5 pr-4">
            <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-primary">
              <span className="h-px w-4 bg-primary" aria-hidden="true" />
              Réussite Magazine
            </span>
            <span className="font-editorial line-clamp-2 text-[13px] font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
              {current.title}
            </span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors group-hover:text-primary">
              Feuilleter & commander
              <ArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </span>

          {/* Filet signature animé au bas de la carte */}
          <span
            className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-700"
            style={{ transform: hovered ? 'scaleX(1)' : 'scaleX(0.35)' }}
            aria-hidden="true"
          />
        </a>

        {/* Indicateurs — points discrets */}
        <span className="absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 translate-y-full items-center gap-1 pt-1" aria-hidden="true">
          {issues.slice(0, 5).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-500',
                i === idx % 5 ? 'w-3.5 bg-primary' : 'w-1 bg-primary/30',
              )}
            />
          ))}
        </span>

        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-all duration-300 hover:text-foreground group-hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  );
}
