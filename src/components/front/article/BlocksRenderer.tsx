'use client';

// ═══════════════════════════════════════════════════════════════
// BLOCKS RENDERER — rendu des ContentBlock (éditeur de blocs) :
// paragraph, heading, quote, image, video, list, callout, divider.
// Insertion optionnelle d'un emplacement pub (IN_ARTICLE).
// ═══════════════════════════════════════════════════════════════
import { Fragment } from 'react';
import { Check, Info, Sparkles } from 'lucide-react';
import type { ContentBlock } from '@/lib/types';
import { SmartImage } from '../mag/SmartImage';

interface BlocksRendererProps {
  blocks: ContentBlock[];
  /** Nœud à injecter après le bloc `adAfter` (ex: AdSlot IN_ARTICLE). */
  adSlot?: React.ReactNode;
  adAfter?: number;
  className?: string;
}

function renderBlock(block: ContentBlock) {
  switch (block.type) {
    case 'paragraph':
      return <p className="whitespace-pre-line">{block.text}</p>;

    case 'heading':
      return block.level === 2 ? (
        <h2 className="mb-4 mt-10 flex items-center gap-3 font-editorial text-2xl font-bold sm:text-[1.7rem]">
          <span className="h-7 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
          {block.text}
        </h2>
      ) : (
        <h3 className="mb-3 mt-8 flex items-center gap-2.5 font-editorial text-xl font-bold">
          <span className="h-5 w-1 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
          {block.text}
        </h3>
      );

    case 'quote':
      return (
        <blockquote className="my-8 border-l-4 border-primary py-1 pl-5">
          <p className="font-editorial text-xl italic leading-relaxed text-foreground/90">
            « {block.text} »
          </p>
          {block.author ? (
            <footer className="mt-2 text-sm font-medium text-muted-foreground">— {block.author}</footer>
          ) : null}
        </blockquote>
      );

    case 'image':
      return (
        <figure className="my-8">
          <div className="overflow-hidden rounded-xl">
            <SmartImage src={block.url} alt={block.alt || ''} className="w-full object-cover" />
          </div>
          {block.caption ? (
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );

    case 'video':
      return (
        <figure className="my-8">
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${block.youtubeId}`}
              title={block.title || 'Vidéo intégrée'}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          {block.title ? (
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">{block.title}</figcaption>
          ) : null}
        </figure>
      );

    case 'list':
      return (
        <ul className="my-6 space-y-2.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3" aria-hidden="true" />
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );

    case 'callout': {
      const Icon = block.title && block.title !== 'À retenir' ? Sparkles : Info;
      return (
        <aside className="my-8 flex gap-4 rounded-xl border border-primary/25 bg-accent/50 p-5">
          <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-editorial text-base font-bold">
              {block.title || 'À retenir'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">{block.text}</p>
          </div>
        </aside>
      );
    }

    case 'divider':
      return <hr className="my-10 border-dashed" aria-hidden="true" />;

    default:
      return null;
  }
}

export function BlocksRenderer({ blocks, adSlot, adAfter = 1, className }: BlocksRendererProps) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className={`article-body ${className || ''}`}>
      {blocks.map((block, i) => (
        <Fragment key={block.id || `${block.type}-${i}`}>
          {renderBlock(block)}
          {adSlot && i === adAfter ? <div className="not-prose my-8">{adSlot}</div> : null}
        </Fragment>
      ))}
      {adSlot && blocks.length <= adAfter ? <div className="not-prose my-8">{adSlot}</div> : null}
    </div>
  );
}
