'use client';

// ═══════════════════════════════════════════════════════════════
// MEDIA PICKER — Dialog de sélection dans la bibliothèque médias
// (grille, recherche, ajout par URL) — réutilisé partout
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/api';
import type { MediaItem } from '@/lib/types';
import { useDebounced } from './helpers';
import { ImagePlus, Search, Link2, Loader2, ImageIcon } from 'lucide-react';

interface MediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaItem | { url: string; filename: string }) => void;
  title?: string;
}

function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    return last || 'image-importee';
  } catch {
    return 'image-importee';
  }
}

export function MediaPicker({ open, onOpenChange, onSelect, title = 'Choisir un média' }: MediaPickerProps) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<MediaItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounced(search, 350);
  const [urlValue, setUrlValue] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const res = await adminApi.media({ search: q || undefined, page: p });
      setItems(res.items);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Chargement impossible des médias.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (open) {
      load(1, debouncedSearch);
    }
     
  }, [open, debouncedSearch]);

  const handleAddByUrl = async () => {
    const url = urlValue.trim();
    if (!url) {
      toast({ variant: 'destructive', title: 'URL requise', description: 'Renseignez l’adresse de l’image à importer.' });
      return;
    }
    setAdding(true);
    try {
      const { media } = await adminApi.createMedia({
        url,
        filename: filenameFromUrl(url),
        type: 'image',
      });
      toast({ title: 'Média ajouté', description: 'L’image a été importée dans la bibliothèque.' });
      setUrlValue('');
      onSelect(media);
      onOpenChange(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Import impossible', description: e instanceof Error ? e.message : 'Vérifiez l’URL fournie.' });
    } finally {
      setAdding(false);
    }
  };

  const handleSelect = (media: MediaItem) => {
    onSelect(media);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-editorial">{title}</DialogTitle>
          <DialogDescription>
            Parcourez la bibliothèque ou importez une image par URL. {total > 0 ? `${total} média(s) au total.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un média (nom, alt, tags…)"
            className="pl-8"
            aria-label="Rechercher un média"
          />
        </div>

        <div className="max-h-72 min-h-40 overflow-y-auto custom-scrollbar rounded-lg border border-border/60 p-2">
          {loading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2 text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-40" />
              <p className="text-sm">Aucun média trouvé.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m)}
                  className="group relative overflow-hidden rounded-md border border-border/60 bg-muted/40 transition-all hover:ring-2 hover:ring-primary/60 focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={`Sélectionner ${m.filename}`}
                  title={m.filename}
                >
                  { }
                  <img
                    src={m.url}
                    alt={m.alt || m.filename}
                    className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {m.filename}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {page} / {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => load(page - 1, debouncedSearch)}>Précédent</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => load(page + 1, debouncedSearch)}>Suivant</Button>
            </div>
          </div>
        ) : null}

        <Separator />

        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ImagePlus className="h-3.5 w-3.5" /> Importer une nouvelle image par URL
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder="https://exemple.com/image.jpg"
                className="pl-8"
                aria-label="URL de l'image"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddByUrl(); }}
              />
            </div>
            <Button type="button" onClick={handleAddByUrl} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ajouter'}
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
