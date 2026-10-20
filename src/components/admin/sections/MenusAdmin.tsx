'use client';

// ═══════════════════════════════════════════════════════════════
// MENUS ADMIN — Menus header/footer : drag & drop pour réordonner
// (@dnd-kit → reorderMenu), items avec URL guidée + sous-menus.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { Category, MenuItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { BetaLock } from '../ui/BetaLock';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SortableItem } from '../ui/SortableItem';
import { Field } from '../ui/Field';
import { isAuthError } from '../ui/helpers';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
import { Plus, Pencil, Trash2, Loader2, Save, CornerDownRight, Link2 } from 'lucide-react';

type Location = 'header' | 'footer';

// Presets d'URL proposés dans le formulaire
function buildUrlPresets(categories: Category[]): { value: string; label: string }[] {
  const presets: { value: string; label: string }[] = [
    { value: '#/', label: 'Accueil (#/)' },
    { value: '#/videos', label: 'Vidéos (#/videos)' },
    { value: '#/podcasts', label: 'Podcasts (#/podcasts)' },
    { value: '#/newsletter', label: 'Newsletter (#/newsletter)' },
    { value: '#/announcers', label: 'Annonceurs (#/announcers)' },
    { value: '#/contact', label: 'Contact (#/contact)' },
    { value: '#/page/mentions-legales', label: 'Mentions légales' },
    { value: '#/page/cgu', label: 'CGU' },
    { value: '#/page/politique-confidentialite', label: 'Politique de confidentialité' },
  ];
  const walk = (cats: Category[]) => {
    for (const c of cats) {
      presets.push({ value: `#/category/${c.slug}`, label: `Rubrique : ${c.name}` });
      if (c.children?.length) walk(c.children);
    }
  };
  walk(categories);
  return presets;
}

const CUSTOM = '__custom__';

