'use client';

// ═══════════════════════════════════════════════════════════════
// GLOBAL PODCAST PLAYER — barre flottante PERSISTANTE (toutes les
// pages) + unique élément <audio> de l'application. Monté à la
// racine du FrontOffice : la lecture survit à la navigation.
// ═══════════════════════════════════════════════════════════════
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Pause, Play, X } from 'lucide-react';
import { usePlayerStore } from '@/lib/playerStore';
import { useI18n } from '@/lib/i18n';
import { navigate } from '@/lib/store';
import { useBottomLayers, useBottomOffset } from '@/lib/bottomLayers';
import { Button } from '@/components/ui/button';
import { SmartImage } from '../mag/SmartImage';
import { fmtTime } from '../mag/helpers';

export function GlobalPodcastPlayer() {
  const { t } = useI18n();
  const current = usePlayerStore((s) => s.current);
  const playing = usePlayerStore((s) => s.playing);
  const time = usePlayerStore((s) => s.time);
  const duration = usePlayerStore((s) => s.duration);
  const rate = usePlayerStore((s) => s.rate);
  const error = usePlayerStore((s) => s.error);
  const closed = usePlayerStore((s) => s.closed);
  const registerAudio = usePlayerStore((s) => s.registerAudio);
  const toggle = usePlayerStore((s) => s.toggle);
  const seek = usePlayerStore((s) => s.seek);
  const cycleRate = usePlayerStore((s) => s.cycleRate);
  const close = usePlayerStore((s) => s.close);
  const _onPlay = usePlayerStore((s) => s._onPlay);
  const _onPause = usePlayerStore((s) => s._onPause);
  const _onTime = usePlayerStore((s) => s._onTime);
  const _onMeta = usePlayerStore((s) => s._onMeta);
  const _onEnded = usePlayerStore((s) => s._onEnded);
  const _onError = usePlayerStore((s) => s._onError);

  const visible = current && !closed;
  const bottomOffset = useBottomOffset('player');
  const setPlayerVisible = useBottomLayers((st) => st.setPlayerVisible);
  React.useEffect(() => { setPlayerVisible(Boolean(visible)); }, [visible, setPlayerVisible]);

  return (
    <>
      {/* Élément audio unique de l'application — vit hors des vues */}
      <audio
        ref={registerAudio}
        src={current?.audioUrl || undefined}
        onPlay={_onPlay}
        onPause={_onPause}
        onTimeUpdate={(e) => _onTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => _onMeta(e.currentTarget.duration)}
        onEnded={_onEnded}
        onError={_onError}
        preload="metadata"
        className="hidden"
      />

      <AnimatePresence>
        {visible ? (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ bottom: `${bottomOffset}px` }}
            className="fixed inset-x-0 z-40 px-3 pb-3 md:inset-x-auto md:left-1/2 md:w-[560px] md:-translate-x-1/2 md:px-0"
            role="region"
            aria-label={t('podcasts.player')}
          >
            <div className="flex items-center gap-3 rounded-2xl border bg-card/95 p-3 shadow-2xl backdrop-blur-md">
              <button
                type="button"
                onClick={() => navigate('/podcasts')}
                className="relative size-12 shrink-0 overflow-hidden rounded-lg"
                aria-label={t('nav.podcasts')}
              >
                <SmartImage
                  src={current.coverImage}
                  alt={current.title}
                  className="h-full w-full object-cover"
                  fallbackLabel="♪"
                />
                {playing ? (
                  <span className="absolute inset-0 flex items-end justify-center gap-0.5 bg-black/35 pb-1.5" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1 rounded-full bg-white"
                        animate={{ height: [4, 12, 6, 10, 4] }}
                        transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.15 }}
                      />
                    ))}
                  </span>
                ) : null}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {current.title}
                  {error ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                      <AlertTriangle className="size-3" aria-hidden="true" />
                      {t('podcasts.audioError')}
                    </span>
                  ) : null}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    {fmtTime(time)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={Math.min(time, duration || 0)}
                    onChange={(e) => seek(Number(e.target.value))}
                    className="h-1.5 flex-1 cursor-pointer accent-[var(--primary)]"
                    aria-label={t('podcasts.progress')}
                  />
                  <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {fmtTime(duration)}
                  </span>
                </div>
              </div>

              <Button
                size="icon"
                onClick={toggle}
                aria-label={playing ? t('podcasts.pause') : t('podcasts.resume')}
                className="size-10 shrink-0 rounded-full"
              >
                {playing ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={cycleRate}
                aria-label={t('podcasts.speed')}
                className="h-10 shrink-0 rounded-full px-3 text-xs font-semibold"
              >
                {rate}×
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={close}
                aria-label={t('ads.close')}
                className="size-9 shrink-0 rounded-full text-muted-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
