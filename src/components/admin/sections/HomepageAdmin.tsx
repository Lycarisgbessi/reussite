'use client';

// ═══════════════════════════════════════════════════════════════
// HOMEPAGE ADMIN — Configuration de la page d'accueil :
// onglets [À la Une] (drag & drop + saveFeatured), [Flash info],
// [Blocs] (drag & drop + saveHomeBlocks), [Popup newsletter].
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type {
  ArticleSummary, Category, FlashInfoItem, HomeBlockConfig, NewsletterPopupConfig, SiteSettings,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SortableItem } from '../ui/SortableItem';
import { Field } from '../ui/Field';
import { formatDate, isAuthError } from '../ui/helpers';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { TranslationsDialog } from '../ui/TranslationsDialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  Plus, Trash2, Star, Loader2, ArrowUp, ArrowDown, Zap, LayoutGrid,
  MailOpen, Save, MoveVertical, ImageOff, Pencil, Languages,
} from 'lucide-react';

// Libellés FR des types de blocs d'accueil connus
const BLOCK_TYPE_LABELS: Record<string, string> = {
  HERO: 'Carrousel à la une',
  FLASH: 'Flash info',
  CATEGORY_BLOCK: 'Bloc catégorie',
  LATEST: 'Derniers articles',
  POPULAR: 'Articles populaires',
  VIDEOS: 'Dernières vidéos',
  PODCASTS: 'Derniers podcasts',
  NEWSLETTER: 'Bloc newsletter',
  PARTNERS: 'Partenaires',
};

