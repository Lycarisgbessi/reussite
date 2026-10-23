'use client';

// ═══════════════════════════════════════════════════════════════
// HEADER COVERS — carrousel « coverflow » des unes du magazine :
// défilement automatique, la couverture centrale ressort devant
// (grande, nette, droite), les voisines inclinées en retrait.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { COVERS, coverSrc } from './coversData';

export function HeaderCovers() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % COVERS.length), 3200);
    return () => clearInterval(id);
  }, [paused]);

  const offset = (i: number) => {
    const n = COVERS.length;
    const d = i - active;
    return ((d + n + n / 2) % n) - n / 2; // -2..2
  };

  return (
    <div
      className="hidden shrink-0 items-center justify-center px-8 md:flex"
      aria-label="Couvertures des numéros"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative flex h-44 items-center lg:h-48" style={{ perspective: '900px' }}>
        {COVERS.map((c, i) => {
          const d = offset(i);
          const abs = Math.abs(d);
          if (abs > 2) return null;
          const isActive = d === 0;
          return (
            <a
              key={c.file}
              href="#/newsletter"
              aria-label={`Numéro : ${c.label}`}
              className="absolute left-1/2 block overflow-hidden rounded-[3px] border-white/25 bg-neutral-900 shadow-2xl transition-all duration-700 ease-out"
              style={{
                width: isActive ? '8.6rem' : '5.3rem',
                height: isActive ? '10.4rem' : '6.6rem',
                zIndex: 10 - abs,
                transform: `translateX(calc(-50% + ${d * (isActive ? 0 : 86) + d * 30}px)) rotateY(${d * -32}deg) translateZ(${isActive ? 60 : -40}px) scale(${isActive ? 1 : 0.92})`,
                opacity: isActive ? 1 : 0.75,
                borderWidth: isActive ? 2 : 1,
              }}
            >
              <img
                src={coverSrc(c.file)}
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
