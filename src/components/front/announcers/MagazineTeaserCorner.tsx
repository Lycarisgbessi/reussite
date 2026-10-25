'use client';

// ═══════════════════════════════════════════════════════════════
// MAGAZINE TEASER CORNER — encart TAQUIN en bas à gauche.
// Personnalité : il joue à cache-cache avec le lecteur — il sort,
// fait défiler les unes en mini-coverflow rotatif (même sensation
// que le carrousel du header), puis SE CACHE hors écran comme
// quelqu'un qui fuit… avant de réapparaître. Pause au survol.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useBottomLayers } from '@/lib/bottomLayers';
import { cn } from '@/lib/utils';

interface TeaserIssue { id: string; title: string; coverUrl: string; }

// Cycle taquin : 9 s visible → 6 s caché → revient…
const VISIBLE_MS = 9000;
const HIDDEN_MS = 6000;
const SPRING = { type: 'spring', stiffness: 90, damping: 14, mass: 0.9 } as const;

export function MagazineTeaserCorner() {
  const [issues, setIssues] = useState<TeaserIssue[]>([]);
  const [active, setActive] = useState(0);
  const [closed, setClosed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [teasing, setTeasing] = useState(false); // true = caché
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

  // Mini-coverflow : les unes défilent tant qu'on est visible
  useEffect(() => {
    if (hovered || teasing || issues.length < 2) return;
    const id = setInterval(() => setActive((a) => (a + 1) % issues.length), 2800);
    return () => clearInterval(id);
  }, [hovered, teasing, issues.length]);

  // Cache-cache taquin : alterne sortie/entrée (pause au survol)
  useEffect(() => {
    if (closed || !scrolled || issues.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const cycle = (visible: boolean) => {
      if (cancelled) return;
      timer = setTimeout(() => {
        if (cancelled) return;
        if (hovered) { cycle(visible); return; } // survolé → il reste
        setTeasing(!visible);
        cycle(!visible);
      }, visible ? VISIBLE_MS : HIDDEN_MS);
    };
    cycle(true);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [closed, scrolled, issues.length, hovered]);

  if (closed || issues.length === 0 || !scrolled) return null;
  const current = issues[active];

  const offset = (i: number) => {
    const n = issues.length;
    const d = i - active;
    return ((d + n + n / 2) % n) - n / 2;
  };

  const close = () => {
    setClosed(true);
    try { sessionStorage.setItem('rm_teaser_closed', '1'); } catch { /* ignore */ }
  };

  return (
    <div
      className={cn(
        'fixed left-4 z-30 hidden sm:block',
        playerVisible ? 'bottom-[108px]' : 'bottom-4',
      )}
      role="complementary"
      aria-label="Numéros du magazine"
    >
      <motion.div
        initial={{ x: '-130%', opacity: 0, rotate: -6 }}
        animate={
          teasing
            ? // Se cache : sort de l'écran vers la gauche, comme il est venu
              { x: '-130%', opacity: 0, rotate: -8 }
            : // Ressort taquin : effet de ressort + inclinaison espiègle
              { x: 0, opacity: 1, rotate: 0 }
        }
        transition={SPRING}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="group relative overflow-visible rounded-lg border border-border/70 bg-card shadow-[0_12px_40px_-10px_rgba(0,0,0,0.5)]">
          <a
            href="#/shop"
            aria-label={`Feuilleter le magazine : ${current.title}`}
            className="relative flex items-stretch"
          >
            {/* Mini-coverflow des unes (même langage que le header) */}
            <span
              className="relative block h-[126px] w-[150px] shrink-0"
              style={{ perspective: '700px' }}
              aria-hidden="true"
            >
              {issues.map((iss, i) => {
                const d = offset(i);
                const abs = Math.abs(d);
                if (abs > 2) return null;
                const isActive = d === 0;
                return (
                  <motion.span
                    key={iss.id}
                    className="absolute left-1/2 block overflow-hidden rounded-[3px] border border-white/20 bg-neutral-900 shadow-xl will-change-transform"
                    initial={false}
                    animate={{
                      x: d * 38 - 24,
                      rotateY: d * -40,
                      z: isActive ? 40 : -abs * 40,
                      scale: isActive ? 1 : 0.8,
                      opacity: abs === 2 ? 0.35 : isActive ? 1 : 0.75,
                    }}
                    transition={SPRING}
                    style={{ zIndex: 10 - abs, width: '3.4rem', height: '4.3rem', top: 13 }}
                  >
                    <img src={iss.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </motion.span>
                );
              })}
            </span>

            {/* Texte éditorial + CTA */}
            <span className="flex w-52 flex-col justify-center gap-1.5 py-3.5 pr-5">
              <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.22em] text-primary">
                <span className="h-px w-4 bg-primary" aria-hidden="true" />
                Réussite Magazine
              </span>
              <span className="font-editorial line-clamp-2 text-[13.5px] font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
                {current.title}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                Numérique dès 10 000 GNF · papier livré chez vous
              </span>
              <span className="teaser-shine mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white shadow-md shadow-primary/30">
                Feuilleter ce numéro
                <ArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </span>
          </a>

          {/* Filet signature animé */}
          <span
            className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-700"
            style={{ transform: hovered ? 'scaleX(1)' : 'scaleX(0.35)' }}
            aria-hidden="true"
          />

          {/* Reflet balayant */}
          <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg" aria-hidden="true">
            <span className="teaser-sheen absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
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
      </motion.div>
    </div>
  );
}
