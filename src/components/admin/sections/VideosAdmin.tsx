'use client';

// ═══════════════════════════════════════════════════════════════
// VIDEOS ADMIN — Gestion des vidéos YouTube : import par lien
// (métadonnées auto), playlists, publication, suppression.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { VideoItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field } from '../ui/Field';
import { DataTable, type Column } from '../ui/DataTable';
import { extractYouTubeId, youtubeThumb, formatNumber, isAuthError } from '../ui/helpers';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MoreHorizontal, Pencil, Trash2, Plus, Loader2, Youtube, Eye, ExternalLink } from 'lucide-react';

const EMPTY_FORM = {
  title: '',
  description: '',
  link: '',
  youtubeId: '',
  thumbnailUrl: '',
  duration: '',
  playlist: '',
  newPlaylist: '',
  published: false,
};

export function VideosAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [rows, setRows] = React.useState<VideoItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<VideoItem | null>(null);
  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [saving, setSaving] = React.useState(false);
  const [metaLoading, setMetaLoading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<VideoItem | null>(null);

  const load = React.useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await adminApi.videos({ page: p });
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

  const playlists = React.useMemo(
    () => Array.from(new Set(rows.map((v) => v.playlist).filter(Boolean))),
    [rows],
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (v: VideoItem) => {
    setEditing(v);
    setForm({
      title: v.title, description: v.description, link: `https://youtu.be/${v.youtubeId}`,
      youtubeId: v.youtubeId, thumbnailUrl: v.thumbnailUrl, duration: v.duration,
      playlist: v.playlist, newPlaylist: '', published: v.published,
    });
    setDialogOpen(true);
  };

  // Récupération des métadonnées YouTube (titre + miniature)
  const fetchMeta = async () => {
    const raw = form.link.trim();
    const id = extractYouTubeId(raw);
    if (!id) {
      toast({ variant: 'destructive', title: 'Lien invalide', description: 'Collez un lien YouTube valide (watch?v=, youtu.be/…) ou un ID.' });
      return;
    }
    setMetaLoading(true);
    try {
      const meta = await adminApi.fetchYouTubeMeta(raw);
      setForm((f) => ({
        ...f,
        youtubeId: id,
        title: meta.title || f.title,
        thumbnailUrl: meta.thumbnailUrl || youtubeThumb(id),
      }));
      toast({ title: 'Métadonnées récupérées', description: 'Titre et miniature préremplis depuis YouTube.' });
    } catch {
      // Ne jamais bloquer : on préremplit au minimum
      setForm((f) => ({ ...f, youtubeId: id, thumbnailUrl: youtubeThumb(id) }));
      toast({ title: 'Aperçu généré', description: 'Les métadonnées YouTube sont indisponibles, complétez le titre manuellement.' });
    } finally {
      setMetaLoading(false);
    }
  };

  const submit = async () => {
    const id = form.youtubeId || extractYouTubeId(form.link);
    if (!form.title.trim() || !id) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Renseignez au minimum un lien YouTube et un titre.' });
      return;
    }
    if (form.playlist === '__new__' && !form.newPlaylist.trim()) {
      toast({ variant: 'destructive', title: 'Nom de playlist requis', description: 'Donnez un nom à la nouvelle playlist ou choisissez-en une existante.' });
      return;
    }
    setSaving(true);
    const playlist = form.playlist === '__new__' ? form.newPlaylist.trim() : (form.newPlaylist.trim() || form.playlist);
    try {
      if (editing) {
        await adminApi.updateVideo(editing.id, {
          title: form.title.trim(), description: form.description, youtubeId: id,
          thumbnailUrl: form.thumbnailUrl || youtubeThumb(id), duration: form.duration,
          playlist, published: form.published,
        });
        toast({ title: 'Vidéo modifiée', description: `« ${form.title} » a été mise à jour.` });
      } else {
        await adminApi.createVideo({
          title: form.title.trim(), description: form.description, youtubeId: id,
          thumbnailUrl: form.thumbnailUrl || youtubeThumb(id), duration: form.duration,
          playlist, published: form.published,
        });
        toast({ title: 'Vidéo ajoutée', description: `« ${form.title} » a été créée.` });
      }
      setDialogOpen(false);
      load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (v: VideoItem, published: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === v.id ? { ...r, published } : r)));
    try {
      await adminApi.updateVideo(v.id, { published });
      toast({ title: published ? 'Vidéo publiée' : 'Vidéo dépubliée', description: v.title });
    } catch (e) {
      setRows((prev) => prev.map((r) => (r.id === v.id ? { ...r, published: !published } : r)));
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour impossible.' });
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deleteVideo(deleteTarget.id);
      toast({ title: 'Vidéo supprimée', description: `« ${deleteTarget.title} » a été retirée.` });
      setDeleteTarget(null);
      load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Suppression impossible.' });
      setDeleteTarget(null);
    }
  };

  const columns: Column<VideoItem>[] = [
    {
      key: 'thumb',
      header: <span className="sr-only">Miniature</span>,
      render: (v) => (
        <div className="h-12 w-20 overflow-hidden rounded bg-muted/50">
          { }
          <img
            src={v.thumbnailUrl || youtubeThumb(v.youtubeId)}
            alt="" loading="lazy" className="h-full w-full object-cover"
          />
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Titre',
      render: (v) => (
        <div className="max-w-72">
          <p className="truncate text-sm font-medium" title={v.title}>{v.title}</p>
          {v.description ? <p className="truncate text-xs text-muted-foreground">{v.description}</p> : null}
        </div>
      ),
    },
    {
      key: 'playlist',
      header: 'Playlist',
      render: (v) => v.playlist
        ? <Badge variant="secondary" className="font-normal">{v.playlist}</Badge>
        : <span className="text-xs text-muted-foreground">—</span>,
    },
    { key: 'duration', header: 'Durée', className: 'hidden sm:table-cell whitespace-nowrap', render: (v) => <span className="text-sm tabular-nums">{v.duration || '—'}</span> },
    { key: 'views', header: 'Vues', className: 'hidden md:table-cell text-right tabular-nums', render: (v) => <span className="text-sm tabular-nums">{formatNumber(v.views)}</span> },
    {
      key: 'published',
      header: 'Publiée',
      render: (v) => (
        <Switch checked={v.published} onCheckedChange={(c) => togglePublished(v, c)} aria-label={`Publier ${v.title}`} />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12',
      render: (v) => (
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)} aria-label={`Modifier ${v.title}`}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(v)} aria-label={`Supprimer ${v.title}`}>
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
          <Youtube className="h-4 w-4 text-red-500" />
          {formatNumber(total)} vidéo(s) — collez un lien YouTube, les métadonnées se remplissent automatiquement.
        </p>
        <Button size="sm" className="ml-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nouvelle vidéo
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        getRowId={(v) => v.id}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => load(p)}
        emptyLabel="Aucune vidéo pour le moment."
      />

      {/* ─── Dialog création / édition ─── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-editorial">{editing ? 'Modifier la vidéo' : 'Nouvelle vidéo'}</DialogTitle>
            <DialogDescription>
              Collez un lien YouTube pour récupérer automatiquement le titre et la miniature.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Lien YouTube" required hint="Formats acceptés : watch?v=, youtu.be/, embed/, shorts/ ou ID brut.">
              <div className="flex gap-2">
                <Input
                  value={form.link}
                  onChange={(e) => setForm({ ...form, link: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
                <Button type="button" variant="outline" onClick={fetchMeta} disabled={metaLoading} className="shrink-0">
                  {metaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Analyser
                </Button>
              </div>
            </Field>

            {form.youtubeId ? (
              <div className="overflow-hidden rounded-lg border border-border/60">
                <div className="aspect-video w-full bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${form.youtubeId}`}
                    title="Aperçu de la vidéo"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              </div>
            ) : metaLoading ? (
              <Skeleton className="aspect-video w-full" />
            ) : null}

            <Field label="Titre" required counter={<span>{form.title.length}</span>}>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titre de la vidéo" />
            </Field>
            <Field label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Résumé de la vidéo…" className="min-h-20 text-sm" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Playlist">
                <Select
                  value={form.playlist || 'none'}
                  onValueChange={(v) => setForm({ ...form, playlist: v === 'none' ? '' : v, newPlaylist: '' })}
                >
                  <SelectTrigger aria-label="Playlist"><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune playlist</SelectItem>
                    {playlists.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    <SelectItem value="__new__">➕ Nouvelle playlist…</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Durée" hint="Ex : 12:34">
                <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="12:34" />
              </Field>
            </div>
            {form.playlist === '__new__' ? (
              <Field label="Nom de la nouvelle playlist" required>
                <Input
                  value={form.newPlaylist}
                  onChange={(e) => setForm({ ...form, newPlaylist: e.target.value })}
                  placeholder="Ex : Interviews 2025"
                  autoFocus
                />
              </Field>
            ) : null}
            <label className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <span className="text-sm font-medium">Vidéo publiée</span>
              <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} aria-label="Publier la vidéo" />
            </label>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Eye className="h-3 w-3" /> Les vidéos dépubliées restent invisibles sur le site.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={submit} disabled={saving || metaLoading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Enregistrer' : 'Ajouter la vidéo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer cette vidéo ?"
        description={deleteTarget ? `« ${deleteTarget.title} » sera définitivement supprimée de la vidéothèque.` : ''}
        confirmLabel="Supprimer"
        onConfirm={doDelete}
      />
    </div>
  );
}
