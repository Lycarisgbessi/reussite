'use client';

// ═══════════════════════════════════════════════════════════════
// HERO SLIDER — carrousel embla des articles À la Une :
// grandes cartes 16/7, overlay dégradé, autoplay 6 s, pause hover,
// flèches + dots, tilt 3D léger au survol.
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ArticleSummary } from '@/lib/types';
import { SmartImage } from '../mag/SmartImage';
import { CategoryBadge } from '../mag/ArticleCard';

interface HeroSliderProps {
  articles: ArticleSummary[];
}

export function HeroSlider({ articles }: HeroSliderProps) {
  const slides = articles.slice(0, 6);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [selected, setSelected] = useState(0);
  const pausedRef = useRef(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    // La sélection initiale (0) correspond au snap initial d'Embla ;
    // les mises à jour se font uniquement via les événements (async).
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Autoplay 6 s avec pause au survol
  useEffect(() => {
    if (!emblaApi || slides.length <= 1) return;
    const id = setInterval(() => {
      if (!pausedRef.current) emblaApi.scrollNext();
    }, 6000);
    return () => clearInterval(id);
  }, [emblaApi, slides.length]);

  if (slides.length === 0) return null;

  const onTiltMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: -py * 4, ry: px * 4 });
  };

  return (
    <section
      className="mx-auto max-w-7xl px-4 pt-6"
      aria-label="À la une"
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
        setTilt({ rx: 0, ry: 0 });
      }}
    >
      <div className="relative" style={{ perspective: '1200px' }}>
        <div ref={emblaRef} className="overflow-hidden rounded-2xl">
          <div className="flex">
            {slides.map((article) => (
              <div key={article.id} className="min-w-0 flex-[0_0_100%] pl-0">
                <div
                  className="tilt-card relative aspect-[16/9] w-full overflow-hidden rounded-2xl sm:aspect-[16/7]"
                  style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
                  onMouseMove={onTiltMove}
                >
                  <a href={`#/article/${article.slug}`} className="group absolute inset-0 block" aria-label={article.title}>
                    <SmartImage
                      src={article.coverImage}
                      alt={article.title}
                      className="card-image absolute inset-0 h-full w-full object-cover"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5"
                      aria-hidden="true"
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10">
                      <CategoryBadge
                        name={article.category?.name || 'À la une'}
                        color={article.category?.color}
                        className="mb-3 shadow-sm"
                      />
                      <h2 className="font-editorial text-2xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                        <span className="line-clamp-2">{article.title}</span>
                      </h2>
                      <p className="mt-2 hidden max-w-3xl text-base text-white/85 md:line-clamp-2">
                        {article.subtitle}
                      </p>
                      <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors group-hover:bg-white/25">
                        Lire la suite
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Flèches */}
        {slides.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Article précédent"
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Article suivant"
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            >
              <ChevronRight className="size-5" />
            </button>
            {/* Dots */}
            <div className="absolute bottom-4 right-6 flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => emblaApi?.scrollTo(i)}
                  aria-label={`Aller à la diapositive ${i + 1}`}
                  aria-current={selected === i}
                  className={
                    selected === i
                      ? 'h-2.5 w-7 rounded-full bg-white transition-all'
                      : 'size-2.5 rounded-full bg-white/50 transition-all hover:bg-white/80'
                  }
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
