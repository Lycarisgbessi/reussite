'use client';

// ═══════════════════════════════════════════════════════════════
// AUTHOR BOX — mini-bio auteur : avatar, bio, réseaux sociaux,
// lien vers ses autres articles.
// ═══════════════════════════════════════════════════════════════
import { Linkedin, Twitter } from 'lucide-react';
import { navigate } from '@/lib/store';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { initials } from '../mag/helpers';
import type { ArticleAuthor } from '@/lib/types';

function socialHref(value: string, base: string): string {
  if (!value) return '#';
  if (value.startsWith('http')) return value;
  return `${base}/${value.replace('@', '')}`;
}

export function AuthorBox({ author }: { author?: ArticleAuthor | null }) {
  if (!author) return null;

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
      <Avatar className="size-16 border-2 border-primary/30">
        <AvatarImage src={author.avatarUrl} alt={author.name} />
        <AvatarFallback className="bg-primary/10 font-bold text-primary">
          {initials(author.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="eyebrow text-primary">L'auteur</p>
        <h3 className="font-editorial text-lg font-bold">{author.name}</h3>
        {author.bio ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{author.bio}</p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {author.twitter ? (
            <a
              href={socialHref(author.twitter, 'https://twitter.com')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${author.name} sur X (Twitter)`}
              className="flex size-9 items-center justify-center rounded-full border bg-card transition-colors hover:bg-secondary hover:text-primary"
            >
              <Twitter className="size-4" />
            </a>
          ) : null}
          {author.linkedin ? (
            <a
              href={socialHref(author.linkedin, 'https://www.linkedin.com/in')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${author.name} sur LinkedIn`}
              className="flex size-9 items-center justify-center rounded-full border bg-card transition-colors hover:bg-secondary hover:text-primary"
            >
              <Linkedin className="size-4" />
            </a>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto rounded-full"
            onClick={() => navigate(`/search?q=${encodeURIComponent(author.name)}`)}
          >
            Ses articles
          </Button>
        </div>
      </div>
    </Card>
  );
}
