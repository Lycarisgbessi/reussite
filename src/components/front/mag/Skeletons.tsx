'use client';

// ═══════════════════════════════════════════════════════════════
// SKELETONS — chargements alignés sur les layouts réels
// (jamais de page blanche pendant les requêtes API)
// ═══════════════════════════════════════════════════════════════
import { cn } from '@/lib/utils';

function Block({ className }: { className?: string }) {
  return <div className={cn('skeleton-shimmer rounded-md', className)} aria-hidden="true" />;
}

export function ArticleCardSkeleton({
  variant = 'grid',
  className,
}: {
  variant?: 'grid' | 'horizontal' | 'mini';
  className?: string;
}) {
  if (variant === 'mini') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <Block className="size-16 rounded-lg sm:size-20" />
        <div className="flex-1 space-y-2">
          <Block className="h-4 w-full" />
          <Block className="h-3 w-2/3" />
        </div>
      </div>
    );
  }
  if (variant === 'horizontal') {
    return (
      <div className={cn('flex gap-4 rounded-xl border bg-card p-3', className)}>
        <Block className="aspect-[16/10] w-32 rounded-lg sm:w-44" />
        <div className="flex-1 space-y-2 py-1">
          <Block className="h-3 w-20" />
          <Block className="h-5 w-full" />
          <Block className="h-5 w-3/4" />
          <Block className="h-3 w-1/2" />
        </div>
      </div>
    );
  }
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      <Block className="aspect-[16/10] rounded-none" />
      <div className="space-y-2 p-4">
        <Block className="h-5 w-full" />
        <Block className="h-5 w-2/3" />
        <Block className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Squelette générique de page intérieure (article, catégorie, recherche…). */
export function PageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('mx-auto max-w-4xl px-4 py-10', className)}>
      <Block className="h-3 w-48" />
      <Block className="mt-4 h-10 w-full" />
      <Block className="mt-2 h-10 w-2/3" />
      <Block className="mt-6 aspect-video w-full rounded-xl" />
      <div className="mt-6 space-y-3">
        <Block className="h-4 w-full" />
        <Block className="h-4 w-full" />
        <Block className="h-4 w-5/6" />
        <Block className="h-4 w-3/4" />
      </div>
    </div>
  );
}

/** Squelette complet de la page d'accueil (hero + grille + sidebar). */
export function HomeSkeleton() {
  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <Block className="aspect-[16/9] w-full rounded-2xl sm:aspect-[16/7]" />
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Block className="h-8 w-56" />
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <ArticleCardSkeleton key={i} variant="grid" />
              ))}
            </div>
          </div>
          <div className="space-y-8">
            <Block className="h-[250px] w-full rounded-xl" />
            <Block className="h-8 w-52" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <ArticleCardSkeleton key={i} variant="mini" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
