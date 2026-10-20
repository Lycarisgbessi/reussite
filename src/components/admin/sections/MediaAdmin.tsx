'use client';

// ═══════════════════════════════════════════════════════════════
// MEDIA ADMIN — Médiathèque : grille de vignettes, recherche,
// ajout par URL, détail (alt, légende, crédit, tags), suppression.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { MediaItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field } from '../ui/Field';
import { useDebounced, isAuthError, copyToClipboard, formatDate } from '../ui/helpers';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Pager } from '../ui/DataTable';
import {
  Search, Plus, Loader2, Trash2, Copy, Link2, ImageOff, Check, CalendarDays, UploadCloud, FileImage,
} from 'lucide-react';

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    return last || 'image-importee';
  } catch {
    return 'image-importee';
  }
}

export function MediaAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [items, setItems] = React.useState<MediaItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const debounced = useDebounced(search, 350);

  // Ajout par URL
  const [addOpen, setAddOpen] = React.useState(false);
  const [addUrl, setAddUrl] = React.useState('');
  const [addFilename, setAddFilename] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  // Import de fichier (Cloudinary)
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadMeta, setUploadMeta] = React.useState({ alt: '', caption: '', credit: '', tags: '' });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resetUpload = () => {
    setUploadFile(null);
    setUploadMeta({ alt: '', caption: '', credit: '', tags: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast({ variant: 'destructive', title: 'Fichier requis', description: 'Sélectionnez ou déposez une image à importer.' });
      return;
    }
    setUploading(true);
    try {
      const { media } = await adminApi.uploadMedia(uploadFile, {
        alt: uploadMeta.alt.trim() || undefined,
        caption: uploadMeta.caption.trim() || undefined,
        credit: uploadMeta.credit.trim() || undefined,
        tags: uploadMeta.tags.trim() || undefined,
      });
      toast({ title: 'Image importée', description: `« ${media.filename} » a été ajoutée à la bibliothèque.` });
      setUploadOpen(false);
      resetUpload();
      load(1, debounced);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Import impossible', description: e instanceof Error ? e.message : 'Vérifiez le fichier (type autorisé, 15 Mo max).' });
    } finally {
      setUploading(false);
    }
  };

  // Détail / édition
  const [detail, setDetail] = React.useState<MediaItem | null>(null);
  const [form, setForm] = React.useState({ alt: '', caption: '', credit: '', tags: '' });
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<MediaItem | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const res = await adminApi.media({ search: q || undefined, page: p });
      setItems(res.items);
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

  React.useEffect(() => { load(1, debounced); }, [load, debounced]);

  const openDetail = (m: MediaItem) => {
    setDetail(m);
    setForm({ alt: m.alt, caption: m.caption, credit: m.credit, tags: m.tags });
    setCopied(false);
  };

  const handleAddUrl = async () => {
    const url = addUrl.trim();
    if (!url) {
      toast({ variant: 'destructive', title: 'URL requise', description: 'Renseignez l’adresse de l’image.' });
      return;
    }
    setAdding(true);
    try {
      const { media } = await adminApi.createMedia({ url, filename: addFilename.trim() || filenameFromUrl(url), type: 'image' });
      toast({ title: 'Média ajouté', description: 'L’image est disponible dans la bibliothèque.' });
      setAddOpen(false);
      setAddUrl('');
      setAddFilename('');
      openDetail(media);
      load(1, debounced);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Import impossible', description: e instanceof Error ? e.message : 'Vérifiez l’URL.' });
    } finally {
      setAdding(false);
    }
  };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const { media } = await adminApi.updateMedia(detail.id, form);
      toast({ title: 'Média mis à jour', description: 'Les informations ont été enregistrées.' });
      setDetail(null);
      setItems((prev) => prev.map((m) => (m.id === media.id ? media : m)));
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour impossible.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deleteMedia(deleteTarget.id);
      toast({ title: 'Média supprimé', description: `« ${deleteTarget.filename} » a été retiré de la bibliothèque.` });
      setDeleteTarget(null);
      setDetail(null);
      load(page, debounced);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: e instanceof Error ? e.message : 'Erreur inconnue.' });
      setDeleteTarget(null);
    }
  };

  const handleCopyUrl = async (url: string) => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'URL copiée', description: 'Le lien du média est dans le presse-papiers.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher dans la médiathèque (nom, alt, tags…)"
            className="pl-8"
            aria-label="Rechercher un média"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
            <UploadCloud className="h-4 w-4" /> Importer une image
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Ajouter par URL
          </Button>
        </div>
      </div>

      {/* ─── Grille ─── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-muted-foreground">
          <ImageOff className="h-10 w-10 opacity-40" />
          <p className="text-sm">Aucun média.{search ? ' Essayez une autre recherche.' : ' Ajoutez votre première image.'}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => openDetail(m)}
                className="group overflow-hidden rounded-lg border border-border/70 bg-card text-left transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label={`Ouvrir les détails de ${m.filename}`}
              >
                <div className="aspect-square overflow-hidden bg-muted/40">
                  { }
                  <img
                    src={m.url}
                    alt={m.alt || m.filename}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium" title={m.filename}>{m.filename}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{formatDate(m.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
          <Pager page={page} totalPages={totalPages} total={total} onPageChange={(p) => load(p, debounced)} />
        </>
      )}

      {/* ─── Dialog import de fichier ─── */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { if (o) setUploadOpen(true); else { setUploadOpen(false); resetUpload(); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-editorial">Importer une image</DialogTitle>
            <DialogDescription>Déposez un fichier (PNG, JPEG, WebP, GIF, AVIF, SVG — 15 Mo max).</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => !uploading && fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f && f.type.startsWith('image/')) setUploadFile(f);
                else if (f) toast({ variant: 'destructive', title: 'Fichier non pris en charge', description: 'Seules les images peuvent être importées.' });
              }}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/40',
              )}
              aria-label="Zone de dépôt d'image"
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <FileImage className="h-8 w-8 text-muted-foreground" />
              )}
              {uploadFile ? (
                <p className="text-sm font-medium">{uploadFile.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Glissez-déposez une image ici<br />ou cliquez pour parcourir vos fichiers</p>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-hidden="true"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadFile(f); }}
            />
            <Field label="Texte alternatif (alt)" hint="Optionnel — décrit l'image pour l'accessibilité et le SEO.">
              <Input value={uploadMeta.alt} onChange={(e) => setUploadMeta({ ...uploadMeta, alt: e.target.value })} placeholder="Description de l'image" />
            </Field>
            <Field label="Légende (optionnelle)">
              <Input value={uploadMeta.caption} onChange={(e) => setUploadMeta({ ...uploadMeta, caption: e.target.value })} placeholder="Légende affichée sous l'image" />
            </Field>
            <Field label="Crédit (optionnel)">
              <Input value={uploadMeta.credit} onChange={(e) => setUploadMeta({ ...uploadMeta, credit: e.target.value })} placeholder="Photo : auteur / source" />
            </Field>
            <Field label="Tags (optionnels)" hint="Séparez les tags par des virgules.">
              <Input value={uploadMeta.tags} onChange={(e) => setUploadMeta({ ...uploadMeta, tags: e.target.value })} placeholder="entreprise, portrait" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); resetUpload(); }} disabled={uploading}>Annuler</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadFile}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog ajout par URL ─── */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) setAddOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-editorial">Ajouter un média</DialogTitle>
            <DialogDescription>Importez une image via son URL publique.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="URL de l'image" required>
              <div className="relative">
                <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={addUrl}
                  onChange={(e) => {
                    setAddUrl(e.target.value);
                    if (!addFilename) setAddFilename(filenameFromUrl(e.target.value));
                  }}
                  placeholder="https://exemple.com/photo.jpg"
                  className="pl-8"
                />
              </div>
            </Field>
            <Field label="Nom du fichier" hint="Nom interne du média dans la bibliothèque.">
              <Input value={addFilename} onChange={(e) => setAddFilename(e.target.value)} placeholder="photo.jpg" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={adding}>Annuler</Button>
            <Button onClick={handleAddUrl} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog détail / édition ─── */}
      <Dialog open={detail !== null} onOpenChange={(o) => { if (!o) setDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-editorial">{detail.filename}</DialogTitle>
                <DialogDescription>Ajouté le {formatDate(detail.createdAt, true)}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/40">
                  { }
                  <img src={detail.url} alt={detail.alt || detail.filename} className="h-full max-h-56 w-full object-cover" />
                </div>
                <div className="space-y-3">
                  <Field label="URL du média">
                    <div className="flex gap-2">
                      <Input readOnly value={detail.url} className="h-8 font-mono text-[11px]" aria-label="URL du média" />
                      <Button variant="outline" size="sm" className="h-8 shrink-0 px-2.5" onClick={() => handleCopyUrl(detail.url)} aria-label="Copier l'URL">
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </Field>
                  <Field label="Texte alternatif (alt)" hint="Décrit l'image pour l'accessibilité et le SEO.">
                    <Input value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} placeholder="Description de l'image" />
                  </Field>
                  <Field label="Légende">
                    <Input value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} placeholder="Légende affichée sous l'image" />
                  </Field>
                  <Field label="Crédit">
                    <Input value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} placeholder="Photo : auteur / source" />
                  </Field>
                  <Field label="Tags" hint="Séparez les tags par des virgules.">
                    <Textarea value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="entreprise, portrait" className="min-h-14 text-sm" />
                  </Field>
                  {form.tags ? (
                    <div className="flex flex-wrap gap-1.5">
                      {form.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  ) : null}
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CalendarDays className="h-3 w-3" /> Type : {detail.type || 'image'}
                  </p>
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(detail)}>
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Enregistrer
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer ce média ?"
        description={deleteTarget ? `« ${deleteTarget.filename} » sera définitivement retiré de la bibliothèque. Les articles qui l'utilisent devront être mis à jour.` : ''}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />
    </div>
  );
}
