'use client';

// ═══════════════════════════════════════════════════════════════
// PODCASTS ADMIN — Gestion des épisodes : saison/épisode, invités,
// audio (Google Drive converti en lien direct), couverture, flux RSS.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { PodcastCollection, PodcastItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MediaPicker } from '../ui/MediaPicker';
import { Field } from '../ui/Field';
import { DataTable, type Column } from '../ui/DataTable';
import { parseDriveAudioLink, formatNumber, isAuthError, copyToClipboard } from '../ui/helpers';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Pencil, Trash2, Plus, Loader2, Mic, Rss, Play, Info, Folder, FolderOpen, ArrowUp, ArrowDown, Languages } from 'lucide-react';
import { TranslationsDialog } from '../ui/TranslationsDialog';

const EMPTY_FORM = {
  title: '',
  description: '',
  season: 1,
  episode: 1,
  guests: '',
  audioUrl: '',
  duration: '',
  coverImage: '',
  collectionId: '',
  published: false,
};

const EMPTY_COLL_FORM = { title: '', description: '', parentId: 'none' };

/** Aplatit l'arbre des collections avec niveau d'indentation. */
function flattenCollections(list: PodcastCollection[], depth = 0): Array<PodcastCollection & { depth: number }> {
  return list.flatMap((c) => [
    { ...c, depth },
    ...(c.children?.length ? flattenCollections(c.children, depth + 1) : []),
  ]);
}

