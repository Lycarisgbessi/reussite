'use client';

// ═══════════════════════════════════════════════════════════════
// HEADER COVERS — carrousel « coverflow » des unes du magazine.
// FLUIDITÉ HAUT DE GAMME : animation physique à ressort (spring)
// sur le seul `transform` — les couvertures glissent en continu
// comme portées par un plateau tournant, sans à-coups mécaniques.
// Géométrie resserrée : les couvertures se serrent au centre
// (pas de 56px), laissant un large respir entre le groupe, le
// logo (gauche) et le bouton recherche (droite).
// Clic sur une couverture → boutique ouverte sur ce numéro.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { COVERS, coverSrc, type CoverItem } from './coversData';
import { publicApi } from '@/lib/api';

// Géométrie de la roue
const STEP_PX = 56;       // pas horizontal resserré entre couvertures
const ROT_Y = 45;         // inclinaison marquée → sensation de rotation
const SPRING = { type: 'spring', stiffness: 70, damping: 15, mass: 0.85 } as const;

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

  return (
    <div
      className="hidden shrink-0 items-center justify-center px-10 md:flex lg:px-14"
      aria-label="Couvertures des numéros"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative flex h-44 items-center lg:h-48" style={{ perspective: '1200px' }}>
        {covers.map((c, i) => {
          const d = offset(i);
          const abs = Math.abs(d);
          if (abs > 2) return null;
          const isActive = d === 0;
          const link = c.id || c.slug ? `#/shop?numero=${c.id ?? c.slug}` : '#/shop';
          return (
            <motion.a
              key={c.file || (c.src ?? '') + i}
              href={link}
              aria-label={`Voir le numéro : ${c.label}`}
              className="absolute left-1/2 block cursor-pointer overflow-hidden rounded-[3px] border border-white/25 bg-neutral-900 shadow-2xl will-change-transform hover:brightness-110"
              initial={false}
              animate={{
                // Plateau tournant : translation, rotation, profondeur,
                // échelle — tout passe par transform (jamais le layout).
                // Centrage : left-1/2 + marge -50% de largeur (style),
                // x reste numérique pur → interpolation fluide du spring.
                x: d * STEP_PX,
                rotateY: d * -ROT_Y,
                z: isActive ? 90 : -abs * 80,
                scale: isActive ? 1.62 : abs === 1 ? 1.04 : 0.88,
                opacity: abs === 2 ? 0.45 : isActive ? 1 : 0.8,
              }}
              transition={SPRING}
              style={{ zIndex: 10 - abs, width: '5.2rem', height: '6.5rem', marginLeft: '-2.6rem' }}
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
            </motion.a>
          );
        })}
      </div>
    </div>
  );
}
