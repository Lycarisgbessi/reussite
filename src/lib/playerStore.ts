'use client';

// ═══════════════════════════════════════════════════════════════
// PLAYER STORE — lecteur audio GLOBAL et persistant.
// L'état vit dans Zustand ; un unique <audio> est monté à la racine
// du FrontOffice (GlobalPodcastPlayer). La barre flottante reste
// visible sur TOUTES les pages tant que l'utilisateur ne la ferme
// pas — la lecture continue lors de la navigation.
// ═══════════════════════════════════════════════════════════════
import { create } from 'zustand';
import type { PodcastItem } from './types';

const RATE_STEPS = [1, 1.25, 1.5, 1.75, 2];
const RATE_KEY = 'bh_player_rate';
function initialRate(): number {
  if (typeof localStorage === 'undefined') return 1;
  const saved = Number(localStorage.getItem(RATE_KEY));
  return RATE_STEPS.includes(saved) ? saved : 1;
}

interface PlayerState {
  current: PodcastItem | null;
  playing: boolean;
  time: number;
  duration: number;
  rate: number;
  error: boolean;
  closed: boolean;
  /** Élément audio réel (enregistré par GlobalPodcastPlayer). */
  audioEl: HTMLAudioElement | null;

  registerAudio: (el: HTMLAudioElement | null) => void;
  play: (ep: PodcastItem) => void;
  toggle: () => void;
  seek: (t: number) => void;
  cycleRate: () => void;
  close: () => void;
  _onPlay: () => void;
  _onPause: () => void;
  _onTime: (t: number) => void;
  _onMeta: (d: number) => void;
  _onEnded: () => void;
  _onError: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  current: null,
  playing: false,
  time: 0,
  duration: 0,
  rate: initialRate(),
  error: false,
  closed: false,
  audioEl: null,

  registerAudio: (el) => set({ audioEl: el }),

  play: (ep) => {
    const { current } = get();
    if (current?.id === ep.id) {
      get().toggle();
      return;
    }
    set({ current: ep, time: 0, duration: 0, error: false, closed: false, playing: false });
    const audio = get().audioEl;
    if (audio) {
      audio.playbackRate = get().rate;
      // src sera appliqué par le composant (reactif à current) ;
      // on lance la lecture au prochain tick.
      setTimeout(() => {
        const a = get().audioEl;
        if (a) a.play().then(() => set({ playing: true })).catch(() => set({ playing: false }));
      }, 50);
    }
    // Comptage d'écoute (best effort)
    void import('./api').then(({ publicApi }) => {
      publicApi.incrementPodcastPlay(ep.id).catch(() => {});
    });
  },

  toggle: () => {
    const audio = get().audioEl;
    if (!audio || !get().current) return;
    if (audio.paused) {
      audio.play().then(() => set({ playing: true })).catch(() => {});
    } else {
      audio.pause();
    }
  },

  seek: (t) => {
    const audio = get().audioEl;
    if (audio) audio.currentTime = t;
    set({ time: t });
  },

  cycleRate: () => {
    const { rate } = get();
    const idx = RATE_STEPS.indexOf(rate);
    const next = RATE_STEPS[(idx + 1) % RATE_STEPS.length];
    const audio = get().audioEl;
    if (audio) audio.playbackRate = next;
    if (typeof localStorage !== 'undefined') localStorage.setItem(RATE_KEY, String(next));
    set({ rate: next });
  },

  close: () => {
    const audio = get().audioEl;
    if (audio) audio.pause();
    set({ closed: true, playing: false });
  },

  _onPlay: () => set({ playing: true, error: false }),
  _onPause: () => set({ playing: false }),
  _onTime: (t) => set({ time: t }),
  _onMeta: (d) => set({ duration: Number.isFinite(d) ? d : 0 }),
  _onEnded: () => set({ playing: false }),
  _onError: () => set({ error: true, playing: false }),
}));
