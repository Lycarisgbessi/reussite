'use client';

// ═══════════════════════════════════════════════════════════════
// ARTICLE PAGE — barre de progression, fil d'Ariane, métadonnées,
// cover, like/favori, partage, corps (BlocksRenderer + pub in-article),
// tags, auteur, commentaires, newsletter inline, « À lire aussi ».
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bookmark,
  ChevronRight,
  Clock3,
  Eye,
  Heart,
  Loader2,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { publicApi } from '@/lib/api';
import { navigate, useMagazineStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import type { ArticleFull } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CategoryBadge } from '../mag/ArticleCard';
import { PageSkeleton } from '../mag/Skeletons';
import { SmartImage } from '../mag/SmartImage';
import { DrawCheck } from '../mag/DrawCheck';
import { SectionTitle } from '../mag/SectionTitle';
import { formatViews, initials, isValidEmail } from '../mag/helpers';
import { useDocumentTitle, useSocialMeta } from '@/hooks/use-document-title';
import { useI18n, useFormatDate } from '@/lib/i18n';
import { AdSlot } from '../ads/AdSlot';
import { BlocksRenderer } from './BlocksRenderer';
import { ShareButtons } from './ShareButtons';
import { AuthorBox } from './AuthorBox';
import { CommentsSection } from './CommentsSection';
import { cn } from '@/lib/utils';

