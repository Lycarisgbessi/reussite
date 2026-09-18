'use client';

// ═══════════════════════════════════════════════════════════════
// SCROLL TO TOP — bouton flottant après 600 px de scroll.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Retour en haut de page"
      className={cn(
        'fixed bottom-20 right-4 z-30 flex size-11 items-center justify-center rounded-full border bg-card text-foreground shadow-lg transition-all duration-300 hover:bg-primary hover:text-primary-foreground md:bottom-6 md:right-6',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
