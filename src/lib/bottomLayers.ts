'use client';

// ═══════════════════════════════════════════════════════════════
// BOTTOM LAYERS — coordination des éléments flottants bas d'écran
// (bannière d'installation, lecteur podcast, pub sticky mobile)
// pour qu'ils s'empilent proprement au lieu de se superposer.
// ═══════════════════════════════════════════════════════════════
import { create } from 'zustand';

/** Hauteur approximative (px) de chaque couche visible sur mobile. */
const HEIGHTS = { install: 168, player: 82, stickyAd: 50 };

interface BottomLayersState {
  installVisible: boolean;
  playerVisible: boolean;
  setInstallVisible: (v: boolean) => void;
  setPlayerVisible: (v: boolean) => void;
}

export const useBottomLayers = create<BottomLayersState>((set) => ({
  installVisible: false,
  playerVisible: false,
  setInstallVisible: (v) => set({ installVisible: v }),
  setPlayerVisible: (v) => set({ playerVisible: v }),
}));

/**
 * Décalage vertical (px) à appliquer à un élément `self` pour qu'il
 * s'affiche AU-DESSUS des autres couches déjà visibles.
 */
export function useBottomOffset(self: 'install' | 'player' | 'stickyAd'): number {
  const install = useBottomLayers((s) => s.installVisible);
  const player = useBottomLayers((s) => s.playerVisible);
  let offset = 0;
  if (self !== 'install' && install) offset += HEIGHTS.install;
  if (self !== 'player' && player) offset += HEIGHTS.player;
  if (self !== 'stickyAd' && false) offset += HEIGHTS.stickyAd; // la pub reste en dernier plan
  return offset;
}
