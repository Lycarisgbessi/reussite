'use client';

// ═══════════════════════════════════════════════════════════════
// ARTICLE CARD — 5 variantes : hero | grid | horizontal | mini | ranked
// Badge catégorie rouge (charte Réussite), dates FR, hover discret,
// navigation hash. Typographie resserrée et élégante.
// ═══════════════════════════════════════════════════════════════
import { Clock3, Eye } from 'lucide-react';
import type { ArticleSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useI18n, useFormatDate } from '@/lib/i18n';
import { SmartImage } from './SmartImage';
import { contrastText, formatViews } from './helpers';

export function CategoryBadge({
  name,
  color,
  className,
}: {
  name: string;
  color?: string;
  className?: string;
}) {
  const bg = color || '#C8102E';
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-[3px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]',
        className,
      )}
      style={{ backgroundColor: bg, color: contrastText(bg) }}
    >
      {name}
    </span>
  );
}

interface ArticleCardProps {
  article: ArticleSummary;
  variant?: 'hero' | 'grid' | 'horizontal' | 'mini' | 'ranked';
  /** Rang (variante ranked). */
  rank?: number;
  showExcerpt?: boolean;
  showMeta?: boolean;
  className?: string;
}

export function ArticleCard({
  article,
  variant = 'grid',
  rank,
  showExcerpt = true,
  showMeta = true,
  className,
}: ArticleCardProps) {
  const { t } = useI18n();
  const { relative } = useFormatDate();
  const href = `#/article/${article.slug}`;
  const badge = (
    <CategoryBadge name={article.category?.name || t('common.article')} color={article.category?.color} />
  );
  const metaRow = showMeta ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span>{relative(article.publishedAt)}</span>
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3" aria-hidden="true" />
        {formatViews(article.views)}
      </span>
      {article.readingTime ? (
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" aria-hidden="true" />
          {article.readingTime} {t('common.min')}
        </span>
      ) : null}
    </div>
  ) : (
    <div className="text-[11px] text-muted-foreground">{relative(article.publishedAt)}</div>
  );

  if (variant === 'hero') {
    return (
      <a
        href={href}
        className={cn(
          'article-card group relative block overflow-hidden rounded-lg bg-card',
          className,
        )}
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-[16/7]">
          <SmartImage
            src={article.coverImage}
            alt={article.title}
            className="card-image absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5"
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <div className="mb-2">{badge}</div>
            <h3 className="font-editorial text-lg font-bold leading-snug text-white sm:text-2xl lg:text-[1.7rem]">
              {article.title}
            </h3>
            <p className="mt-1.5 hidden text-[13px] leading-relaxed text-white/80 md:line-clamp-2">
              {article.subtitle}
            </p>
          </div>
        </div>
      </a>
    );
  }

  if (variant === 'horizontal') {
    return (
      <a
        href={href}
        className={cn(
          'article-card group flex min-w-0 gap-3 overflow-hidden rounded-lg border bg-card p-2.5',
          className,
        )}
      >
        <div className="relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-md sm:w-40">
          <SmartImage
            src={article.coverImage}
            alt={article.title}
            className="card-image h-full w-full object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
          {badge}
          <h3 className="font-editorial text-[15px] font-bold leading-snug transition-colors group-hover:text-primary">
            {article.title}
          </h3>
          {showExcerpt && article.subtitle ? (
            <p className="hidden text-[13px] leading-relaxed text-muted-foreground sm:line-clamp-2">
              {article.subtitle}
            </p>
          ) : null}
          <div className="mt-auto">{metaRow}</div>
        </div>
      </a>
    );
  }

  if (variant === 'mini') {
    return (
      <a href={href} className={cn('group flex items-center gap-3', className)}>
        <div className="relative size-14 shrink-0 overflow-hidden rounded-md sm:size-16">
          <SmartImage
            src={article.coverImage}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0">
          <h4 className="font-editorial text-[13px] font-semibold leading-snug transition-colors group-hover:text-primary sm:text-sm">
            <span className="line-clamp-2">{article.title}</span>
          </h4>
          <p className="mt-1 text-[11px] text-muted-foreground">{relative(article.publishedAt)}</p>
        </div>
      </a>
    );
  }

  if (variant === 'ranked') {
    return (
      <a href={href} className={cn('group flex items-start gap-3 py-2', className)}>
        <span
          className="w-6 shrink-0 font-editorial text-xl font-bold leading-none text-primary/50 transition-colors group-hover:text-primary"
          aria-hidden="true"
        >
          {rank ?? 1}
        </span>
        <div className="min-w-0 flex-1 border-b border-border/70 pb-2">
          <h4 className="font-editorial text-[13px] font-semibold leading-snug transition-colors group-hover:text-primary sm:text-sm">
            <span className="line-clamp-2">{article.title}</span>
          </h4>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {article.category?.name} · {relative(article.publishedAt)}
          </p>
        </div>
      </a>
    );
  }

  // Variante 'grid' (défaut)
  return (
    <a
      href={href}
      className={cn(
        'article-card group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card',
        className,
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <SmartImage
          src={article.coverImage}
          alt={article.title}
          className="card-image h-full w-full object-cover"
        />
        <div className="absolute left-2.5 top-2.5">{badge}</div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="font-editorial text-[15px] font-bold leading-snug transition-colors group-hover:text-primary sm:text-base">
          <span className="line-clamp-2">{article.title}</span>
        </h3>
        {showExcerpt && article.subtitle ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground line-clamp-2">
            {article.subtitle}
          </p>
        ) : null}
        <div className="mt-auto pt-1.5">{metaRow}</div>
      </div>
    </a>
  );
}
