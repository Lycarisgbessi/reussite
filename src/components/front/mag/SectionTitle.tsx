'use client';

// ═══════════════════════════════════════════════════════════════
// SECTION TITLE — eyebrow + titre serif + trait primary + lien
// ═══════════════════════════════════════════════════════════════
import { ArrowRight } from 'lucide-react';
import { navigate } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

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
  seeAllLabel,
  className,
}: SectionTitleProps) {
  const { t } = useI18n();
  seeAllLabel = seeAllLabel ?? t('common.seeAll');
  return (
    <div className={cn('mb-5 flex items-end justify-between gap-4', className)}>
      <div>
        {eyebrow ? <p className="eyebrow mb-1 text-primary">{eyebrow}</p> : null}
        <h2 className="font-editorial text-xl font-bold leading-tight sm:text-2xl">{title}</h2>
        <div className="mt-1.5 h-0.5 w-10 rounded-full bg-primary" aria-hidden="true" />
      </div>
      {seeAllHref ? (
        <button
          type="button"
          onClick={() => navigate(seeAllHref)}
          className="group inline-flex min-h-[44px] items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          {seeAllLabel}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          <span className="sr-only">— {title}</span>
        </button>
      ) : null}
    </div>
  );
}
