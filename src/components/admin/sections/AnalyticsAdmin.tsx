'use client';

// ═══════════════════════════════════════════════════════════════
// ANALYTICS — Statistiques détaillées : période paramétrable,
// courbes d'audience, sources de trafic, top articles, publicité.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { StatCard } from '../ui/StatCard';
import { TrendChart, BarsChart } from '../ui/charts';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { isAuthError, formatNumber, formatPercent } from '../ui/helpers';
import {
  Users, Eye, MousePointerClick, Megaphone, ExternalLink, TrendingUp, Activity,
} from 'lucide-react';
import type { AdminStats } from '@/lib/types';

// Libellés FR des types d'événements de trafic
const EVENT_LABELS: Record<string, string> = {
  PAGE_VIEW: 'Pages vues',
  ARTICLE_VIEW: 'Lectures d’articles',
  SEARCH: 'Recherches',
  NEWSLETTER_SUB: 'Inscriptions newsletter',
  CONTACT: 'Contacts',
  AD_CLICK: 'Clics publicitaires',
};

export function AnalyticsAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);
  const [days, setDays] = React.useState(30);
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        const data = await adminApi.analytics(days);
        if (mounted) setStats(data);
      } catch (e) {
        if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
        toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Statistiques indisponibles.' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [days, toast, clearAdminSession]);

  const o = stats?.overview;
  const chartData = React.useMemo(
    () => (stats?.chart ?? []).map((p) => ({ date: p.date, Visites: p.visits, Vues: p.views })),
    [stats],
  );
  const trafficData = React.useMemo(
    () => (stats?.trafficSources ?? []).map((t) => ({ source: t.source, count: t.count })),
    [stats],
  );
  const totalVisits = (stats?.chart ?? []).reduce((s, p) => s + p.visits, 0);
  const totalViews = (stats?.chart ?? []).reduce((s, p) => s + p.views, 0);
  const perDay = totalVisits > 0 ? totalVisits / Math.max(1, (stats?.chart ?? []).length) : 0;

  return (
    <div className="space-y-5">
      {/* Sélecteur de période */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">Période analysée :</p>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-40" aria-label="Période d'analyse">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 derniers jours</SelectItem>
            <SelectItem value="14">14 derniers jours</SelectItem>
            <SelectItem value="30">30 derniers jours</SelectItem>
            <SelectItem value="90">90 derniers jours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cartes résumé */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Visites (${days} j)`} value={formatNumber(totalVisits)} loading={loading} icon={<Users className="h-5 w-5" />} sub={loading ? undefined : `${formatNumber(Math.round(perDay))} / jour en moyenne`} />
        <StatCard label={`Vues de pages (${days} j)`} value={formatNumber(totalViews)} loading={loading} icon={<Eye className="h-5 w-5" />} iconClassName="bg-teal-500/10 text-teal-600 dark:text-teal-400" />
        <StatCard label="Impressions pub" value={o ? formatNumber(o.adImpressions30d) : '—'} loading={loading} icon={<Megaphone className="h-5 w-5" />} iconClassName="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
        <StatCard label="Clics pub" value={o ? formatNumber(o.adClicks30d) : '—'} loading={loading} icon={<MousePointerClick className="h-5 w-5" />} iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400" sub={o ? `CTR ${formatPercent(o.adCtr)}` : undefined} />
      </div>

      {/* Courbe d'audience */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 font-editorial text-base">
            <Activity className="h-4 w-4 text-primary" /> Audience détaillée
          </CardTitle>
          <CardDescription>Visites et vues de pages sur la période.</CardDescription>
        </CardHeader>
        <CardContent className="pl-1">
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Aucune donnée sur cette période.</div>
          ) : (
            <TrendChart
              data={chartData}
              mode="line"
              series={[
                { key: 'Visites', label: 'Visites', color: 'var(--primary)' },
                { key: 'Vues', label: 'Vues', color: 'var(--chart-3)' },
              ]}
              height={320}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* Sources de trafic */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-editorial text-base">Interactions par type</CardTitle>
            <CardDescription>Événements enregistrés sur le site.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : trafficData.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Aucun événement enregistré.</div>
            ) : (
              <BarsChart
                data={trafficData}
                xKey="source"
                layout="vertical"
                bars={[{ key: 'count', label: 'Visites', color: 'var(--primary)' }]}
                height={300}
              />
            )}
          </CardContent>
        </Card>

        {/* Appareils (mobile / desktop / tablette — réels) */}
        {(stats?.devices ?? []).length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appareils (30 derniers jours)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(() => {
                  const total = (stats?.devices ?? []).reduce((s, d) => s + d.count, 0) || 1;
                  const labels: Record<string, string> = { mobile: 'Mobile', desktop: 'Ordinateur', tablet: 'Tablette', inconnu: 'Non identifié' };
                  return (stats?.devices ?? []).map((d) => (
                    <div key={d.device} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-sm text-muted-foreground">{labels[d.device] ?? d.device}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((d.count / total) * 100)}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {Math.round((d.count / total) * 100)} % ({d.count})
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Top articles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-editorial text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Articles les plus lus
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            {loading ? (
              <div className="space-y-2.5 px-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (stats?.topArticles ?? []).length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Aucun article publié pour l’instant.</p>
            ) : (
              <ol className="space-y-0.5">
                {(stats?.topArticles ?? []).slice(0, 8).map((a, i) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`#/article/${a.slug}`)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                    >
                      <span className="w-5 shrink-0 text-sm font-bold text-primary/60 tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.title}</span>
                        <span className="block text-xs text-muted-foreground">{a.categoryName}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatNumber(a.views)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance publicitaire */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-editorial text-base">Performance publicitaire</CardTitle>
          <CardDescription>Impressions, clics et CTR par campagne.</CardDescription>
        </CardHeader>
        <CardContent className="px-2">
          {loading ? (
            <Skeleton className="mx-2 h-48 w-auto" />
          ) : (stats?.adStats ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucune campagne publicitaire suivie.</p>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-120 text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Campagne</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Annonceur</th>
                    <th className="hidden px-3 py-2 font-medium md:table-cell">Emplacement</th>
                    <th className="px-3 py-2 text-right font-medium">Impressions</th>
                    <th className="px-3 py-2 text-right font-medium">Clics</th>
                    <th className="px-3 py-2 text-right font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats?.adStats ?? []).map((r) => (
                    <tr key={r.campaignId} className="border-b border-border/40 transition-colors hover:bg-accent/40">
                      <td className="max-w-52 truncate px-3 py-2 font-medium">{r.name}</td>
                      <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">{r.advertiser}</td>
                      <td className="hidden max-w-40 truncate px-3 py-2 text-muted-foreground md:table-cell">{r.placementLabel}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.impressions)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-primary">{formatPercent(r.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ExternalLink className="h-3 w-3" />
        Les statistiques d’audience sont collectées anonymement (type d’événement et page, sans données personnelles).
      </p>
    </div>
  );
}
