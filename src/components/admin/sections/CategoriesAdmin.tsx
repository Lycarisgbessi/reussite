'use client';

// ═══════════════════════════════════════════════════════════════
// CATEGORIES ADMIN — Arborescence parent/enfant, drag & drop pour
// réordonner (@dnd-kit), création/édition (couleur, bannière,
// parent, visibilité), suppression protégée.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { Category } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MediaPicker } from '../ui/MediaPicker';
import { Field } from '../ui/Field';
import { TranslationsDialog } from '../ui/TranslationsDialog';
import { SortableItem } from '../ui/SortableItem';
import { slugify, isAuthError } from '../ui/helpers';
import { cn } from '@/lib/utils';

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
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  Plus, Pencil, Trash2, FolderTree, Loader2, Eye, Home as HomeIcon, FolderOpen, Languages,
} from 'lucide-react';

// Palette de couleurs presets (ambre/vert/rouge/orange/violet/teal/zinc)
const COLOR_PRESETS = [
  { name: 'Ambre', value: '#d97706' },
  { name: 'Vert', value: '#16a34a' },
  { name: 'Rouge', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Sarcelle', value: '#0d9488' },
  { name: 'Zinc', value: '#52525b' },
  { name: 'Rose', value: '#db2777' },
];

interface FlatRow {
  category: Category;
  depth: number;
}

/** Aplatit l'arborescence en lignes indentées (ordre : parents puis enfants). */
function flattenCategories(cats: Category[], depth = 0, out: FlatRow[] = []): FlatRow[] {
  for (const c of cats) {
    out.push({ category: c, depth });
    if (c.children?.length) flattenCategories(c.children, depth + 1, out);
  }
  return out;
}

export function CategoriesAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [translateTarget, setTranslateTarget] = React.useState<Category | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Dialog édition
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [color, setColor] = React.useState('#d97706');
  const [imageUrl, setImageUrl] = React.useState('');
  const [parentId, setParentId] = React.useState('none');
  const [showInMenu, setShowInMenu] = React.useState(true);
  const [showInHome, setShowInHome] = React.useState(true);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);
  const [order, setOrder] = React.useState<string[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.categories();
      setCategories(r.categories);
      setOrder(null);
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Chargement impossible.' });
    } finally {
      setLoading(false);
    }
  }, [toast, clearAdminSession]);

  React.useEffect(() => { load(); }, [load]);

  // Lignes affichées : soit l'ordre d'origine, soit l'ordre issu du drag
  const flatRows = React.useMemo(() => {
    const base = flattenCategories(categories);
    if (!order) return base;
    const map = new Map(base.map((r) => [r.category.id, r]));
    return order.map((id) => map.get(id)).filter((r): r is FlatRow => Boolean(r));
  }, [categories, order]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = flatRows.map((r) => r.category.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    const next = arrayMove(ids, from, to);
    setOrder(next);
  };

  const persistOrder = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await adminApi.reorderCategories(order);
      toast({ title: 'Ordre enregistré', description: 'L’arborescence des catégories a été mise à jour.' });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Réordonnancement impossible.' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Formulaire édition / création ────────────────────────────
  const openCreate = () => {
    setEditing(null); setCreating(true);
    setName(''); setSlug(''); setSlugTouched(false); setDescription('');
    setColor('#d97706'); setImageUrl(''); setParentId('none');
    setShowInMenu(true); setShowInHome(true);
  };

  const openEdit = (c: Category) => {
    setCreating(false); setEditing(c);
    setName(c.name); setSlug(c.slug); setSlugTouched(true); setDescription(c.description);
    setColor(c.color || '#d97706'); setImageUrl(c.imageUrl); setParentId(c.parentId ?? 'none');
    setShowInMenu(c.showInMenu); setShowInHome(c.showInHome);
  };

  const closeDialog = () => { setEditing(null); setCreating(false); };

  const submitForm = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Nom requis', description: 'Renseignez le nom de la catégorie.' });
      return;
    }
    setBusy(true);
    const payload: Partial<Category> = {
      name: name.trim(),
      slug: slug || slugify(name),
      description,
      color,
      imageUrl,
      parentId: parentId === 'none' ? null : parentId,
      showInMenu,
      showInHome,
    };
    try {
      if (editing) {
        await adminApi.updateCategory(editing.id, payload);
        toast({ title: 'Catégorie modifiée', description: `« ${payload.name} » a été mise à jour.` });
      } else {
        await adminApi.createCategory(payload);
        toast({ title: 'Catégorie créée', description: `« ${payload.name} » a été ajoutée.` });
      }
      closeDialog();
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteCategory(deleteTarget.id);
      toast({ title: 'Catégorie supprimée', description: `« ${deleteTarget.name} » a été supprimée.` });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: e instanceof Error ? e.message : 'Erreur inconnue.' });
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  // Options parent : toutes les catégories racines sauf soi-même
  const parentOptions = categories.filter((c) => c.id !== editing?.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Organisez vos rubriques : glissez-déposez pour réordonner, puis enregistrez l’ordre.
        </p>
        <div className="ml-auto flex gap-2">
          {order ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setOrder(null)} disabled={busy}>Annuler</Button>
              <Button size="sm" onClick={persistOrder} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enregistrer l’ordre
              </Button>
            </>
          ) : null}
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nouvelle catégorie
          </Button>
        </div>
      </div>

      {/* ─── Arborescence ─── */}
      <div className="rounded-xl border border-border/70 bg-card">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : flatRows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
            <FolderTree className="h-10 w-10 opacity-40" />
            <p className="text-sm">Aucune catégorie. Créez votre première rubrique.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={flatRows.map((r) => r.category.id)} strategy={verticalListSortingStrategy}>
              <ul className="divide-y divide-border/60">
                {flatRows.map(({ category: c, depth }) => (
                  <li key={c.id} style={{ paddingLeft: `${depth * 24}px` }}>
                    <SortableItem id={c.id} className="pr-3">
                      <div className="flex flex-1 flex-wrap items-center gap-2 py-2.5 min-w-0">
                        {depth > 0 ? <FolderOpen className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" /> : null}
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color || 'var(--primary)' }} aria-hidden="true" />
                        <span className="truncate text-sm font-medium">{c.name}</span>
                        <code className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">/{c.slug}</code>
                        {c.showInMenu ? <Badge variant="outline" className="gap-1 text-[10px] font-normal"><Eye className="h-3 w-3" /> Menu</Badge> : null}
                        {c.showInHome ? <Badge variant="outline" className="gap-1 text-[10px] font-normal"><HomeIcon className="h-3 w-3" /> Accueil</Badge> : null}
                        <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">
                          {c.articleCount ?? 0} article(s)
                        </Badge>
                        <div className="flex shrink-0 gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTranslateTarget(c)} aria-label={`Traductions ${c.name}`} title="Traductions">
                            <Languages className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} aria-label={`Modifier ${c.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)} aria-label={`Supprimer ${c.name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </SortableItem>
                  </li>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ─── Dialog création / édition ─── */}
      <Dialog open={creating || editing !== null} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="font-editorial">{editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</DialogTitle>
            <DialogDescription>
              Les catégories structurent vos articles et votre menu de navigation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Nom" required>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                placeholder="Ex : Entrepreneuriat"
              />
            </Field>
            <Field label="Slug (URL)">
              <Input value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} className="font-mono text-xs" placeholder="entrepreneuriat" />
            </Field>
            <Field label="Description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Résumé affiché en tête de rubrique…" className="min-h-16 text-sm" />
            </Field>
            <Field label="Couleur" hint="Utilisée pour les badges et repères visuels du site.">
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setColor(p.value)}
                    title={p.name}
                    aria-label={`Couleur ${p.name}`}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                      color === p.value ? 'border-foreground shadow-md' : 'border-transparent',
                    )}
                    style={{ background: p.value }}
                  />
                ))}
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-10 cursor-pointer p-0.5"
                  aria-label="Couleur personnalisée"
                />
              </div>
            </Field>
            <Field label="Image de bannière" hint="Affichée en tête de la page catégorie.">
              <div className="flex items-center gap-3">
                {imageUrl ? (
                   
                  <img src={imageUrl} alt="Bannière" className="h-14 w-24 rounded-md object-cover" />
                ) : (
                  <div className="flex h-14 w-24 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                    <FolderTree className="h-5 w-5" />
                  </div>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  {imageUrl ? 'Changer' : 'Choisir une image'}
                </Button>
                {imageUrl ? (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setImageUrl('')}>
                    Retirer
                  </Button>
                ) : null}
              </div>
            </Field>
            <Field label="Catégorie parente" hint="Laissez « Aucune » pour une rubrique principale.">
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger aria-label="Catégorie parente"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune (catégorie principale)</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-wrap gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showInMenu} onCheckedChange={setShowInMenu} aria-label="Afficher dans le menu" />
                Visible dans le menu
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showInHome} onCheckedChange={setShowInHome} aria-label="Afficher sur la page d'accueil" />
                Bloc sur l’accueil
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={busy}>Annuler</Button>
            <Button onClick={submitForm} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Enregistrer' : 'Créer la catégorie'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(m) => { setImageUrl(m.url); setPickerOpen(false); }} title="Image de bannière" />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer cette catégorie ?"
        description={deleteTarget ? `« ${deleteTarget.name} » sera supprimée. La suppression est refusée si des articles y sont rattachés.` : ''}
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={doDelete}
      />
      <TranslationsDialog
        open={translateTarget !== null}
        onOpenChange={(o) => { if (!o) setTranslateTarget(null); }}
        entityType="category"
        entityId={translateTarget?.id ?? null}
        entityLabel={translateTarget?.name}
        fields={[
          { key: 'name', label: 'Nom traduit' },
          { key: 'description', label: 'Description traduite', multiline: true },
        ]}
      />
    </div>
  );
}
