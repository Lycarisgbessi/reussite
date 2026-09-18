'use client';

// ═══════════════════════════════════════════════════════════════
// CATEGORY BLOCKS — blocs thématiques configurables de l'accueil.
// Layout alterné : « large » (1 grande carte + 3 mini) / « narrow »
// (grille de 4 cartes).
// ═══════════════════════════════════════════════════════════════
import type { ArticleSummary, Category } from '@/lib/types';
import { ArticleCard } from '../mag/ArticleCard';
import { Reveal } from '../mag/Reveal';
import { SectionTitle } from '../mag/SectionTitle';

interface CategoryBlocksProps {
  blocks: { category: Category; articles: ArticleSummary[] }[];
}

export function CategoryBlocks({ blocks }: CategoryBlocksProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="space-y-14">
      {blocks.map((block, index) => {
        const articles = block.articles || [];
        if (articles.length === 0) return null;
        const [first, ...rest] = articles;

        return (
          <Reveal key={block.category.id} delay={index * 60}>
            <section aria-label={`Rubrique ${block.category.name}`}>
              <SectionTitle
                eyebrow="Rubrique"
                title={block.category.name}
                seeAllHref={`/category/${block.category.slug}`}
                seeAllLabel="Voir la rubrique"
              />
              {index % 2 === 0 ? (
                // Layout LARGE : 1 grande carte + colonne de 3 mini
                <div className="grid gap-6 lg:grid-cols-2">
                  <ArticleCard article={first} variant="grid" />
                  <div className="flex flex-col gap-3">
                    {rest.slice(0, 3).map((a) => (
                      <ArticleCard key={a.id} article={a} variant="horizontal" />
                    ))}
                  </div>
                </div>
              ) : (
                // Layout NARROW : grille de 4 cartes
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {articles.slice(0, 4).map((a) => (
                    <ArticleCard key={a.id} article={a} variant="grid" showExcerpt={false} />
                  ))}
                </div>
              )}
            </section>
          </Reveal>
        );
      })}
    </div>
  );
}
