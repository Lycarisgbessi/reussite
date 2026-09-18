// ═══════════════════════════════════════════════════════════════
// DRAW CHECK — coche animée (confirmations newsletter, formulaires)
// Utilise l'animation .draw-check définie dans globals.css.
// ═══════════════════════════════════════════════════════════════
import { cn } from '@/lib/utils';

export function DrawCheck({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 52 52"
      className={cn('size-10 text-primary', className)}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 27l8 8 16-16"
        className="draw-check"
      />
    </svg>
  );
}