export function PodcastsAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [rows, setRows] = React.useState<PodcastItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PodcastItem | null>(null);
  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [saving, setSaving] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [translateTarget, setTranslateTarget] = React.useState<PodcastItem | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<PodcastItem | null>(null);

  // Collections
  const [collections, setCollections] = React.useState<PodcastCollection[]>([]);
  const [collDialog, setCollDialog] = React.useState(false);
  const [collEditing, setCollEditing] = React.useState<PodcastCollection | null>(null);
  const [collForm, setCollForm] = React.useState({ ...EMPTY_COLL_FORM });
  const [collSaving, setCollSaving] = React.useState(false);
  const [collDelete, setCollDelete] = React.useState<PodcastCollection | null>(null);

  const rssUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/rss` : '/api/rss';

  const load = React.useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await adminApi.podcasts({ page: p });
      setRows(res.items);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Chargement impossible.' });
    } finally {
      setLoading(false);
    }
  }, [toast, clearAdminSession]);

  const loadCollections = React.useCallback(async () => {
    try {
      const r = await adminApi.podcastCollections();
      setCollections(r.collections);
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Collections indisponibles.' });
    }
  }, [toast, clearAdminSession]);

  React.useEffect(() => { load(1); loadCollections(); }, [load, loadCollections]);

  const openCreate = () => {
    setEditing(null);
    const maxSeason = rows.reduce((m, r) => Math.max(m, r.season), 0);
    setForm({ ...EMPTY_FORM, season: maxSeason || 1, episode: rows.filter((r) => r.season === (maxSeason || 1)).length + 1 });
    setDialogOpen(true);
  };

  const openEdit = (p: PodcastItem) => {
    setEditing(p);
    setForm({
      title: p.title, description: p.description, season: p.season, episode: p.episode,
      guests: p.guests, audioUrl: p.audioUrl, duration: p.duration,
      coverImage: p.coverImage, collectionId: p.collectionId || '', published: p.published,
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim() || !form.audioUrl.trim()) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Renseignez au minimum le titre et le lien audio.' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim(), audioUrl: parseDriveAudioLink(form.audioUrl.trim()), collectionId: form.collectionId || null };
      if (editing) {
        await adminApi.updatePodcast(editing.id, payload);
        toast({ title: 'Épisode modifié', description: `« ${form.title} » a été mis à jour.` });
      } else {
        await adminApi.createPodcast(payload);
        toast({ title: 'Épisode ajouté', description: `« ${form.title} » a été créé.` });
      }
      setDialogOpen(false);
      load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (p: PodcastItem, published: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === p.id ? { ...r, published } : r)));
    try {
      await adminApi.updatePodcast(p.id, { published });
      toast({ title: published ? 'Épisode publié' : 'Épisode dépublié', description: p.title });
    } catch (e) {
      setRows((prev) => prev.map((r) => (r.id === p.id ? { ...r, published: !published } : r)));
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour impossible.' });
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deletePodcast(deleteTarget.id);
      toast({ title: 'Épisode supprimé', description: `« ${deleteTarget.title} » a été retiré.` });
      setDeleteTarget(null);
      load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Suppression impossible.' });
      setDeleteTarget(null);
    }
  };

  // ─── Collections ─────────────────────────────────────────────
  const openCollCreate = () => {
    setCollEditing(null);
    setCollForm({ ...EMPTY_COLL_FORM });
    setCollDialog(true);
  };

  const openCollEdit = (c: PodcastCollection) => {
    setCollEditing(c);
    setCollForm({ title: c.title, description: c.description, parentId: c.parentId || 'none' });
    setCollDialog(true);
  };

  const submitColl = async () => {
    if (!collForm.title.trim()) {
      toast({ variant: 'destructive', title: 'Titre requis', description: 'Donnez un titre à la collection.' });
      return;
    }
    setCollSaving(true);
    try {
      const payload = { title: collForm.title.trim(), description: collForm.description, parentId: collForm.parentId === 'none' ? null : collForm.parentId };
      if (collEditing) {
        await adminApi.updatePodcastCollection(collEditing.id, payload);
        toast({ title: 'Collection modifiée', description: `« ${payload.title} » a été mise à jour.` });
      } else {
        await adminApi.createPodcastCollection(payload);
        toast({ title: 'Collection créée', description: `« ${payload.title} » est prête à recevoir des épisodes.` });
      }
      setCollDialog(false);
      loadCollections();
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    } finally {
      setCollSaving(false);
    }
  };

  const doDeleteColl = async () => {
    if (!collDelete) return;
    try {
      await adminApi.deletePodcastCollection(collDelete.id);
      toast({ title: 'Collection supprimée', description: `« ${collDelete.title} » a été retirée.` });
      setCollDelete(null);
      loadCollections();
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Suppression impossible', description: e instanceof Error ? e.message : 'Erreur inconnue.' });
      setCollDelete(null);
    }
  };

  const moveColl = async (id: string, dir: -1 | 1) => {
    const ids = collections.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setCollections((prev) => ids.map((id2) => prev.find((c) => c.id === id2)!));
    try {
      await adminApi.reorderPodcastCollections(ids);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Réordonnancement impossible.' });
      loadCollections();
    }
  };

  const copyRss = async () => {
    const ok = await copyToClipboard(rssUrl);
    toast(
      ok
        ? { title: 'Flux RSS copié', description: rssUrl }
        : { variant: 'destructive', title: 'Copie impossible', description: 'Copiez manuellement : ' + rssUrl },
    );
  };

  const columns: Column<PodcastItem>[] = [
    {
      key: 'cover',
      header: <span className="sr-only">Couverture</span>,
      render: (p) => (
        <div className="h-12 w-12 overflow-hidden rounded bg-muted/50">
          {p.coverImage ? (
             
            <img src={p.coverImage} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Mic className="h-5 w-5" /></div>
          )}
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Épisode',
      render: (p) => (
        <div className="max-w-72">
          <p className="truncate text-sm font-medium" title={p.title}>{p.title}</p>
          {p.guests ? <p className="truncate text-xs text-muted-foreground">Invité(s) : {p.guests}</p> : null}
        </div>
      ),
    },
    {
      key: 'se',
      header: 'S/E',
      className: 'whitespace-nowrap',
      render: (p) => (
        <Badge variant="secondary" className="font-mono text-[11px] font-normal">
          S{String(p.season).padStart(2, '0')}·E{String(p.episode).padStart(2, '0')}
        </Badge>
      ),
    },
    { key: 'duration', header: 'Durée', className: 'hidden sm:table-cell whitespace-nowrap', render: (p) => <span className="text-sm tabular-nums">{p.duration || '—'}</span> },
    { key: 'plays', header: 'Écoutes', className: 'hidden md:table-cell text-right tabular-nums', render: (p) => <span className="inline-flex items-center gap-1 text-sm tabular-nums"><Play className="h-3.5 w-3.5 text-primary" /> {formatNumber(p.plays)}</span> },
    {
      key: 'published',
      header: 'Publié',
      render: (p) => <Switch checked={p.published} onCheckedChange={(c) => togglePublished(p, c)} aria-label={`Publier ${p.title}`} />,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12',
      render: (p) => (
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} aria-label={`Modifier ${p.title}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTranslateTarget(p)} aria-label={`Traductions ${p.title}`} title="Traductions">
            <Languages className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)} aria-label={`Supprimer ${p.title}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const flatCollections = flattenCollections(collections);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="episodes" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="episodes" className="gap-1.5"><Mic className="h-3.5 w-3.5" /> Épisodes</TabsTrigger>
            <TabsTrigger value="collections" className="gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> Collections</TabsTrigger>
          </TabsList>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={copyRss}>
              <Rss className="h-4 w-4" /> Copier le flux RSS
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nouvel épisode
            </Button>
          </div>
        </div>

        {/* ═════════ ÉPISODES ═════════ */}
        <TabsContent value="episodes" className="mt-0 space-y-4">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mic className="h-4 w-4 text-primary" />
            {formatNumber(total)} épisode(s)
          </p>

          <DataTable
            columns={columns}
            rows={rows}
            loading={loading}
            getRowId={(p) => p.id}
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={(p) => load(p)}
            emptyLabel="Aucun épisode de podcast pour le moment."
          />
        </TabsContent>

        {/* ═════════ COLLECTIONS ═════════ */}
        <TabsContent value="collections" className="mt-0 space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Regroupez vos épisodes en collections (séries thématiques, sous-collections…).</p>
            <Button size="sm" className="ml-auto shrink-0" onClick={openCollCreate}>
              <Plus className="h-4 w-4" /> Nouvelle collection
            </Button>
          </div>
          <div className="rounded-xl border border-border/70 bg-card">
            {flatCollections.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Aucune collection. Créez votre première série d’épisodes.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {flatCollections.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2.5" style={{ paddingLeft: `${12 + c.depth * 24}px` }}>
                    {c.depth > 0 ? <span className="text-muted-foreground/50">└</span> : null}
                    <Folder className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" title={c.title}>{c.title}</p>
                      {c.description ? <p className="truncate text-xs text-muted-foreground">{c.description}</p> : null}
                    </div>
                    <Badge variant="secondary" className="shrink-0 font-normal">{c.podcastCount ?? 0} épisode(s)</Badge>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={c.depth > 0} onClick={() => moveColl(c.id, -1)} aria-label={`Monter ${c.title}`}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={c.depth > 0} onClick={() => moveColl(c.id, 1)} aria-label={`Descendre ${c.title}`}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCollEdit(c)} aria-label={`Modifier ${c.title}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setCollDelete(c)} aria-label={`Supprimer ${c.title}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Dialog création / édition ─── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-editorial">{editing ? 'Modifier l’épisode' : 'Nouvel épisode'}</DialogTitle>
            <DialogDescription>Renseignez les métadonnées de l’épisode et le lien audio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Titre" required>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex : Croissance rentable, mode d’emploi" />
            </Field>
            <Field label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Résumé de l’épisode…" className="min-h-20 text-sm" />
            </Field>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
              <Field label="Saison">
                <Input type="number" min={1} value={form.season} onChange={(e) => setForm({ ...form, season: Number(e.target.value) || 1 })} />
              </Field>
              <Field label="Épisode">
                <Input type="number" min={1} value={form.episode} onChange={(e) => setForm({ ...form, episode: Number(e.target.value) || 1 })} />
              </Field>
              <Field label="Durée" hint="Ex : 42:10" className="col-span-2 sm:col-span-1">
                <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="42:10" />
              </Field>
            </div>
            <Field label="Collection" hint="Les collections regroupent les épisodes en séries thématiques.">
              <Select
                value={form.collectionId || 'none'}
                onValueChange={(v) => setForm({ ...form, collectionId: v === 'none' ? '' : v })}
              >
                <SelectTrigger aria-label="Collection de l'épisode">
                  <SelectValue placeholder="— Aucune (Saison N°)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucune (Saison N°)</SelectItem>
                  {flatCollections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {'\u00A0\u00A0'.repeat(c.depth)}{c.depth > 0 ? '└ ' : ''}{c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Invités" hint="Séparez les invités par des virgules.">
              <Input value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} placeholder="Marie Martin, Pierre Durand" />
            </Field>
            <Field label="Lien audio (MP3)" required>
              <Input
                value={form.audioUrl}
                onChange={(e) => setForm({ ...form, audioUrl: e.target.value })}
                placeholder="https://…/episode.mp3 ou lien Google Drive"
                className="font-mono text-xs"
              />
              <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Astuce Google Drive : collez le lien de partage du fichier (format
                <code className="mx-1 rounded bg-muted px-1 font-mono text-[10px]">drive.google.com/file/d/ID/view</code>),
                il sera converti automatiquement en lien de téléchargement direct.
              </p>
            </Field>
            <Field label="Couverture de l’épisode">
              <div className="flex items-center gap-3">
                {form.coverImage ? (
                   
                  <img src={form.coverImage} alt="Couverture" className="h-14 w-14 rounded-md object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                    <Mic className="h-5 w-5" />
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  {form.coverImage ? 'Changer' : 'Choisir une image'}
                </Button>
                {form.coverImage ? (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setForm({ ...form, coverImage: '' })}>
                    Retirer
                  </Button>
                ) : null}
              </div>
            </Field>
            <label className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <span className="text-sm font-medium">Épisode publié</span>
              <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} aria-label="Publier l'épisode" />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Enregistrer' : 'Ajouter l’épisode'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(m) => { setForm((f) => ({ ...f, coverImage: m.url })); setPickerOpen(false); }} title="Couverture de l’épisode" />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer cet épisode ?"
        description={deleteTarget ? `« ${deleteTarget.title} » sera définitivement supprimé du podcast.` : ''}
        confirmLabel="Supprimer"
        onConfirm={doDelete}
      />

      {/* ─── Dialog création / édition collection ─── */}
      <Dialog open={collDialog} onOpenChange={(o) => { if (!o) setCollDialog(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-editorial">{collEditing ? 'Modifier la collection' : 'Nouvelle collection'}</DialogTitle>
            <DialogDescription>Une collection regroupe des épisodes en série (ex : « Mentorat », « Finance »).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Titre" required>
              <Input value={collForm.title} onChange={(e) => setCollForm({ ...collForm, title: e.target.value })} placeholder="Ex : Croissance" />
            </Field>
            <Field label="Description">
              <Textarea value={collForm.description} onChange={(e) => setCollForm({ ...collForm, description: e.target.value })} placeholder="Description courte de la collection…" className="min-h-16 text-sm" />
            </Field>
            <Field label="Collection parente" hint="Pour créer une sous-collection.">
              <Select
                value={collForm.parentId}
                onValueChange={(v) => setCollForm({ ...collForm, parentId: v })}
              >
                <SelectTrigger aria-label="Collection parente"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune (collection racine)</SelectItem>
                  {flatCollections
                    .filter((c) => !collEditing || c.id !== collEditing.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {'\u00A0\u00A0'.repeat(c.depth)}{c.depth > 0 ? '└ ' : ''}{c.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollDialog(false)} disabled={collSaving}>Annuler</Button>
            <Button onClick={submitColl} disabled={collSaving}>
              {collSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {collEditing ? 'Enregistrer' : 'Créer la collection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={collDelete !== null}
        onOpenChange={(o) => { if (!o) setCollDelete(null); }}
        title="Supprimer cette collection ?"
        description={collDelete ? `« ${collDelete.title} » sera supprimée. Les épisodes associés ne seront pas supprimés : ils redeviendront simplement classés par saison/numéro.${collDelete.children?.length ? ' ATTENTION : cette collection contient des sous-collections — supprimez-les d’abord.' : ''}` : ''}
        confirmLabel="Supprimer"
        onConfirm={doDeleteColl}
      />
      <TranslationsDialog
        open={translateTarget !== null}
        onOpenChange={(o) => { if (!o) setTranslateTarget(null); }}
        entityType="podcast"
        entityId={translateTarget?.id ?? null}
        entityLabel={translateTarget?.title}
        fields={[
          { key: 'title', label: 'Titre traduit' },
          { key: 'description', label: 'Description traduite', multiline: true },
        ]}
      />
    </div>
  );
}
