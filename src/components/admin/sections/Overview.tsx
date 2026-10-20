'use client';

// ═══════════════════════════════════════════════════════════════
// OVERVIEW — Tableau de bord principal : KPI, graphique 30 jours,
// top articles, actions rapides.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { StatCard } from '../ui/StatCard';
import { TrendChart } from '../ui/charts';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isAuthError, formatNumber, formatPercent, formatDate } from '../ui/helpers';
import {
  Users, FileText, MessageSquare, Mail, Megaphone, MousePointerClick,
  MonitorPlay, Mic, Plus, PenLine, TrendingUp, ExternalLink, Activity,
} from 'lucide-react';
import type { AdminStats } from '@/lib/types';

export function Overview() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await adminApi.stats();
        if (mounted) setStats(data);
      } catch (e) {
        if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
        toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Statistiques indisponibles.' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [toast, clearAdminSession]);

  const o = stats?.overview;

  const chartData = React.useMemo(
    () => (stats?.chart ?? []).map((p) => ({ date: p.date, Visites: p.visits, Vues: p.views })),
    [stats],
  );

  return (
    <div className="space-y-6">
      {/* ─── Actions rapides ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => navigate('#/admin/editor')}>
          <Plus className="h-4 w-4" /> Nouvel article
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('#/admin/ads')}>
          <Megaphone className="h-4 w-4" /> Nouvelle bannière
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('#/admin/comments')}>
          <MessageSquare className="h-4 w-4" /> Modérer les commentaires
          {o && o.commentsPending > 0 ? (
            <Badge className="ml-1 bg-primary text-primary-foreground">{o.commentsPending}</Badge>
          ) : null}
        </Button>
      </div>

      {/* ─── Cartes KPI ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Visites (30 j)"
          value={o ? formatNumber(o.visits30d) : '—'}
          loading={loading}
          icon={<Users className="h-5 w-5" />}
          sub={o ? `${formatNumber(o.visits7d)} sur les 7 derniers jours` : ''}
        />
        <StatCard
          label="Articles publiés"
          value={o ? formatNumber(o.articlesPublished) : '—'}
          loading={loading}
          icon={<FileText className="h-5 w-5" />}
          iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          sub={o ? `${formatNumber(o.articlesDraft)} brouillon(s)` : ''}
          onClick={() => navigate('#/admin/articles')}
        />
        <StatCard
          label="Commentaires en attente"
          value={o ? formatNumber(o.commentsPending) : '—'}
          loading={loading}
          icon={<MessageSquare className="h-5 w-5" />}
          iconClassName="bg-orange-500/10 text-orange-600 dark:text-orange-400"
          sub="À modérer"
          onClick={() => navigate('#/admin/comments')}
        />
        <StatCard
          label="Abonnés newsletter"
          value={o ? formatNumber(o.newsletterSubscribers) : '—'}
          loading={loading}
          icon={<Mail className="h-5 w-5" />}
          iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400"
          sub={o ? `${formatNumber(o.newsletterActive)} actif(s)` : ''}
          onClick={() => navigate('#/admin/newsletter')}
        />
        <StatCard
          label="Impressions pub (30 j)"
          value={o ? formatNumber(o.adImpressions30d) : '—'}
          loading={loading}
          icon={<Megaphone className="h-5 w-5" />}
          sub={o ? `${formatNumber(o.adsActive)} campagne(s) active(s)` : ''}
          onClick={() => navigate('#/admin/ads')}
        />
        <StatCard
          label="CTR publicitaire"
          value={o ? formatPercent(o.adCtr) : '—'}
          loading={loading}
          icon={<MousePointerClick className="h-5 w-5" />}
          iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          sub={o ? `${formatNumber(o.adClicks30d)} clics sur 30 j` : ''}
          onClick={() => navigate('#/admin/ads')}
        />
        <StatCard
          label="Vidéos"
          value={o ? formatNumber(o.videos) : '—'}
          loading={loading}
          icon={<MonitorPlay className="h-5 w-5" />}
          iconClassName="bg-red-500/10 text-red-600 dark:text-red-400"
          onClick={() => navigate('#/admin/videos')}
        />
        <StatCard
          label="Podcasts"
          value={o ? formatNumber(o.podcasts) : '—'}
          loading={loading}
          icon={<Mic className="h-5 w-5" />}
          iconClassName="bg-teal-500/10 text-teal-600 dark:text-teal-400"
          onClick={() => navigate('#/admin/podcasts')}
        />
      </div>

      {/* ─── Graphique + Top articles ─── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-editorial text-base">
              <Activity className="h-4 w-4 text-primary" /> Audience des 30 derniers jours
            </CardTitle>
            <CardDescription>Visites et vues de pages, jour par jour.</CardDescription>
          </CardHeader>
          <CardContent className="pl-1">
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                Aucune donnée d’audience pour le moment.
              </div>
            ) : (
              <TrendChart
                data={chartData}
                series={[
                  { key: 'Visites', label: 'Visites', color: 'var(--primary)' },
                  { key: 'Vues', label: 'Vues', color: 'var(--chart-3)' },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-editorial text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Top 5 des articles
            </CardTitle>
            <CardDescription>Les contenus les plus lus.</CardDescription>
          </CardHeader>
          <CardContent className="px-2">
            {loading ? (
              <div className="space-y-3 px-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (stats?.topArticles ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun article publié pour l’instant.</p>
            ) : (
              <ol className="space-y-1">
                {(stats?.topArticles ?? []).slice(0, 5).map((a, i) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`#/article/${a.slug}`)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <span className="w-5 shrink-0 font-editorial text-lg font-bold text-primary/60 tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.title}</span>
                        <span className="block text-xs text-muted-foreground">{a.categoryName}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold tabular-nums">{formatNumber(a.views)}</span>
                        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">vues</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 px-2">
              <Button variant="ghost" size="sm" className="w-full gap-1.5 text-muted-foreground" onClick={() => navigate('#/admin/analytics')}>
                Voir toutes les statistiques <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── État de la rédaction ─── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-editorial text-base">
            <PenLine className="h-4 w-4 text-primary" /> État de la rédaction
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Articles publiés</p>
                <p className="mt-1 font-editorial text-xl font-semibold">{o ? formatNumber(o.articlesPublished) : '—'}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">En attente de publication</p>
                <p className="mt-1 font-editorial text-xl font-semibold">{o ? formatNumber(o.articlesDraft) : '—'}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vues cumulées du site</p>
                <p className="mt-1 font-editorial text-xl font-semibold">{o ? formatNumber(o.totalViews) : '—'}</p>
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Données arrêtées au {formatDate(new Date().toISOString(), true)}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
