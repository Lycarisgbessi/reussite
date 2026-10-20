'use client';

// ═══════════════════════════════════════════════════════════════
// PAGES ADMIN — Pages statiques (mentions légales, CGU…) : liste,
// éditeur plein écran (markdown léger), SEO, suppression protégée.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { StaticPageItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { BetaLock } from '../ui/BetaLock';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field } from '../ui/Field';
import { DataTable, type Column } from '../ui/DataTable';
import { slugify, formatDate, isAuthError } from '../ui/helpers';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, FileText, Info, ExternalLink } from 'lucide-react';

// Slugs protégés : suppression interdite
const PROTECTED_SLUGS = ['mentions-legales', 'cgu', 'politique-confidentialite'];

const EMPTY_FORM = {
  title: '',
  slug: '',
  slugTouched: false,
  content: '',
  seoTitle: '',
  seoDescription: '',
  published: false,
};

export function PagesAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [pages, setPages] = React.useState<StaticPageItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  // Éditeur plein écran
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StaticPageItem | null>(null);
  const [form, setForm] = React.useState({ ...EMPTY_FORM });
  const [deleteTarget, setDeleteTarget] = React.useState<StaticPageItem | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.pages();
      setPages(r.pages);
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Chargement impossible.' });
    } finally {
      setLoading(false);
    }
  }, [toast, clearAdminSession]);

  React.useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setEditorOpen(true);
  };

  const openEdit = (p: StaticPageItem) => {
    setEditing(p);
    setForm({
      title: p.title, slug: p.slug, slugTouched: true, content: p.content,
      seoTitle: p.seoTitle, seoDescription: p.seoDescription, published: p.published,
    });
    setEditorOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: 'Titre requis', description: 'Renseignez le titre de la page.' });
      return;
    }
    setBusy(true);
    const payload: Partial<StaticPageItem> = {
      title: form.title.trim(),
      slug: form.slug || slugify(form.title),
      content: form.content,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      published: form.published,
    };
    try {
      if (editing) {
        await adminApi.updatePage(editing.id, payload);
        toast({ title: 'Page enregistrée', description: `« ${payload.title} » a été mise à jour.` });
      } else {
        await adminApi.createPage(payload);
        toast({ title: 'Page créée', description: `« ${payload.title} » a été ajoutée.` });
      }
      setEditorOpen(false);
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (p: StaticPageItem, published: boolean) => {
    setPages((prev) => prev.map((x) => (x.id === p.id ? { ...x, published } : x)));
    try {
      await adminApi.updatePage(p.id, { published });
      toast({ title: published ? 'Page publiée' : 'Page dépubliée', description: p.title });
    } catch (e) {
      setPages((prev) => prev.map((x) => (x.id === p.id ? { ...x, published: !published } : x)));
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour impossible.' });
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    if (PROTECTED_SLUGS.includes(deleteTarget.slug)) {
      toast({ variant: 'destructive', title: 'Page protégée', description: 'Les mentions légales, CGU et politique de confidentialité ne peuvent pas être supprimées.' });
      setDeleteTarget(null);
      return;
    }
    setBusy(true);
    try {
      await adminApi.deletePage(deleteTarget.id);
      toast({ title: 'Page supprimée', description: `« ${deleteTarget.title} » a été supprimée.` });
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: e instanceof Error ? e.message : 'Erreur inconnue.' });
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<StaticPageItem>[] = [
    {
      key: 'title',
      header: 'Page',
      render: (p) => (
        <div>
          <p className="text-sm font-medium">{p.title}</p>
          <code className="text-[10px] text-muted-foreground">#/page/{p.slug}</code>
        </div>
      ),
    },
    {
      key: 'published',
      header: 'Publiée',
      render: (p) => <Switch checked={p.published} onCheckedChange={(c) => togglePublished(p, c)} aria-label={`Publier ${p.title}`} />,
    },
    {
      key: 'updatedAt',
      header: 'Modifiée le',
      className: 'hidden sm:table-cell whitespace-nowrap',
      render: (p) => <span className="text-xs text-muted-foreground">{formatDate(p.updatedAt, true)}</span>,
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`#/page/${p.slug}`)} aria-label={`Voir ${p.title} sur le site`}>
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className={PROTECTED_SLUGS.includes(p.slug)
              ? 'h-8 w-8 cursor-not-allowed text-muted-foreground/40'
              : 'h-8 w-8 text-destructive hover:text-destructive'}
            onClick={() => {
              if (PROTECTED_SLUGS.includes(p.slug)) {
                toast({ variant: 'destructive', title: 'Page protégée', description: 'Cette page légale ne peut pas être supprimée.' });
                return;
              }
              setDeleteTarget(p);
            }}
            aria-label={PROTECTED_SLUGS.includes(p.slug) ? `Page protégée : ${p.title}` : `Supprimer ${p.title}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <BetaLock sectionName="Pages statiques">
    <>
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground">
          Pages institutionnelles accessibles via #/page/… Les pages légales sont protégées.
        </p>
        <Button size="sm" className="ml-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nouvelle page
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={pages}
        loading={loading}
        getRowId={(p) => p.id}
        emptyLabel="Aucune page statique pour le moment."
      />

      {/* ─── Éditeur plein écran ─── */}
      <Dialog open={editorOpen} onOpenChange={(o) => { if (!o && !busy) setEditorOpen(false); }}>
        <DialogContent className="h-[92vh] max-w-4xl overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-editorial">
              <ArrowLeft className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => !busy && setEditorOpen(false)} aria-label="Retour" />
              {editing ? 'Modifier la page' : 'Nouvelle page'}
            </DialogTitle>
            <DialogDescription>Contenu au format markdown léger.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Titre" required>
                <Input
                  value={form.title}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, title: e.target.value, slug: f.slugTouched ? f.slug : slugify(e.target.value) }));
                  }}
                  placeholder="Ex : Notre équipe"
                />
              </Field>
              <Field label="Slug (URL)" hint="Les slugs protégés (mentions-legales, cgu, politique-confidentialite) existent déjà.">
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value), slugTouched: true }))}
                  className="font-mono text-xs"
                  placeholder="notre-equipe"
                />
              </Field>
            </div>
            <Field
              label="Contenu"
              hint="Markdown léger : sautez une ligne entre les paragraphes. « ## Titre » pour un titre, « ### Sous-titre », « - élément » pour une liste, **gras**."
            >
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                className="min-h-[320px] font-mono text-[13px] leading-relaxed"
                placeholder={'Introduction de la page.\n\n## Première section\n\nVotre texte ici.\n\n- Point un\n- Point deux'}
              />
            </Field>
            <p className="flex items-start gap-1.5 rounded-md bg-muted/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Aide markdown : paragraphe = texte suivi d’une ligne vide ; « ## Titre » et « ### Sous-titre » pour les
              intertitres ; « - élément » pour les listes ; **texte** pour le gras.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Titre SEO" counter={<span>{form.seoTitle.length}/60</span>}>
                <Input value={form.seoTitle} onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))} />
              </Field>
              <Field label="Méta description" counter={<span>{form.seoDescription.length}/160</span>}>
                <Input value={form.seoDescription} onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))} />
              </Field>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <span className="text-sm font-medium">Page publiée</span>
              <Switch checked={form.published} onCheckedChange={(v) => setForm((f) => ({ ...f, published: v }))} aria-label="Page publiée" />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={busy}>Annuler</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Enregistrer la page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer cette page ?"
        description={deleteTarget ? `« ${deleteTarget.title} » sera définitivement supprimée. Les liens entrants cesseront de fonctionner.` : ''}
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={doDelete}
      />
    </div>
    </>
    </BetaLock>
  );
}
