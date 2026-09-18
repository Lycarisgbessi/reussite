'use client';

// ═══════════════════════════════════════════════════════════════
// SECTION TITLE — eyebrow + titre serif + trait primary + lien
// ═══════════════════════════════════════════════════════════════
import { ArrowRight } from 'lucide-react';
import { navigate } from '@/lib/store';
import { cn } from '@/lib/utils';

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  /** Chemin de navigation (ex: '/videos') pour le lien « Voir tout ». */
  seeAllHref?: string;
  seeAllLabel?: string;
  className?: string;
}

export function SectionTitle({
  eyebrow,
  title,
  seeAllHref,
  seeAllLabel = 'Voir tout',
  className,
}: SectionTitleProps) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? <p className="eyebrow mb-1 text-primary">{eyebrow}</p> : null}
        <h2 className="font-editorial text-2xl font-bold leading-tight sm:text-3xl">{title}</h2>
        <div className="mt-2 h-1 w-14 rounded-full bg-primary" aria-hidden="true" />
      </div>
      {seeAllHref ? (
        <button
          type="button"
          onClick={() => navigate(seeAllHref)}
          className="group inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          {seeAllLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          <span className="sr-only">— {title}</span>
        </button>
      ) : null}
    </div>
  );
}
