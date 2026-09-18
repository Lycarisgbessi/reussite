'use client';

// ═══════════════════════════════════════════════════════════════
// ARTICLE CARD — 5 variantes : hero | grid | horizontal | mini | ranked
// Badge catégorie coloré, dates FR, hover image scale, navigation hash.
// ═══════════════════════════════════════════════════════════════
import { Clock3, Eye } from 'lucide-react';
import type { ArticleSummary } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SmartImage } from './SmartImage';
import { contrastText, formatViews, frRelative } from './helpers';

export function CategoryBadge({
  name,
  color,
  className,
}: {
  name: string;
  color?: string;
  className?: string;
}) {
  const bg = color || '#b45309';
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
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
  const href = `#/article/${article.slug}`;
  const badge = (
    <CategoryBadge name={article.category?.name || 'Article'} color={article.category?.color} />
  );
  const metaRow = showMeta ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span>{frRelative(article.publishedAt)}</span>
      <span className="inline-flex items-center gap-1">
        <Eye className="size-3.5" aria-hidden="true" />
        {formatViews(article.views)}
      </span>
      {article.readingTime ? (
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {article.readingTime} min
        </span>
      ) : null}
    </div>
  ) : (
    <div className="text-xs text-muted-foreground">{frRelative(article.publishedAt)}</div>
  );

  if (variant === 'hero') {
    return (
      <a
        href={href}
        className={cn(
          'article-card group relative block overflow-hidden rounded-2xl bg-card',
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
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10"
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
            <div className="mb-3">{badge}</div>
            <h3 className="font-editorial text-xl font-bold leading-snug text-white sm:text-3xl">
              {article.title}
            </h3>
            <p className="mt-2 hidden text-sm text-white/80 md:line-clamp-2">{article.subtitle}</p>
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
          'article-card group flex gap-4 overflow-hidden rounded-xl border bg-card p-3',
          className,
        )}
      >
        <div className="relative aspect-[16/10] w-32 shrink-0 overflow-hidden rounded-lg sm:w-44">
          <SmartImage
            src={article.coverImage}
            alt={article.title}
            className="card-image h-full w-full object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
          {badge}
          <h3 className="font-editorial text-base font-bold leading-snug transition-colors group-hover:text-primary sm:text-lg">
            {article.title}
          </h3>
          {showExcerpt && article.subtitle ? (
            <p className="hidden text-sm text-muted-foreground sm:line-clamp-2">{article.subtitle}</p>
          ) : null}
          <div className="mt-auto">{metaRow}</div>
        </div>
      </a>
    );
  }

  if (variant === 'mini') {
    return (
      <a href={href} className={cn('group flex items-center gap-3', className)}>
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg sm:size-20">
          <SmartImage
            src={article.coverImage}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        <div className="min-w-0">
          <h4 className="font-editorial text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
            <span className="line-clamp-2">{article.title}</span>
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">{frRelative(article.publishedAt)}</p>
        </div>
      </a>
    );
  }

  if (variant === 'ranked') {
    return (
      <a href={href} className={cn('group flex items-start gap-3 py-2.5', className)}>
        <span
          className="w-7 shrink-0 font-editorial text-2xl font-bold leading-none text-primary/60 transition-colors group-hover:text-primary"
          aria-hidden="true"
        >
          {rank ?? 1}
        </span>
        <div className="min-w-0 flex-1 border-b border-border/70 pb-2.5">
          <h4 className="font-editorial text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
            <span className="line-clamp-2">{article.title}</span>
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {article.category?.name} · {frRelative(article.publishedAt)}
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
        'article-card group flex flex-col overflow-hidden rounded-xl border bg-card',
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <SmartImage
          src={article.coverImage}
          alt={article.title}
          className="card-image h-full w-full object-cover"
        />
        <div className="absolute left-3 top-3">{badge}</div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-editorial text-lg font-bold leading-snug transition-colors group-hover:text-primary">
          <span className="line-clamp-2">{article.title}</span>
        </h3>
        {showExcerpt && article.subtitle ? (
          <p className="text-sm text-muted-foreground line-clamp-2">{article.subtitle}</p>
        ) : null}
        <div className="mt-auto pt-2">{metaRow}</div>
      </div>
    </a>
  );
}