export function ArticlePage({ slug }: { slug: string }) {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const readerKey = useMagazineStore((s) => s.readerKey);
  const favorites = useMagazineStore((s) => s.favorites);
  const toggleFavoriteLocal = useMagazineStore((s) => s.toggleFavoriteLocal);
  const { toast } = useToast();
  const { t } = useI18n();
  const { formatDate, relative } = useFormatDate();

  const [article, setArticle] = useState<ArticleFull | null>(null);
  useDocumentTitle(article?.title || undefined);
  useSocialMeta({
    title: article?.title,
    description: article?.excerpt || article?.subtitle,
    image: article?.coverImage || undefined,
  });
  const [related, setRelated] = useState<import('@/lib/types').ArticleSummary[]>([]);
  const [comments, setComments] = useState<import('@/lib/api').PublicComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  // Réinitialisation au changement de slug (pattern React : reset au rendu)
  const [prevSlug, setPrevSlug] = useState(slug);
  if (prevSlug !== slug) {
    setPrevSlug(slug);
    setLoading(true);
    setError(null);
    setArticle(null);
  }

  // Chargement de l'article
  useEffect(() => {
    let cancelled = false;
    window.scrollTo({ top: 0 });
    publicApi
      .article(slug)
      .then((res) => {
        if (cancelled) return;
        setArticle(res.article);
        setRelated(res.related || []);
        setComments(res.approvedComments || []);
        setLikeCount(res.article.likes || 0);
        setLiked(localStorage.getItem(`bh_liked_${res.article.id}`) === '1');
        publicApi.track('PAGE_VIEW', `/article/${slug}`);
        publicApi.track('ARTICLE_VIEW', `/article/${slug}`, { articleId: res.article.id });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : t('article.loadingError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Barre de progression de lecture
  useEffect(() => {
    const onScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      const pct = total > 0 ? Math.min(100, Math.max(0, (window.scrollY / total) * 100)) : 0;
      if (progressRef.current) progressRef.current.style.width = `${pct}%`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const like = () => {
    if (!article) return;
    if (liked) {
      toast({ title: t('article.alreadyLiked') });
      return;
    }
    publicApi
      .likeArticle(article.id)
      .then((res) => {
        setLikeCount(res.likes);
        setLiked(true);
        localStorage.setItem(`bh_liked_${article.id}`, '1');
      })
      .catch(() => toast({ title: t('article.likeError'), variant: 'destructive' }));
  };

  const isFavorite = article ? favorites.includes(article.id) : false;

  const toggleFavorite = async () => {
    if (!article || !readerKey) return;
    const wasFavorite = favorites.includes(article.id);
    toggleFavoriteLocal(article.id); // optimiste
    try {
      const res = await publicApi.toggleFavorite(readerKey, article.id);
      toast({ title: res.favorited ? t('article.favorited') : t('article.unfavorited') });
    } catch (err) {
      if (favorites.includes(article.id) === wasFavorite) toggleFavoriteLocal(article.id); // rollback
      toast({
        title: t('form.error'),
        description: err instanceof Error ? err.message : t('form.actionImpossible'),
        variant: 'destructive',
      });
    }
  };

  // ── États de chargement / erreur ───────────────────────────────
  if (loading) return <PageSkeleton />;
  if (error || !article) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-editorial text-2xl font-bold">{t('article.notFound')}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {error || t('article.notFoundDesc')}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate('/')} className="rounded-full">
            {t('article.backHome')}
          </Button>
          <Button onClick={() => navigate('/search')} className="rounded-full">
            {t('article.search')}
          </Button>
        </div>
      </div>
    );
  }

  const categorySlug = article.category?.slug;

  return (
    <article>
      {/* Barre de progression de lecture */}
      <div ref={progressRef} className="reading-progress w-0" aria-hidden="true" />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        {/* Fil d'Ariane */}
        <nav aria-label={t('article.breadcrumb')} className="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <a href="#/" className="transition-colors hover:text-primary">
            {t('nav.home')}
          </a>
          <ChevronRight className="size-3" aria-hidden="true" />
          <a href={`#/category/${categorySlug}`} className="transition-colors hover:text-primary">
            {article.category?.name}
          </a>
          <ChevronRight className="size-3" aria-hidden="true" />
          <span className="max-w-[280px] truncate sm:max-w-md">{article.title}</span>
        </nav>

        {/* En-tête */}
        <header>
          <CategoryBadge
            name={article.category?.name || t('common.article')}
            color={article.category?.color}
            className="mb-3"
          />
          <h1 className="font-editorial text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl lg:leading-[1.15]">
            {article.title}
          </h1>
          {article.subtitle ? (
            <p className="mt-3 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {article.subtitle}
            </p>
          ) : null}
          {article.excerpt ? (
            <p className="mt-4 border-l-2 border-primary/60 pl-4 text-sm italic leading-relaxed text-foreground/80 sm:text-[15px]">
              {article.excerpt}
            </p>
          ) : null}

          {/* Métadonnées */}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-y py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="size-9 border">
                <AvatarImage
                  src={article.authorFull?.avatarUrl || article.author?.avatarUrl}
                  alt={article.author?.name}
                />
                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                  {initials(article.author?.name || '?')}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-foreground">{article.author?.name}</span>
            </div>
            <span aria-hidden="true">·</span>
            <time dateTime={article.publishedAt || undefined}>
              {formatDate(article.publishedAt, 'd MMMM yyyy')}
            </time>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-4" aria-hidden="true" />
              {article.readingTime} {t('article.readingTime')}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="size-4" aria-hidden="true" />
              {formatViews(article.views)} {t('article.views')}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-4" aria-hidden="true" />
              {comments.length}
            </span>
          </div>
        </header>

        {/* Image de couverture */}
        <figure className="mt-8">
          <div className="overflow-hidden rounded-lg">
            <SmartImage
              src={article.coverImage}
              alt={article.title}
              className="aspect-video w-full object-cover"
              fallbackLabel={article.title}
            />
          </div>
          {article.coverCredit ? (
            <figcaption className="mt-2 text-right text-xs text-muted-foreground">
              {t('article.photo')} {article.coverCredit}
            </figcaption>
          ) : null}
        </figure>

        {/* Barre d'actions : like / favori / partage */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant={liked ? 'default' : 'outline'}
              onClick={like}
              aria-pressed={liked}
              className="min-h-[44px] rounded-full px-5"
              aria-label={t('article.like')}
            >
              <motion.span
                key={liked ? 'liked' : 'unliked'}
                initial={{ scale: liked ? 0.4 : 1 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                className="inline-flex items-center gap-2"
              >
                <Heart className={cn('size-4', liked && 'fill-current')} aria-hidden="true" />
                {likeCount}
              </motion.span>
            </Button>
            <Button
              variant={isFavorite ? 'default' : 'outline'}
              onClick={toggleFavorite}
              aria-pressed={isFavorite}
              className="min-h-[44px] rounded-full px-5"
              aria-label={t('article.addFavorites')}
            >
              <Bookmark className={cn('size-4', isFavorite && 'fill-current')} aria-hidden="true" />
              {t('article.favorite')}
            </Button>
          </div>
          <ShareButtons title={article.title} />
        </div>

        {/* Corps de l'article + pub in-article après le 2e bloc */}
        <div className="mt-8">
          <BlocksRenderer
            blocks={article.content || []}
            adAfter={1}
            adSlot={<AdSlot placement="IN_ARTICLE" category={categorySlug} />}
          />
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 ? (
          <div className="mt-10 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{t('article.tags')}</span>
            {article.tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer rounded-full px-3 py-1 transition-colors hover:bg-primary hover:text-primary-foreground"
                onClick={() => navigate(`/search?q=${encodeURIComponent(tag)}`)}
              >
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {/* Auteur */}
        <div className="mt-10">
          <AuthorBox author={article.authorFull} />
        </div>

        {/* Newsletter inline */}
        <InlineNewsletter />

        {/* Commentaires */}
        <CommentsSection articleId={article.id} comments={comments} />
      </div>

      {/* À lire aussi */}
      {related.length > 0 ? (
        <div className="border-t bg-secondary/30">
          <div className="mx-auto max-w-7xl px-4 py-12">
            <SectionTitle eyebrow={t('article.relatedEyebrow')} title={t('article.relatedTitle')} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.slice(0, 4).map((a) => (
                <a key={a.id} href={`#/article/${a.slug}`} className="article-card group overflow-hidden rounded-xl border bg-card">
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <SmartImage
                      src={a.coverImage}
                      alt={a.title}
                      className="card-image h-full w-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <CategoryBadge name={a.category?.name} color={a.category?.color} />
                    <h3 className="mt-2 font-editorial text-base font-bold leading-snug transition-colors group-hover:text-primary">
                      <span className="line-clamp-2">{a.title}</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">{relative(a.publishedAt)}</p>
                  </div>
                </a>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button
                variant="ghost"
                onClick={() => navigate(`/category/${categorySlug}`)}
                className="rounded-full text-primary"
              >
                {t('article.allCategoryArticles')} {article.category?.name}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

// ─── Newsletter inline fin d'article ────────────────────────────
function InlineNewsletter() {
  const { toast } = useToast();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast({ title: t('form.invalidEmail'), variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await publicApi.subscribeNewsletter({ email: email.trim(), source: 'article' });
      setDone(true);
      toast({ title: t('form.subscribedTitle'), description: t('form.seeYouSoon') });
    } catch (err) {
      toast({
        title: t('form.error'),
        description: err instanceof Error ? err.message : t('form.retryLater'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-10 flex flex-col items-center gap-4 border-primary/25 bg-accent/40 p-6 text-center sm:p-8">
      <Mail className="size-8 text-primary" aria-hidden="true" />
      <p className="font-editorial text-xl font-bold">{t('article.missAnalysis')}</p>
      <p className="max-w-md text-sm text-muted-foreground">{t('article.newsletterInline')}</p>
      {done ? (
        <div className="flex items-center gap-3">
          <DrawCheck className="size-9" />
          <p className="text-sm font-medium">{t('footer.subscribed')}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('form.emailPlaceholder')}
            aria-label={t('article.emailLabel')}
            className="h-11 flex-1 rounded-full"
          />
          <Button type="submit" disabled={busy} className="h-11 rounded-full px-6">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {t('footer.subscribe')}
          </Button>
        </form>
      )}
    </Card>
  );
}
