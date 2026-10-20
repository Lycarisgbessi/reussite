'use client';

// ═══════════════════════════════════════════════════════════════
// BETA LOCK — voile de verrouillage des sections Bêta du back-office
// (Pages statiques, Menus de navigation). Toute modification est
// bloquée visuellement et techniquement (pointer-events + aria).
// Déverrouillage : NEXT_PUBLIC_ADMIN_UNLOCK_BETA=true dans .env.
// ═══════════════════════════════════════════════════════════════
import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';

export const BETA_UNLOCKED = process.env.NEXT_PUBLIC_ADMIN_UNLOCK_BETA === 'true';

export function BetaLock({ sectionName, children }: { sectionName: string; children: React.ReactNode }) {
  if (BETA_UNLOCKED) {
    return (
      <>
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-400">Section « {sectionName} » — mode Bêta</p>
            <p className="mt-0.5 text-muted-foreground">
              Déverrouillée : manipulez ces réglages avec prudence, ils affectent la structure du site
              (pages légales et menus de navigation).
            </p>
          </div>
        </div>
        {children}
      </>
    );
  }
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none select-none opacity-40 saturate-0">
        {children}
      </div>
      <div className="absolute inset-0 z-10 flex items-start justify-center pt-16">
        <div className="mx-4 max-w-md rounded-2xl border border-amber-500/40 bg-card/97 p-6 text-center shadow-2xl backdrop-blur">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <Lock className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-3 font-editorial text-lg font-bold">
            « {sectionName} » — Bêta verrouillée
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Cette section est en cours de finalisation. La consultation reste possible mais toute
            modification est désactivée pour protéger la structure du site. Pour l'activer,
            définissez <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">NEXT_PUBLIC_ADMIN_UNLOCK_BETA=true</code> dans
            le fichier <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">.env</code> puis rechargez.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-500/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
            <AlertTriangle className="size-3" aria-hidden="true" /> Bêta — ne pas modifier
          </p>
        </div>
      </div>
    </div>
  );
}
