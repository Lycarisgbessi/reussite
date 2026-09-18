'use client';

// ═══════════════════════════════════════════════════════════════
// FLASH INFO BAR — bandeau défilant (ticker), activable depuis le
// dashboard. Fermeture mémorisée pour la session.
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { X } from 'lucide-react';
import { useMagazineStore } from '@/lib/store';
import type { FlashInfoItem } from '@/lib/types';

export function FlashInfoBar() {
  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const [closed, setClosed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem('bh_flash_closed') === '1';
  });

  const settings = bootstrap?.settings;
  const items: FlashInfoItem[] = (bootstrap?.flashInfos || []).filter((f) => f.active);

  if (closed || !settings?.flashInfoEnabled || items.length === 0) return null;

  const close = () => {
    sessionStorage.setItem('bh_flash_closed', '1');
    setClosed(true);
  };

  const renderItem = (item: FlashInfoItem, dup: boolean) => (
    <span key={`${item.id}-${dup}`} className="inline-flex items-center">
      {item.link ? (
        <a
          href={item.link.startsWith('#') ? item.link : `#${item.link}`}
          className="underline underline-offset-4 transition-opacity hover:opacity-80"
        >
          {item.text}
        </a>
      ) : (
        <span>{item.text}</span>
      )}
      <span className="mx-6 text-[9px] opacity-60" aria-hidden="true">
        ◆
      </span>
    </span>
  );

  return (
    <div
      className="slide-in-top bg-neutral-950 text-white dark:bg-black"
      role="region"
      aria-label="Flash info"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-1.5">
        <span className="flex shrink-0 items-center gap-1.5 rounded-sm bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
          Flash
        </span>
        <div className="relative flex-1 overflow-hidden" aria-live="polite">
          <div className="ticker-marquee text-[13px] font-medium">
            {items.map((i) => renderItem(i, false))}
            {items.map((i) => renderItem(i, true))}
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Masquer le flash info"
          className="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
