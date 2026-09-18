'use client';

// ═══════════════════════════════════════════════════════════════
// SMART IMAGE — <img> avec lazy loading + fallback dégradé élégant
// (jamais de page cassée si une image est absente)
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Classes supplémentaires pour le bloc de repli (dégradé). */
  fallbackClassName?: string;
  /** Texte affiché dans le repli. */
  fallbackLabel?: string;
}

export function SmartImage({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackLabel = 'Réussite Magazine',
  ...props
}: SmartImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-secondary via-accent/70 to-secondary',
          fallbackClassName,
          className,
        )}
      >
        <span className="px-3 text-center font-editorial text-sm font-bold uppercase tracking-widest text-muted-foreground/70">
          {fallbackLabel}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setError(true)}
      className={className}
      {...props}
    />
  );
}