export function MenusAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [items, setItems] = React.useState<MenuItem[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [tab, setTab] = React.useState<Location>('header');
  const [order, setOrder] = React.useState<string[] | null>(null);

  // Dialog
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MenuItem | null>(null);
  const [label, setLabel] = React.useState('');
  const [urlPreset, setUrlPreset] = React.useState<string>('#/');
  const [customUrl, setCustomUrl] = React.useState('');
  const [parentId, setParentId] = React.useState<string>('none');
  const [active, setActive] = React.useState(true);
  const [deleteTarget, setDeleteTarget] = React.useState<MenuItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [menuRes, catRes] = await Promise.all([
        adminApi.menus(),
        adminApi.categories().catch(() => ({ categories: [] as Category[] })),
      ]);
      setItems(menuRes.items);
      setCategories(catRes.categories);
      setOrder(null);
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Chargement impossible.' });
    } finally {
      setLoading(false);
    }
  }, [toast, clearAdminSession]);

  React.useEffect(() => { load(); }, [load]);

  const locationItems = React.useMemo(() => {
    const list = items.filter((i) => i.location === tab).sort((a, b) => a.order - b.order);
    if (!order) return list;
    const map = new Map(list.map((i) => [i.id, i]));
    return order.map((id) => map.get(id)).filter((i): i is MenuItem => Boolean(i));
  }, [items, tab, order]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = locationItems.map((i) => i.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    setOrder(arrayMove(ids, from, to));
  };

  const persistOrder = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await adminApi.reorderMenu(order);
      toast({ title: 'Ordre enregistré', description: 'Le menu a été réordonné.' });
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Réordonnancement impossible.' });
    } finally {
      setBusy(false);
    }
  };

  const presets = React.useMemo(() => buildUrlPresets(categories), [categories]);

  const openCreate = () => {
    setEditing(null);
    setLabel('');
    setUrlPreset('#/');
    setCustomUrl('');
    setParentId('none');
    setActive(true);
    setDialogOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setEditing(item);
    setLabel(item.label);
    const isPreset = presets.some((p) => p.value === item.url);
    setUrlPreset(isPreset ? item.url : CUSTOM);
    setCustomUrl(isPreset ? '' : item.url);
    setParentId(item.parentId ?? 'none');
    setActive(item.active);
    setDialogOpen(true);
  };

  const resolveUrl = () => (urlPreset === CUSTOM ? customUrl.trim() : urlPreset);

  const submit = async () => {
    if (!label.trim()) {
      toast({ variant: 'destructive', title: 'Libellé requis', description: 'Renseignez le texte affiché dans le menu.' });
      return;
    }
    const url = resolveUrl();
    if (!url) {
      toast({ variant: 'destructive', title: 'URL requise', description: 'Choisissez un lien ou saisissez une URL libre.' });
      return;
    }
    setBusy(true);
    const payload: Partial<MenuItem> = {
      label: label.trim(), url, location: tab,
      parentId: parentId === 'none' ? null : parentId, active,
    };
    try {
      if (editing) {
        await adminApi.updateMenuItem(editing.id, payload);
        toast({ title: 'Élément modifié', description: `« ${payload.label} » a été mis à jour.` });
      } else {
        await adminApi.createMenuItem({ ...payload, order: locationItems.length });
        toast({ title: 'Élément ajouté', description: `« ${payload.label} » apparaît dans le menu.` });
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (item: MenuItem, isActive: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: isActive } : i)));
    try {
      await adminApi.updateMenuItem(item.id, { active: isActive });
    } catch (e) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, active: !isActive } : i)));
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour impossible.' });
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteMenuItem(deleteTarget.id);
      toast({ title: 'Élément supprimé', description: `« ${deleteTarget.label} » a été retiré du menu.` });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Suppression impossible.' });
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const parentOptions = locationItems.filter((i) => !i.parentId && i.id !== editing?.id);
  const topLevels = locationItems.filter((i) => !i.parentId);
  const childrenOf = (pid: string) => locationItems.filter((i) => i.parentId === pid);

  // Rendu d'un item avec indentation des sous-menus
  const renderItems = () => {
    const rows: { item: MenuItem; depth: number }[] = [];
    for (const t of topLevels) {
      rows.push({ item: t, depth: 0 });
      childrenOf(t.id).forEach((c) => rows.push({ item: c, depth: 1 }));
    }
    // Items orphelins (parent supprimé) affichés à la fin
    const known = new Set(rows.map((r) => r.item.id));
    locationItems.filter((i) => !known.has(i.id)).forEach((o) => rows.push({ item: o, depth: 0 }));

    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.item.id)} strategy={verticalListSortingStrategy}>
          <ul className="divide-y divide-border/60">
            {rows.map(({ item, depth }) => (
              <li key={item.id} style={{ paddingLeft: `${depth * 24}px` }}>
                <SortableItem id={item.id} className="px-2">
                  <div className="flex flex-1 flex-wrap items-center gap-2 py-2.5 min-w-0">
                    {depth > 0 ? <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" /> : null}
                    <span className="truncate text-sm font-medium">{item.label}</span>
                    <code className="hidden truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">{item.url}</code>
                    {!item.active ? <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">Inactif</Badge> : null}
                    <div className="ml-auto flex shrink-0 items-center gap-1.5">
                      <Switch checked={item.active} onCheckedChange={(c) => toggleActive(item, c)} aria-label={`Activer ${item.label}`} />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)} aria-label={`Modifier ${item.label}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)} aria-label={`Supprimer ${item.label}`}>
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
    );
  };

  return (
    <BetaLock sectionName="Menus de navigation">
    <Tabs value={tab} onValueChange={(v) => { setTab(v as Location); setOrder(null); }} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="header">Menu principal (header)</TabsTrigger>
          <TabsTrigger value="footer">Menu pied de page</TabsTrigger>
        </TabsList>
        <div className="ml-auto flex gap-2">
          {order ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setOrder(null)} disabled={busy}>Annuler</Button>
              <Button size="sm" onClick={persistOrder} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer l’ordre
              </Button>
            </>
          ) : null}
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nouvel élément
          </Button>
        </div>
      </div>

      <TabsContent value={tab} className="mt-0 space-y-4">
        <p className="text-sm text-muted-foreground">
          Glissez-déposez pour réordonner. Un élément peut être rattaché à un parent pour former un sous-menu.
        </p>
        <div className="rounded-xl border border-border/70 bg-card">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
            </div>
          ) : locationItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Link2 className="h-8 w-8 opacity-40" />
              <p className="text-sm">Aucun élément dans ce menu.</p>
            </div>
          ) : (
            renderItems()
          )}
        </div>
      </TabsContent>

      {/* ─── Dialog création / édition ─── */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-editorial">{editing ? 'Modifier l’élément' : 'Nouvel élément de menu'}</DialogTitle>
            <DialogDescription>Choisissez un lien parmi les presets ou saisissez une URL libre.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Libellé" required>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex : Entrepreneuriat" />
            </Field>
            <Field label="Lien">
              <Select value={urlPreset} onValueChange={setUrlPreset}>
                <SelectTrigger aria-label="Lien du menu"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {presets.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  <SelectItem value={CUSTOM}>✏️ URL libre…</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {urlPreset === CUSTOM ? (
              <Field label="URL libre" required hint="Doit commencer par #/ pour une page interne.">
                <Input value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="#/ma-page" className="font-mono text-xs" />
              </Field>
            ) : null}
            <Field label="Élément parent" hint="Laissez « Aucun » pour un élément de premier niveau.">
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger aria-label="Élément parent"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun (premier niveau)</SelectItem>
                  {parentOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <span className="text-sm font-medium">Élément actif</span>
              <Switch checked={active} onCheckedChange={setActive} aria-label="Élément actif" />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>Annuler</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer cet élément de menu ?"
        description={deleteTarget ? `« ${deleteTarget.label} » sera retiré du menu${deleteTarget.parentId ? '' : ' ainsi que ses sous-éléments rattachés'}.` : ''}
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={doDelete}
      />
    </Tabs>
    </BetaLock>
  );
}
