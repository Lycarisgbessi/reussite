'use client';

// ═══════════════════════════════════════════════════════════════
// PODCASTS ADMIN — Gestion des épisodes : saison/épisode, invités,
// audio (Google Drive converti en lien direct), couverture, flux RSS.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { PodcastItem } from '@/lib/types';
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Pencil, Trash2, Plus, Loader2, Mic, Rss, Play, Info } from 'lucide-react';

const EMPTY_FORM = {
  title: '',
  description: '',
  season: 1,
  episode: 1,
  guests: '',
  audioUrl: '',
  duration: '',
  coverImage: '',
  published: false,
};

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
  const [deleteTarget, setDeleteTarget] = React.useState<PodcastItem | null>(null);

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

  React.useEffect(() => { load(1); }, [load]);

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
      coverImage: p.coverImage, published: p.published,
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
      const payload = { ...form, title: form.title.trim(), audioUrl: parseDriveAudioLink(form.audioUrl.trim()) };
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
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(p)} aria-label={`Supprimer ${p.title}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mic className="h-4 w-4 text-primary" />
          {formatNumber(total)} épisode(s)
        </p>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={copyRss}>
            <Rss className="h-4 w-4" /> Copier le flux RSS
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nouvel épisode
          </Button>
        </div>
      </div>

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
    </div>
  );
}