export function HomepageAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  // Référentiels
  const [published, setPublished] = React.useState<ArticleSummary[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [flashInfos, setFlashInfos] = React.useState<FlashInfoItem[]>([]);
  const [blocks, setBlocks] = React.useState<HomeBlockConfig[]>([]);
  const [settings, setSettings] = React.useState<SiteSettings | null>(null);

  // À la une
  const [featuredIds, setFeaturedIds] = React.useState<string[]>([]);
  const [featuredDirty, setFeaturedDirty] = React.useState(false);

  // Flash info
  const [flashDialog, setFlashDialog] = React.useState(false);
  const [flashEditing, setFlashEditing] = React.useState<FlashInfoItem | null>(null);
  const [flashForm, setFlashForm] = React.useState({ text: '', link: '', active: true });
  const [flashDelete, setFlashDelete] = React.useState<FlashInfoItem | null>(null);
  const [flashTranslate, setFlashTranslate] = React.useState<FlashInfoItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleErr = (e: unknown, fallback: string) => {
    if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
    toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : fallback });
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [artRes, catRes, flashRes, blockRes, settingsRes] = await Promise.allSettled([
          adminApi.articles({ status: 'PUBLISHED', limit: 50 }),
          adminApi.categories(),
          adminApi.flashInfos(),
          adminApi.homeBlocks(),
          adminApi.settings(),
        ]);
        if (!mounted) return;
        if (artRes.status === 'fulfilled') setPublished(artRes.value.items);
        if (catRes.status === 'fulfilled') setCategories(catRes.value.categories);
        if (flashRes.status === 'fulfilled') setFlashInfos([...flashRes.value.items].sort((a, b) => a.order - b.order));
        if (blockRes.status === 'fulfilled') {
          const sorted = [...blockRes.value.blocks].sort((a, b) => a.order - b.order);
          setBlocks(sorted);
        }
        if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.settings);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Articles à la une triés par featuredOrder
  React.useEffect(() => {
    const featured = published
      .filter((a) => a.featured)
      .sort((a, b) => a.featuredOrder - b.featuredOrder)
      .map((a) => a.id);
    setFeaturedIds(featured);
    setFeaturedDirty(false);
  }, [published]);

  const articleById = React.useMemo(() => new Map(published.map((a) => [a.id, a])), [published]);
  const featuredArticles = featuredIds
    .map((id) => articleById.get(id))
    .filter((a): a is ArticleSummary => Boolean(a));
  const availableArticles = published.filter((a) => !featuredIds.includes(a.id));

  const handleFeaturedDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFeaturedIds((prev) => arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id))));
    setFeaturedDirty(true);
  };

  const addFeatured = (id: string) => {
    setFeaturedIds((prev) => [...prev, id]);
    setFeaturedDirty(true);
  };
  const removeFeatured = (id: string) => {
    setFeaturedIds((prev) => prev.filter((x) => x !== id));
    setFeaturedDirty(true);
  };

  const saveFeaturedOrder = async () => {
    setBusy(true);
    try {
      await adminApi.saveFeatured(featuredIds);
      toast({ title: 'À la une enregistré', description: 'Le carrousel de la page d’accueil est à jour.' });
      setFeaturedDirty(false);
      // Rafraîchit les flags featured côté liste
      const res = await adminApi.articles({ status: 'PUBLISHED', limit: 50 });
      setPublished(res.items);
    } catch (e) {
      handleErr(e, 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  // ─── Flash info ───────────────────────────────────────────────
  const openFlashCreate = () => {
    setFlashEditing(null);
    setFlashForm({ text: '', link: '', active: true });
    setFlashDialog(true);
  };
  const openFlashEdit = (f: FlashInfoItem) => {
    setFlashEditing(f);
    setFlashForm({ text: f.text, link: f.link, active: f.active });
    setFlashDialog(true);
  };

  const submitFlash = async () => {
    if (!flashForm.text.trim()) {
      toast({ variant: 'destructive', title: 'Texte requis', description: 'Renseignez le message du flash info.' });
      return;
    }
    setBusy(true);
    try {
      if (flashEditing) {
        await adminApi.updateFlashInfo(flashEditing.id, flashForm);
        toast({ title: 'Flash info modifié', description: 'Le message a été mis à jour.' });
      } else {
        await adminApi.createFlashInfo({ ...flashForm, order: flashInfos.length });
        toast({ title: 'Flash info ajouté', description: 'Le message apparaît dans le bandeau défilant.' });
      }
      setFlashDialog(false);
      const r = await adminApi.flashInfos();
      setFlashInfos([...r.items].sort((a, b) => a.order - b.order));
    } catch (e) {
      handleErr(e, 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggleFlash = async (f: FlashInfoItem, active: boolean) => {
    setFlashInfos((prev) => prev.map((x) => (x.id === f.id ? { ...x, active } : x)));
    try {
      await adminApi.updateFlashInfo(f.id, { active });
    } catch (e) {
      setFlashInfos((prev) => prev.map((x) => (x.id === f.id ? { ...x, active: !active } : x)));
      handleErr(e, 'Mise à jour impossible.');
    }
  };

  const moveFlash = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= flashInfos.length) return;
    const next = [...flashInfos];
    [next[index], next[target]] = [next[target], next[index]];
    setFlashInfos(next.map((f, i) => ({ ...f, order: i })));
    try {
      await Promise.all(next.map((f, i) => adminApi.updateFlashInfo(f.id, { order: i })));
    } catch (e) {
      handleErr(e, 'Réordonnancement impossible.');
    }
  };

  const doDeleteFlash = async () => {
    if (!flashDelete) return;
    setBusy(true);
    try {
      await adminApi.deleteFlashInfo(flashDelete.id);
      toast({ title: 'Flash info supprimé', description: 'Le message a été retiré du bandeau.' });
      setFlashDelete(null);
      const r = await adminApi.flashInfos();
      setFlashInfos([...r.items].sort((a, b) => a.order - b.order));
    } catch (e) {
      handleErr(e, 'Suppression impossible.');
      setFlashDelete(null);
    } finally {
      setBusy(false);
    }
  };

  // ─── Blocs d'accueil ──────────────────────────────────────────
  const handleBlocksDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex((b) => b.id === String(active.id));
    const to = blocks.findIndex((b) => b.id === String(over.id));
    const next = arrayMove(blocks, from, to).map((b, i) => ({ ...b, order: i }));
    setBlocks(next);
  };

  const patchBlock = (id: string, patch: Partial<HomeBlockConfig>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const saveBlocks = async () => {
    setBusy(true);
    try {
      const payload = blocks.map((b, i) => ({ ...b, order: i }));
      const { blocks: saved } = await adminApi.saveHomeBlocks(payload);
      setBlocks([...saved].sort((a, b) => a.order - b.order));
      toast({ title: 'Blocs enregistrés', description: 'La structure de la page d’accueil est à jour.' });
    } catch (e) {
      handleErr(e, 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  // ─── Popup newsletter ─────────────────────────────────────────
  const [popup, setPopup] = React.useState<NewsletterPopupConfig>({
    enabled: false, title: '', text: '', trigger: 'TIME', delaySeconds: 15, scrollPercent: 40, frequency: 'SESSION',
  });
  const [popupLoaded, setPopupLoaded] = React.useState(false);
  React.useEffect(() => {
    if (settings && !popupLoaded) {
      setPopup({
        enabled: settings.newsletterPopupEnabled,
        title: settings.newsletterPopupTitle,
        text: settings.newsletterPopupText,
        trigger: settings.newsletterPopupTrigger,
        delaySeconds: settings.newsletterPopupDelay,
        scrollPercent: settings.newsletterPopupScroll,
        frequency: settings.newsletterPopupFrequency,
      });
      setPopupLoaded(true);
    }
  }, [settings, popupLoaded]);

  const savePopup = async () => {
    setBusy(true);
    try {
      await adminApi.saveSettings({
        newsletterPopupEnabled: popup.enabled,
        newsletterPopupTitle: popup.title,
        newsletterPopupText: popup.text,
        newsletterPopupTrigger: popup.trigger,
        newsletterPopupDelay: popup.delaySeconds,
        newsletterPopupScroll: popup.scrollPercent,
        newsletterPopupFrequency: popup.frequency,
      });
      toast({ title: 'Réglages enregistrés', description: 'La popup newsletter est configurée.' });
    } catch (e) {
      handleErr(e, 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────
  const heroArticle = featuredArticles[0];

  return (
    <Tabs defaultValue="featured" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="featured" className="gap-1.5"><Star className="h-3.5 w-3.5" /> À la Une</TabsTrigger>
        <TabsTrigger value="flash" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Flash info</TabsTrigger>
        <TabsTrigger value="blocks" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Blocs</TabsTrigger>
        <TabsTrigger value="popup" className="gap-1.5"><MailOpen className="h-3.5 w-3.5" /> Popup newsletter</TabsTrigger>
      </TabsList>

      {/* ═════════ Onglet À LA UNE ═════════ */}
      <TabsContent value="featured" className="space-y-4">
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Articles à la une (ordonnés) */}
            <div className="rounded-xl border border-border/70 bg-card">
              <div className="flex items-center justify-between gap-4 border-b border-border/60 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Carrousel à la une ({featuredIds.length}/6)</p>
                  <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      className="scale-90"
                      checked={settings?.autoFeature ?? true}
                      onCheckedChange={async (v) => {
                        setSettings((prev) => (prev ? { ...prev, autoFeature: v } : prev));
                        try {
                          await adminApi.saveSettings({ autoFeature: v });
                          toast({ title: v ? 'Mise en une automatique activée' : 'Mise en une automatique désactivée' });
                        } catch {
                          setSettings((prev) => (prev ? { ...prev, autoFeature: !v } : prev));
                          toast({ variant: 'destructive', title: 'Erreur', description: 'Réglage non enregistré.' });
                        }
                      }}
                      aria-label="Mise en une automatique"
                    />
                    Chaque nouvel article publié passe automatiquement à la une (désactivable par article).
                  </label>
                </div>
                <Button size="sm" onClick={saveFeaturedOrder} disabled={busy || !featuredDirty}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </Button>
              </div>
              {featuredIds.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Aucun article à la une. Ajoutez-en depuis la liste de droite.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFeaturedDragEnd}>
                  <SortableContext items={featuredIds} strategy={verticalListSortingStrategy}>
                    <ul className="divide-y divide-border/60 p-1">
                      {featuredArticles.map((a, i) => (
                        <li key={a.id}>
                          <SortableItem id={a.id} className="px-2">
                            <div className="flex flex-1 items-center gap-3 py-2 min-w-0">
                              <span className="w-5 shrink-0 text-center font-editorial text-sm font-bold text-primary/70">{i + 1}</span>
                              <div className="h-11 w-16 shrink-0 overflow-hidden rounded bg-muted/50">
                                {a.coverImage ? (
                                   
                                  <img src={a.coverImage} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-muted-foreground"><ImageOff className="h-4 w-4" /></div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{a.title}</p>
                                <p className="text-xs text-muted-foreground">{a.category?.name}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:text-destructive" onClick={() => removeFeatured(a.id)} aria-label={`Retirer ${a.title} de la une`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </SortableItem>
                        </li>
                      ))}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            {/* Articles disponibles */}
            <div className="rounded-xl border border-border/70 bg-card">
              <div className="border-b border-border/60 p-3">
                <p className="text-sm font-semibold">Articles publiés disponibles</p>
                <p className="text-xs text-muted-foreground">Cliquez sur « Ajouter » pour placer un article à la une.</p>
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar p-2">
                {availableArticles.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">Tous les articles publiés sont déjà à la une.</p>
                ) : (
                  <ul className="space-y-1">
                    {availableArticles.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent">
                        <div className="h-9 w-14 shrink-0 overflow-hidden rounded bg-muted/50">
                          {a.coverImage ? (
                             
                            <img src={a.coverImage} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{a.category?.name} · {formatDate(a.publishedAt)}</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={() => addFeatured(a.id)} disabled={featuredIds.length >= 6}>
                          <Plus className="h-3.5 w-3.5" /> Ajouter
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Aperçu du hero */}
        {heroArticle ? (
          <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-4">
            <p className="eyebrow mb-2 text-primary">Aperçu du hero</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="overflow-hidden rounded-lg">
                {heroArticle.coverImage ? (
                   
                  <img src={heroArticle.coverImage} alt="" className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-muted-foreground"><ImageOff className="h-8 w-8" /></div>
                )}
              </div>
              <div className="flex flex-col justify-center">
                <Badge variant="outline" className="w-fit gap-1.5" style={{ borderColor: heroArticle.category?.color }}>
                  {heroArticle.category?.name}
                </Badge>
                <p className="mt-2 font-editorial text-xl font-bold leading-snug">{heroArticle.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{heroArticle.subtitle}</p>
                <Button variant="link" size="sm" className="mt-2 w-fit px-0" onClick={() => navigate(`#/article/${heroArticle.slug}`)}>
                  Voir sur le site
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </TabsContent>

      {/* ═════════ Onglet FLASH INFO ═════════ */}
      <TabsContent value="flash" className="space-y-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Messages défilants affichés en haut du site.</p>
          <Button size="sm" className="ml-auto" onClick={openFlashCreate}>
            <Plus className="h-4 w-4" /> Nouveau message
          </Button>
        </div>
        {/* Alimentation automatique (repli sur les derniers articles) */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-card p-4">
          <div>
            <p className="text-sm font-medium">Alimentation automatique</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Si aucun message actif n’est défini, le bandeau diffuse automatiquement les titres
              des derniers articles publiés — le flash info tourne en permanence.
            </p>
          </div>
          <Switch
            checked={settings?.flashInfoAuto ?? true}
            onCheckedChange={async (v) => {
              setSettings((prev) => (prev ? { ...prev, flashInfoAuto: v } : prev));
              try {
                await adminApi.saveSettings({ flashInfoAuto: v });
                toast({ title: v ? 'Alimentation automatique activée' : 'Alimentation automatique désactivée' });
              } catch {
                setSettings((prev) => (prev ? { ...prev, flashInfoAuto: !v } : prev));
                toast({ variant: 'destructive', title: 'Erreur', description: 'Réglage non enregistré.' });
              }
            }}
            aria-label="Alimentation automatique du flash info"
          />
        </div>
        <div className="rounded-xl border border-border/70 bg-card">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : flashInfos.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Aucun flash info. Créez votre premier message défilant.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {flashInfos.map((f, i) => (
                <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                  <MoveVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm', !f.active && 'text-muted-foreground line-through')}>{f.text}</p>
                    {f.link ? <a href={`#${f.link.replace(/^#/, '')}`} className="truncate text-xs text-primary hover:underline">{f.link}</a> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFlashTranslate(f)} aria-label={`Traductions ${f.text}`} title="Traductions">
                      <Languages className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => moveFlash(i, -1)} aria-label="Monter">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === flashInfos.length - 1} onClick={() => moveFlash(i, 1)} aria-label="Descendre">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Switch checked={f.active} onCheckedChange={(c) => toggleFlash(f, c)} aria-label={`Activer ${f.text}`} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openFlashEdit(f)} aria-label="Modifier">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setFlashDelete(f)} aria-label="Supprimer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Dialog open={flashDialog} onOpenChange={(o) => { if (!o) setFlashDialog(false); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-editorial">{flashEditing ? 'Modifier le message' : 'Nouveau flash info'}</DialogTitle>
              <DialogDescription>Message court affiché dans le bandeau défilant.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Field label="Texte du message" required counter={<span>{flashForm.text.length}/120</span>}>
                <Input value={flashForm.text} onChange={(e) => setFlashForm({ ...flashForm, text: e.target.value })} maxLength={120} placeholder="Ex : Nouveau dossier : réussir sa levée de fonds" />
              </Field>
              <Field label="Lien (optionnel)" hint="Ex : /article/mon-slug ou /videos">
                <Input value={flashForm.link} onChange={(e) => setFlashForm({ ...flashForm, link: e.target.value })} placeholder="/article/…" />
              </Field>
              <label className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <span className="text-sm font-medium">Message actif</span>
                <Switch checked={flashForm.active} onCheckedChange={(v) => setFlashForm({ ...flashForm, active: v })} aria-label="Message actif" />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFlashDialog(false)} disabled={busy}>Annuler</Button>
              <Button onClick={submitFlash} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {flashEditing ? 'Enregistrer' : 'Ajouter'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={flashDelete !== null}
          onOpenChange={(o) => { if (!o) setFlashDelete(null); }}
          title="Supprimer ce flash info ?"
          description={flashDelete?.text}
          confirmLabel="Supprimer"
          loading={busy}
          onConfirm={doDeleteFlash}
        />
      </TabsContent>

      {/* ═════════ Onglet BLOCS ═════════ */}
      <TabsContent value="blocks" className="space-y-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Glissez-déposez pour réorganiser les sections de la page d’accueil.</p>
          <Button size="sm" className="ml-auto" onClick={saveBlocks} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer les blocs
          </Button>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBlocksDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {blocks.map((b) => (
                  <li key={b.id}>
                    <SortableItem id={b.id} className="rounded-xl border border-border/70 bg-card px-3 py-3">
                      <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
                        <Badge variant="secondary" className="shrink-0 font-normal">
                          {BLOCK_TYPE_LABELS[b.type] ?? b.type}
                        </Badge>
                        <Input
                          value={b.title}
                          onChange={(e) => patchBlock(b.id, { title: e.target.value })}
                          className="h-8 max-w-56 flex-1 text-sm"
                          aria-label={`Titre du bloc ${b.title}`}
                        />
                        {b.type === 'CATEGORY_BLOCK' ? (
                          <Select value={b.categorySlug || 'none'} onValueChange={(v) => patchBlock(b.id, { categorySlug: v === 'none' ? '' : v })}>
                            <SelectTrigger className="h-8 w-48" aria-label="Catégorie du bloc">
                              <SelectValue placeholder="Catégorie…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Toutes catégories</SelectItem>
                              {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : null}
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Actif</span>
                          <Switch checked={b.enabled} onCheckedChange={(v) => patchBlock(b.id, { enabled: v })} aria-label={`Activer le bloc ${b.title}`} />
                        </div>
                      </div>
                    </SortableItem>
                  </li>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </TabsContent>

      {/* ═════════ Onglet POPUP NEWSLETTER ═════════ */}
      <TabsContent value="popup">
        {!settings && loading ? (
          <Skeleton className="h-96 w-full max-w-xl" />
        ) : (
          <div className="max-w-xl space-y-4 rounded-xl border border-border/70 bg-card p-5">
            <label className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Popup newsletter activée</p>
                <p className="text-xs text-muted-foreground">Invite les visiteurs à s’inscrire.</p>
              </div>
              <Switch checked={popup.enabled} onCheckedChange={(v) => setPopup({ ...popup, enabled: v })} aria-label="Activer la popup" />
            </label>
            <Field label="Titre de la popup">
              <Input value={popup.title} onChange={(e) => setPopup({ ...popup, title: e.target.value })} placeholder="Ex : Restez à la pointe !" />
            </Field>
            <Field label="Texte d’introduction">
              <Textarea value={popup.text} onChange={(e) => setPopup({ ...popup, text: e.target.value })} placeholder="Recevez chaque semaine l’essentiel du business…" className="min-h-16 text-sm" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Déclencheur" hint="Quand la popup apparaît-elle ?">
                <Select value={popup.trigger} onValueChange={(v) => setPopup({ ...popup, trigger: v as NewsletterPopupConfig['trigger'] })}>
                  <SelectTrigger aria-label="Déclencheur"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIME">Après un délai</SelectItem>
                    <SelectItem value="SCROLL">Au défilement</SelectItem>
                    <SelectItem value="EXIT">À la sortie (intention)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fréquence d’affichage">
                <Select value={popup.frequency} onValueChange={(v) => setPopup({ ...popup, frequency: v as NewsletterPopupConfig['frequency'] })}>
                  <SelectTrigger aria-label="Fréquence"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SESSION">Une fois par session</SelectItem>
                    <SelectItem value="DAY">Une fois par jour</SelectItem>
                    <SelectItem value="WEEK">Une fois par semaine</SelectItem>
                    <SelectItem value="ALWAYS">Toujours</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Délai (secondes)" hint="Utilisé si le déclencheur est « Après un délai »">
                <Input type="number" min={0} max={300} value={popup.delaySeconds} onChange={(e) => setPopup({ ...popup, delaySeconds: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="Défilement (%)" hint="Utilisé si le déclencheur est « Au défilement »">
                <Input type="number" min={5} max={100} value={popup.scrollPercent} onChange={(e) => setPopup({ ...popup, scrollPercent: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <Button onClick={savePopup} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer la popup
            </Button>
          </div>
        )}
      </TabsContent>
      <TranslationsDialog
        open={flashTranslate !== null}
        onOpenChange={(o) => { if (!o) setFlashTranslate(null); }}
        entityType="flashInfo"
        entityId={flashTranslate?.id ?? null}
        entityLabel={flashTranslate?.text.slice(0, 40)}
        fields={[{ key: 'text', label: 'Message traduit', multiline: true }]}
      />
    </Tabs>
  );
}
