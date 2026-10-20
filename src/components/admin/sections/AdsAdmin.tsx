'use client';

// ═══════════════════════════════════════════════════════════════
// ADS ADMIN — Régie publicitaire : emplacements, campagnes
// (image ou HTML, ciblage device/catégorie, pondération) et
// statistiques (impressions, clics, CTR) + export CSV.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { AdCampaign, AdPlacement, Category } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MediaPicker } from '../ui/MediaPicker';
import { Field } from '../ui/Field';
import { StatCard } from '../ui/StatCard';
import { BarsChart } from '../ui/charts';
import {
  formatDate, formatNumber, formatPercent, isAuthError, toLocalInput, downloadExport,
} from '../ui/helpers';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Pencil, Trash2, Loader2, Megaphone, MousePointerClick, Eye,
  BarChart3, Download, Globe, Smartphone, Monitor, ImageIcon, Code2, Save, Youtube,
} from 'lucide-react';

const PLACEMENT_LABELS: Record<string, string> = {
  HEADER_BANNER: 'Bannière en-tête',
  SIDEBAR_TOP: 'Colonne latérale — haut',
  SIDEBAR_STICKY: 'Colonne latérale — collante',
  IN_ARTICLE: 'Dans l’article',
  NATIVE: 'Contenu sponsorisé',
  FOOTER_BANNER: 'Bannière pied de page',
  INTERSTITIAL: 'Interstitiel',
  STICKY_MOBILE: 'Bandeau mobile collant',
};

const DEVICE_META: Record<AdCampaign['deviceTargeting'], { label: string; icon: React.ElementType }> = {
  ALL: { label: 'Tous écrans', icon: Globe },
  MOBILE: { label: 'Mobile', icon: Smartphone },
  DESKTOP: { label: 'Desktop', icon: Monitor },
};

const EMPTY_FORM = {
  name: '',
  advertiser: '',
  placementId: '',
  mode: 'image' as 'image' | 'gif' | 'video' | 'html',
  imageUrl: '',
  htmlCode: '',
  videoUrl: '',
  targetUrl: '',
  weight: 1,
  deviceTargeting: 'ALL' as AdCampaign['deviceTargeting'],
  categoryTargeting: 'all',
  startDate: '',
  endDate: '',
  active: true,
};

