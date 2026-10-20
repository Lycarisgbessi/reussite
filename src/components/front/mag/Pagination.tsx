'use client';

// ═══════════════════════════════════════════════════════════════
// PAGINATION — précédent / suivant + numéros (composants ui/pagination)
// ═══════════════════════════════════════════════════════════════
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import {
  Pagination as UIPagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Construit la liste des numéros : 1 … 4 5 6 … 12 */
function pageList(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) out.push('…');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push('…');
  out.push(total);
  return out;
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  const { t } = useI18n();
  if (totalPages <= 1) return null;

  const go = (p: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (p >= 1 && p <= totalPages && p !== page) onPageChange(p);
  };

  return (
    <UIPagination className={cn('mt-8', className)}>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href={`#page-${page - 1}`}
            onClick={go(page - 1)}
            aria-disabled={page <= 1}
            aria-label={t('pagination.prev')}
            className={cn('min-h-[44px] cursor-pointer gap-1 px-3', page <= 1 && 'pointer-events-none opacity-40')}
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">{t('pagination.prevShort')}</span>
          </PaginationLink>
        </PaginationItem>

        {pageList(page, totalPages).map((p, idx) =>
          p === '…' ? (
            <PaginationItem key={`ellipsis-${idx}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                href={`#page-${p}`}
                onClick={go(p)}
                isActive={p === page}
                className={cn(
                  'min-h-[44px] cursor-pointer',
                  p === page && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                )}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationLink
            href={`#page-${page + 1}`}
            onClick={go(page + 1)}
            aria-disabled={page >= totalPages}
            aria-label={t('pagination.next')}
            className={cn('min-h-[44px] cursor-pointer gap-1 px-3', page >= totalPages && 'pointer-events-none opacity-40')}
          >
            <span className="hidden sm:inline">{t('pagination.nextShort')}</span>
            <ChevronRight className="size-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </UIPagination>
  );
}
