'use client';

// ═══════════════════════════════════════════════════════════════
// HEADER COVERS — carrousel « coverflow » des unes du magazine :
// défilement automatique continu, sensation de ROTATION claire
// (forte inclinaison des voisines, dossier central projeté devant),
// espacements resserrés. Clic sur une couverture → page Boutique
// ouverte sur ce numéro (aperçu).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { COVERS, coverSrc, type CoverItem } from './coversData';
import { publicApi } from '@/lib/api';

export function HeaderCovers() {
  // Numéros de la boutique (couverture renseignée au dashboard) —
  // repli sur la liste statique si la boutique est vide.
  const [covers, setCovers] = useState<CoverItem[]>(COVERS);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    publicApi
      .shop()
      .then((res) => {
        if (cancelled) return;
        const fromShop = res.issues
          .filter((i) => i.coverUrl)
          .slice(0, 6)
          .map((i) => ({
            file: '',
            src: i.coverUrl,
            label: i.title.length > 26 ? i.title.slice(0, 26) + '…' : i.title,
            id: i.id,
            slug: i.slug,
          }));
        if (fromShop.length > 0) {
          setCovers(fromShop);
          setActive(0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (paused || covers.length < 2) return;
    const id = setInterval(() => setActive((a) => (a + 1) % covers.length), 3000);
    return () => clearInterval(id);
  }, [paused, covers.length]);

  const offset = (i: number) => {
    const n = covers.length;
    const d = i - active;
    return ((d + n + n / 2) % n) - n / 2; // -3..3
  };

  // Géométrie de la rotation : pas resserré (66px) pour que les
  // voisines se serrent, forte inclinaison (±42°) + retrait en
  // profondeur pour marquer l'effet de roue qui tourne.
  const STEP_PX = 66;
  const ROT_Y = 42;
  const Z_STEP = 74;

  return (
    <div
      className="hidden shrink-0 items-center justify-center px-8 md:flex"
      aria-label="Couvertures des numéros"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative flex h-44 items-center lg:h-48" style={{ perspective: '1100px' }}>
        {covers.map((c, i) => {
          const d = offset(i);
          const abs = Math.abs(d);
          if (abs > 2) return null;
          const isActive = d === 0;
          const link = c.id || c.slug ? `#/shop?numero=${c.id ?? c.slug}` : '#/shop';
          return (
            <a
              key={c.file || (c.src ?? '') + i}
              href={link}
              aria-label={`Voir le numéro : ${c.label}`}
              className="absolute left-1/2 block cursor-pointer overflow-hidden rounded-[3px] border-white/25 bg-neutral-900 shadow-2xl transition-all duration-[850ms] [transition-timing-function:cubic-bezier(0.45,0,0.25,1)] will-change-transform hover:brightness-110"
              style={{
                width: isActive ? '8.6rem' : '5.2rem',
                height: isActive ? '10.4rem' : '6.5rem',
                zIndex: 10 - abs,
                transform: `translateX(calc(-50% + ${d * STEP_PX}px)) rotateY(${d * -ROT_Y}deg) translateZ(${isActive ? 90 : -abs * Z_STEP}px) scale(${isActive ? 1 : 0.9})`,
                opacity: abs === 2 ? 0.5 : isActive ? 1 : 0.8,
                borderWidth: isActive ? 2 : 1,
              }}
            >
              <img
                src={c.src || coverSrc(c.file)}
                alt={c.label}
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
              {isActive ? (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-[9px] font-bold uppercase tracking-wide text-white">
                  {c.label}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}
