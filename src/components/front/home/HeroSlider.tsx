'use client';

// ═══════════════════════════════════════════════════════════════
// HERO SLIDER — carrousel embla des articles À la Une :
// grandes cartes 16/7, overlay dégradé, autoplay 6 s, pause hover,
// flèches + dots, tilt 3D léger au survol.
// ═══════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ArrowRight, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { ArticleSummary } from '@/lib/types';
import { SmartImage } from '../mag/SmartImage';
import { CategoryBadge } from '../mag/ArticleCard';
import { useI18n } from '@/lib/i18n';

interface HeroSliderProps {
  articles: ArticleSummary[];
}

export function HeroSlider({ articles }: HeroSliderProps) {
  const { t } = useI18n();
  const slides = articles.slice(0, 6);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start' });
  const [selected, setSelected] = useState(0);
  const pausedRef = useRef(false);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  // Lecture vidéo autonome (badge du hero) : id YouTube en lecture
  const [playing, setPlaying] = useState<string | null>(null);

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
      aria-label={t('hero.aria')}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
        setTilt({ rx: 0, ry: 0 });
      }}
    >
      <div className="relative" style={{ perspective: '1200px' }}>
        <div ref={emblaRef} className="overflow-hidden rounded-lg">
          <div className="flex">
            {slides.map((article) => (
              <div key={article.id} className="min-w-0 flex-[0_0_100%] pl-0">
                <div
                  className="tilt-card relative aspect-[16/9] w-full overflow-hidden rounded-lg sm:aspect-[16/7]"
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
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8">
                      <CategoryBadge
                        name={article.category?.name || t('hero.aria')}
                        color={article.category?.color}
                        className="mb-2 shadow-sm"
                      />
                      <h2 className="font-editorial text-xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                        <span className="line-clamp-2">{article.title}</span>
                      </h2>
                      <p className="mt-1.5 hidden max-w-2xl text-sm text-white/85 md:line-clamp-2">
                        {article.subtitle}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors group-hover:bg-white/25">
                        {t('common.readMore')}
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>

                    {/* Aperçu vidéo : grand badge au coin inférieur droit de
                        la couverture. Survol = mini-lecteur muet ; clic =
                        lecture autonome avec contrôles et son, sans quitter
                        le carrousel. */}
                    {article.videoBadge ? (
                      <span
                        className="group/video absolute bottom-3 right-3 z-20 block"
                        role="button"
                        tabIndex={0}
                        aria-label={`Lire la vidéo de : ${article.title}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPlaying(playing === article.videoBadge ? null : (article.videoBadge ?? null));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setPlaying(playing === article.videoBadge ? null : (article.videoBadge ?? null));
                          }
                        }}
                      >
                        <span className="hero-video-pop relative block h-40 w-64 overflow-hidden rounded-xl border-2 border-white/85 shadow-2xl transition-transform duration-300 hover:scale-[1.04] sm:h-48 sm:w-80">
                          {/* Vignette par défaut (avant survol / lecture) */}
                          <span className="absolute inset-0">
                            <img
                              src={`https://i.ytimg.com/vi/${article.videoBadge}/maxresdefault.jpg`}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(ev) => {
                                (ev.target as HTMLImageElement).src =
                                  `https://i.ytimg.com/vi/${article.videoBadge}/mqdefault.jpg`;
                              }}
                            />
                          </span>
                          {/* Lecteur au survol (autoplay muet) */}
                          {playing !== article.videoBadge ? (
                            <iframe
                              key={`preview-${article.videoBadge}`}
                              src={`https://www.youtube-nocookie.com/embed/${article.videoBadge}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=${article.videoBadge}`}
                              title={`Aperçu vidéo — ${article.title}`}
                              className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-300 group-hover/video:opacity-100"
                              allow="autoplay; encrypted-media; picture-in-picture"
                              loading="lazy"
                            />
                          ) : (
                            /* Lecture autonome demandée : contrôles + son */
                            <iframe
                              key={`play-${article.videoBadge}`}
                              src={`https://www.youtube-nocookie.com/embed/${article.videoBadge}?autoplay=1&controls=1&modestbranding=1&rel=0`}
                              title={`Vidéo — ${article.title}`}
                              className="absolute inset-0 h-full w-full"
                              allow="autoplay; encrypted-media; picture-in-picture"
                              allowFullScreen
                            />
                          )}
                          {playing !== article.videoBadge ? (
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity duration-300 group-hover/video:opacity-0">
                              <span className="flex size-14 items-center justify-center rounded-full bg-primary/95 text-white shadow-2xl transition-transform duration-300 group-hover/video:scale-110">
                                <Play className="ml-1 size-6" fill="currentColor" strokeWidth={0} />
                              </span>
                            </span>
                          ) : null}
                          <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            ▶ Vidéo — cliquez pour jouer
                          </span>
                        </span>
                      </span>
                    ) : null}
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
              aria-label={t('slider.prev')}
              className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-primary"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              aria-label={t('slider.next')}
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur transition-colors hover:bg-primary"
            >
              <ChevronRight className="size-4.5" />
            </button>
            {/* Dots */}
            <div className="absolute bottom-3.5 right-5 flex items-center gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => emblaApi?.scrollTo(i)}
                  aria-label={`${t('slider.goTo')} ${i + 1}`}
                  aria-current={selected === i}
                  className={
                    selected === i
                      ? 'h-2 w-6 rounded-full bg-white transition-all'
                      : 'size-2 rounded-full bg-white/50 transition-all hover:bg-white/80'
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