export function AdsAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [placements, setPlacements] = React.useState<AdPlacement[]>([]);
  const [campaigns, setCampaigns] = React.useState<AdCampaign[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  // Dialog campagne
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdCampaign | null>(null);
  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<AdCampaign | null>(null);

  const handleErr = (e: unknown, fallback: string) => {
    if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
    toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : fallback });
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [plRes, cRes, catRes] = await Promise.all([
        adminApi.adPlacements(),
        adminApi.adCampaigns(),
        adminApi.categories().catch(() => ({ categories: [] as Category[] })),
      ]);
      setPlacements(plRes.placements);
      setCampaigns(cRes.campaigns);
      setCategories(catRes.categories);
    } catch (e) {
      handleErr(e, 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
     
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const placementById = React.useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
  const selectedPlacement = form.placementId ? placementById.get(form.placementId) : null;

  // ─── Emplacements ─────────────────────────────────────────────
  const updatePlacement = async (p: AdPlacement, patch: Partial<AdPlacement>) => {
    setPlacements((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    try {
      await adminApi.updateAdPlacement(p.id, patch);
      toast({ title: 'Emplacement mis à jour', description: PLACEMENT_LABELS[p.key] ?? p.label });
    } catch (e) {
      setPlacements((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...p } : x)));
      handleErr(e, 'Mise à jour impossible.');
    }
  };

  // ─── Campagnes : CRUD ─────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (c: AdCampaign) => {
    setEditing(c);
    setForm({
      name: c.name,
      advertiser: c.advertiser,
      placementId: c.placementId,
      mode: c.htmlCode ? 'html' : (c.mediaType ?? 'IMAGE').toLowerCase() as 'image' | 'gif' | 'video',
      imageUrl: c.imageUrl,
      htmlCode: c.htmlCode,
      videoUrl: c.videoUrl || '',
      targetUrl: c.targetUrl,
      weight: c.weight || 1,
      deviceTargeting: c.deviceTargeting,
      categoryTargeting: c.categoryTargeting || 'all',
      startDate: toLocalInput(c.startDate).slice(0, 10),
      endDate: toLocalInput(c.endDate).slice(0, 10),
      active: c.active,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.advertiser.trim() || !form.placementId) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Renseignez le nom, l’annonceur et l’emplacement.' });
      return;
    }
    if ((form.mode === 'image' || form.mode === 'gif') && !form.imageUrl) {
      toast({ variant: 'destructive', title: 'Visuel requis', description: 'Choisissez une image / un GIF ou changez de type de créatif.' });
      return;
    }
    if (form.mode === 'video' && !/^https:\/\/.+/i.test(form.videoUrl.trim())) {
      toast({ variant: 'destructive', title: 'URL vidéo requise', description: 'Renseignez l’URL de la vidéo (https://…fichier .mp4).' });
      return;
    }
    if (form.targetUrl.trim() && !/^https?:\/\//i.test(form.targetUrl.trim())) {
      toast({ variant: 'destructive', title: 'URL de destination invalide', description: 'L’URL doit commencer par http:// ou https://.' });
      return;
    }
    setBusy(true);
    const payload: Partial<AdCampaign> = {
      name: form.name.trim(),
      advertiser: form.advertiser.trim(),
      placementId: form.placementId,
      mediaType: form.mode === 'html' ? 'IMAGE' : (form.mode === 'image' ? 'IMAGE' : form.mode === 'gif' ? 'GIF' : 'VIDEO'),
      imageUrl: form.mode === 'image' || form.mode === 'gif' ? form.imageUrl : '',
      htmlCode: form.mode === 'html' ? form.htmlCode : '',
      videoUrl: form.mode === 'video' ? form.videoUrl.trim() : '',
      targetUrl: form.targetUrl.trim(),
      weight: form.weight,
      deviceTargeting: form.deviceTargeting,
      categoryTargeting: form.categoryTargeting === 'all' ? '' : form.categoryTargeting,
      startDate: form.startDate ? new Date(`${form.startDate}T00:00:00`).toISOString() : null,
      endDate: form.endDate ? new Date(`${form.endDate}T23:59:59`).toISOString() : null,
      active: form.active,
    };
    try {
      if (editing) {
        await adminApi.updateAdCampaign(editing.id, payload);
        toast({ title: 'Campagne modifiée', description: `« ${payload.name} » a été mise à jour.` });
      } else {
        await adminApi.createAdCampaign(payload);
        toast({ title: 'Campagne créée', description: `« ${payload.name} » est prête à diffuser.` });
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      handleErr(e, 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggleCampaign = async (c: AdCampaign, active: boolean) => {
    setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, active } : x)));
    try {
      await adminApi.updateAdCampaign(c.id, { active });
      toast({ title: active ? 'Campagne activée' : 'Campagne mise en pause', description: c.name });
    } catch (e) {
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !active } : x)));
      handleErr(e, 'Mise à jour impossible.');
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteAdCampaign(deleteTarget.id);
      toast({ title: 'Campagne supprimée', description: `« ${deleteTarget.name} » a été retirée.` });
      setDeleteTarget(null);
      load();
    } catch (e) {
      handleErr(e, 'Suppression impossible.');
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  // ─── Statistiques ─────────────────────────────────────────────
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof adminApi.adStats>>['stats']>([]);
  const [statsLoading, setStatsLoading] = React.useState(true);

  const loadStats = React.useCallback(async () => {
    setStatsLoading(true);
    try {
      const r = await adminApi.adStats();
      setStats(r.stats);
    } catch (e) {
      handleErr(e, 'Statistiques indisponibles.');
    } finally {
      setStatsLoading(false);
    }
     
  }, []);

  React.useEffect(() => { loadStats(); }, [loadStats]);

  const totalImpressions = stats.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = stats.reduce((s, r) => s + r.clicks, 0);
  const globalCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  const exportStatsCsv = () => {
    const header = 'Campagne;Annonceur;Emplacement;Impressions;Clics;CTR (%)';
    const lines = stats.map((r) =>
      [r.name, r.advertiser, r.placementLabel, r.impressions, r.clicks, (r.ctr * 100).toFixed(2).replace('.', ',')].join(';'),
    );
    downloadExport('stats-publicite.csv', [header, ...lines].join('\n'), 'csv');
    toast({ title: 'Export réussi', description: 'Les statistiques publicitaires ont été téléchargées.' });
  };

  return (
    <Tabs defaultValue="placements" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="placements" className="gap-1.5"><Eye className="h-3.5 w-3.5" /> Emplacements</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Campagnes</TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Statistiques</TabsTrigger>
        </TabsList>
        <Button size="sm" className="ml-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nouvelle campagne
        </Button>
      </div>

      {/* ═════════ EMPLACEMENTS ═════════ */}
      <TabsContent value="placements" className="mt-0">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {placements.map((p) => (
              <div key={p.id} className={cn('rounded-xl border p-4 transition-colors', p.active ? 'border-border/70 bg-card' : 'border-dashed border-border/60 bg-muted/30')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{PLACEMENT_LABELS[p.key] ?? p.label}</p>
                    <code className="text-[10px] text-muted-foreground">{p.format}</code>
                  </div>
                  <Switch checked={p.active} onCheckedChange={(c) => updatePlacement(p, { active: c })} aria-label={`Activer ${p.label}`} />
                </div>
                <div className="mt-3 space-y-2">
                  <Input
                    value={p.label}
                    onChange={(e) => setPlacements((prev) => prev.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)))}
                    onBlur={() => { if (p.label && p.label !== (PLACEMENT_LABELS[p.key] ?? p.label)) updatePlacement(p, { label: p.label }); }}
                    className="h-7 text-xs"
                    aria-label="Libellé affiché pour les annonceurs"
                  />
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="font-normal">
                      {p.campaignCount ?? 0} campagne(s)
                    </Badge>
                    {!p.active ? <span className="text-[11px] text-muted-foreground">Diffusion suspendue</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* ═════════ CAMPAGNES ═════════ */}
      <TabsContent value="campaigns" className="mt-0 space-y-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-14 text-muted-foreground">
            <Megaphone className="h-9 w-9 opacity-40" />
            <p className="text-sm">Aucune campagne. Créez votre première bannière publicitaire.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c) => {
              const DeviceIcon = DEVICE_META[c.deviceTargeting]?.icon ?? Globe;
              const placement = c.placementId ? placementById.get(c.placementId) : undefined;
              const period = c.startDate || c.endDate
                ? `${c.startDate ? formatDate(c.startDate) : '…'} → ${c.endDate ? formatDate(c.endDate) : '…'}`
                : 'Sans limite';
              const ctr = c.impressions > 0 ? c.clicks / c.impressions : 0;
              return (
                <div key={c.id} className={cn('flex flex-wrap items-center gap-3 rounded-xl border p-3', c.active ? 'border-border/70 bg-card' : 'border-border/50 bg-muted/30')}>
                  {/* Vignette */}
                  <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-muted/50">
                    {c.imageUrl ? (
                       
                      <img src={c.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        {c.htmlCode ? <Code2 className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                      </div>
                    )}
                  </div>
                  <div className="min-w-40 flex-1">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.advertiser} · {placement ? (PLACEMENT_LABELS[placement.key] ?? placement.label) : 'Emplacement'}</p>
                  </div>
                  <div className="hidden text-xs text-muted-foreground sm:block">
                    <p>{period}</p>
                    <p className="flex items-center gap-1"><DeviceIcon className="h-3 w-3" /> {DEVICE_META[c.deviceTargeting]?.label}</p>
                  </div>
                  <div className="hidden text-right md:block">
                    <p className="text-xs"><Eye className="mr-1 inline h-3 w-3" />{formatNumber(c.impressions)}</p>
                    <p className="text-xs"><MousePointerClick className="mr-1 inline h-3 w-3" />{formatNumber(c.clicks)} · {formatPercent(ctr, 1)}</p>
                  </div>
                  <Switch checked={c.active} onCheckedChange={(v) => toggleCampaign(c, v)} aria-label={`Activer ${c.name}`} />
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label={`Modifier ${c.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)} aria-label={`Supprimer ${c.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Dialog campagne ─── */}
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o && !busy) setDialogOpen(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <DialogHeader>
              <DialogTitle className="font-editorial">{editing ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle>
              <DialogDescription>Diffusez une image ou un code HTML personnalisé sur un emplacement.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nom de la campagne" required>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Banque Populaire — Q3" />
                </Field>
                <Field label="Annonceur" required>
                  <Input value={form.advertiser} onChange={(e) => setForm({ ...form, advertiser: e.target.value })} placeholder="Ex : Banque Populaire" />
                </Field>
              </div>
              <Field label="Emplacement" required hint="Chaque emplacement correspond à une zone du site.">
                <Select value={form.placementId || undefined} onValueChange={(v) => setForm({ ...form, placementId: v })}>
                  <SelectTrigger aria-label="Emplacement"><SelectValue placeholder="Choisir un emplacement" /></SelectTrigger>
                  <SelectContent>
                    {placements.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {PLACEMENT_LABELS[p.key] ?? p.label} — {p.format}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {selectedPlacement ? (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
                  <p className="font-bold text-primary">Dimensions attendues : {selectedPlacement.format}px</p>
                  {selectedPlacement.key === 'NATIVE' ? (
                    <p className="mt-1 text-muted-foreground">Format natif éditorial : visuel recommandé 1200×900 (ratio 4:3), rendu fluide dans la grille.</p>
                  ) : form.mode === 'video' ? (
                    <p className="mt-1 text-muted-foreground">Vidéo {selectedPlacement.key === 'STICKY_MOBILE' ? '320×50 (bandeau)' : selectedPlacement.format} — MP4 (H.264), ≤ 5 Mo, lecture automatique en muet.</p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">
                      Préparez votre {form.mode === 'gif' ? 'GIF animé' : 'visuel'} exactement à {selectedPlacement.format} pixels (JPG/PNG/{form.mode === 'gif' ? 'GIF' : 'WebP'}, ≤ 300 Ko recommandé)
                      {form.mode === 'gif' ? ', animation ≤ 15 s' : ''} pour un affichage net sans déformation (le visuel est recadré en « cover »).
                    </p>
                  )}
                </div>
              ) : null}

              <Field label="Créatif publicitaire">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button" size="sm" variant={form.mode === 'image' ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, mode: 'image' })}
                  >
                    <ImageIcon className="h-4 w-4" /> Image
                  </Button>
                  <Button
                    type="button" size="sm" variant={form.mode === 'gif' ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, mode: 'gif' })}
                  >
                    <ImageIcon className="h-4 w-4" /> GIF animé
                  </Button>
                  <Button
                    type="button" size="sm" variant={form.mode === 'video' ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, mode: 'video' })}
                  >
                    <Youtube className="h-4 w-4" /> Vidéo
                  </Button>
                  <Button
                    type="button" size="sm" variant={form.mode === 'html' ? 'default' : 'outline'}
                    onClick={() => setForm({ ...form, mode: 'html' })}
                  >
                    <Code2 className="h-4 w-4" /> Code HTML
                  </Button>
                </div>
              </Field>
              {form.mode === 'video' ? (
                <Field label="URL de la vidéo" hint="Lien direct vers un fichier .mp4 (lecture automatique en muet, clic = URL de destination).">
                  <Input
                    value={form.videoUrl}
                    onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                    placeholder="https://cdn.exemple.com/pub.mp4"
                    aria-label="URL de la vidéo publicitaire"
                  />
                </Field>
              ) : form.mode === 'image' || form.mode === 'gif' ? (
                <Field label={form.mode === 'gif' ? 'GIF animé (via médiathèque)' : 'Image (via médiathèque)'}>
                  <div className="flex items-center gap-3">
                    {form.imageUrl ? (

                      <img src={form.imageUrl} alt="Visuel" className="h-16 w-28 rounded-md border border-border/60 object-cover" />
                    ) : (
                      <div className="flex h-16 w-28 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                      {form.imageUrl ? 'Changer le visuel' : 'Choisir un visuel'}
                    </Button>
                    {form.imageUrl ? (
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setForm({ ...form, imageUrl: '' })}>Retirer</Button>
                    ) : null}
                  </div>
                </Field>
              ) : (
                <Field label="Code HTML" hint="Collez votre tag HTML (iframe, script de régie…) — injecté tel quel.">
                  <Textarea value={form.htmlCode} onChange={(e) => setForm({ ...form, htmlCode: e.target.value })} className="min-h-28 font-mono text-xs" placeholder="<iframe …></iframe>" />
                </Field>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="URL de destination" hint="Lien ouvert au clic sur la bannière.">
                  <Input value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} placeholder="https://annonceur.fr/offre" />
                </Field>
                <Field label="Poids de rotation" hint="Poids élevé = diffusion plus fréquente (1 à 10).">
                  <Input type="number" min={1} max={10} value={form.weight} onChange={(e) => setForm({ ...form, weight: Math.max(1, Number(e.target.value) || 1) })} />
                </Field>
                <Field label="Ciblage appareil">
                  <Select value={form.deviceTargeting} onValueChange={(v) => setForm({ ...form, deviceTargeting: v as AdCampaign['deviceTargeting'] })}>
                    <SelectTrigger aria-label="Ciblage appareil"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tous les écrans</SelectItem>
                      <SelectItem value="MOBILE">Mobile uniquement</SelectItem>
                      <SelectItem value="DESKTOP">Desktop uniquement</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Ciblage catégorie" hint="Vide = diffusée sur tout le site.">
                  <Select value={form.categoryTargeting || 'all'} onValueChange={(v) => setForm({ ...form, categoryTargeting: v })}>
                    <SelectTrigger aria-label="Ciblage catégorie"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes catégories</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Date de début">
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} aria-label="Date de début" />
                </Field>
                <Field label="Date de fin">
                  <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} aria-label="Date de fin" />
                </Field>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <span className="text-sm font-medium">Campagne active</span>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} aria-label="Campagne active" />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>Annuler</Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editing ? 'Enregistrer' : 'Créer la campagne'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      {/* ═════════ STATISTIQUES ═════════ */}
      <TabsContent value="stats" className="mt-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Impressions totales" value={formatNumber(totalImpressions)} loading={statsLoading} icon={<Eye className="h-5 w-5" />} />
          <StatCard label="Clics totaux" value={formatNumber(totalClicks)} loading={statsLoading} icon={<MousePointerClick className="h-5 w-5" />} iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <StatCard label="CTR global" value={formatPercent(globalCtr)} loading={statsLoading} icon={<BarChart3 className="h-5 w-5" />} iconClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <p className="mb-2 text-sm font-semibold">Impressions &amp; clics par campagne</p>
          {statsLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : stats.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Aucune donnée : lancez vos premières campagnes.</p>
          ) : (
            <BarsChart
              data={stats.map((r) => ({ name: r.name.length > 18 ? `${r.name.slice(0, 17)}…` : r.name, Impressions: r.impressions, Clics: r.clicks }))}
              xKey="name"
              bars={[
                { key: 'Impressions', label: 'Impressions', color: 'var(--primary)' },
                { key: 'Clics', label: 'Clics', color: 'var(--chart-3)' },
              ]}
              height={300}
            />
          )}
        </div>

        <div className="rounded-xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/60 p-3">
            <p className="text-sm font-semibold">Détail par campagne</p>
            <Button size="sm" variant="outline" onClick={exportStatsCsv} disabled={stats.length === 0}>
              <Download className="h-4 w-4" /> Exporter en CSV
            </Button>
          </div>
          <ScrollArea className="max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Campagne</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Annonceur</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Emplacement</th>
                  <th className="px-3 py-2 text-right font-medium">Impressions</th>
                  <th className="px-3 py-2 text-right font-medium">Clics</th>
                  <th className="px-3 py-2 text-right font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {statsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td colSpan={6} className="px-3 py-2.5"><Skeleton className="h-4 w-full" /></td>
                    </tr>
                  ))
                ) : stats.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Aucune statistique disponible.</td></tr>
                ) : (
                  stats.map((r) => (
                    <tr key={r.campaignId} className="border-b border-border/40 transition-colors hover:bg-accent/40">
                      <td className="max-w-52 truncate px-3 py-2.5 font-medium">{r.name}</td>
                      <td className="hidden max-w-36 truncate px-3 py-2.5 text-muted-foreground sm:table-cell">{r.advertiser}</td>
                      <td className="hidden max-w-40 truncate px-3 py-2.5 text-muted-foreground md:table-cell">{r.placementLabel}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(r.impressions)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(r.clicks)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-primary">{formatPercent(r.ctr)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollArea>
        </div>
      </TabsContent>

      <MediaPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(m) => { setForm((f) => ({ ...f, imageUrl: m.url })); setPickerOpen(false); }} title="Visuel publicitaire" />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer cette campagne ?"
        description={deleteTarget ? `« ${deleteTarget.name} » et ses statistiques seront définitivement supprimées.` : ''}
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={doDelete}
      />
    </Tabs>
  );
}
