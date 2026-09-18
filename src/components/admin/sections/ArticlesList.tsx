'use client';

// ═══════════════════════════════════════════════════════════════
// ARTICLES LIST — Liste des articles : filtres, recherche, actions
// en masse, export, duplication, suppression (confirmations).
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { ArticleSummary, ArticleStatus, Category } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { DataTable, type Column } from '../ui/DataTable';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  STATUS_META, formatDate, formatNumber, downloadExport, isAuthError, useDebounced,
} from '../ui/helpers';
import {
  Plus, Search, MoreHorizontal, Pencil, ExternalLink, Copy, Archive,
  Trash2, UploadCloud, Download, ArchiveRestore, Loader2, Eye, MessageSquare,
} from 'lucide-react';

type AdminArticleRow = ArticleSummary & { scheduledAt?: string | null };

export function ArticlesList() {
  const { toast } = useToast();
  const adminUser = useMagazineStore((s) => s.adminUser);
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);
  const isWriter = adminUser?.role === 'WRITER';

  const [rows, setRows] = React.useState<AdminArticleRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounced(search, 400);
  const [status, setStatus] = React.useState<string>('all');
  const [categoryId, setCategoryId] = React.useState<string>('all');
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [selection, setSelection] = React.useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = React.useState<
    | { kind: 'DELETE'; article: AdminArticleRow }
    | { kind: 'BULK_DELETE'; count: number }
    | { kind: 'BULK_ARCHIVE'; count: number }
    | { kind: 'ARCHIVE'; article: AdminArticleRow }
    | null
  >(null);

  React.useEffect(() => {
    adminApi.categories()
      .then((r) => setCategories(r.categories))
      .catch(() => {/* silencieux : le filtre catégorie reste vide */});
  }, []);

  const load = React.useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await adminApi.articles({
        page: p,
        limit: 12,
        status: status !== 'all' ? status : undefined,
        categoryId: categoryId !== 'all' ? categoryId : undefined,
        search: debouncedSearch || undefined,
        authorId: isWriter && adminUser ? adminUser.id : undefined,
      });
      setRows(res.items);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
      setSelection(new Set());
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Chargement impossible.' });
    } finally {
      setLoading(false);
    }
  }, [status, categoryId, debouncedSearch, isWriter, adminUser, toast, clearAdminSession]);

  React.useEffect(() => { load(1); }, [load]);

  // ─── Actions unitaires ────────────────────────────────────────
  const duplicateArticle = async (a: AdminArticleRow) => {
    setBusy(true);
    try {
      const { article } = await adminApi.article(a.id);
      const { article: created } = await adminApi.createArticle({
        title: `${article.title} (copie)`,
        subtitle: article.subtitle,
        content: article.content,
        coverImage: article.coverImage,
        coverCredit: article.coverCredit,
        status: 'DRAFT',
        categoryId: article.category?.id ?? '',
        authorId: article.author?.id,
        featured: false,
        trending: false,
        readingTime: article.readingTime,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        tags: article.tags,
      });
      toast({ title: 'Article dupliqué', description: `« ${created.title} » a été créé en brouillon.` });
      load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Duplication impossible', description: e instanceof Error ? e.message : 'Erreur inconnue.' });
    } finally {
      setBusy(false);
    }
  };

  const setArticleStatus = async (a: AdminArticleRow, s: ArticleStatus) => {
    setBusy(true);
    try {
      await adminApi.updateArticle(a.id, { status: s });
      toast({ title: 'Statut mis à jour', description: `« ${a.title} » est maintenant ${STATUS_META[s].label.toLowerCase()}.` });
      load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Mise à jour impossible.' });
    } finally {
      setBusy(false);
    }
  };

  const deleteArticle = async (a: AdminArticleRow) => {
    setBusy(true);
    try {
      await adminApi.deleteArticle(a.id);
      toast({ title: 'Article supprimé', description: `« ${a.title} » a été archivé définitivement.` });
      setConfirmState(null);
      load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Suppression impossible.' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Actions en masse ─────────────────────────────────────────
  const bulk = async (action: 'PUBLISH' | 'ARCHIVE' | 'DELETE') => {
    if (selection.size === 0) return;
    setBusy(true);
    try {
      await adminApi.bulkArticles(action, Array.from(selection));
      const labels = { PUBLISH: 'publié(s)', ARCHIVE: 'archivé(s)', DELETE: 'supprimé(s)' };
      toast({ title: 'Action appliquée', description: `${selection.size} article(s) ${labels[action]}.` });
      setConfirmState(null);
      load(page);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Action impossible.' });
    } finally {
      setBusy(false);
    }
  };

  // ─── Export ───────────────────────────────────────────────────
  const doExport = async (format: 'json' | 'csv') => {
    try {
      const { data } = await adminApi.export('articles', format);
      downloadExport(`articles-business-horizon.${format}`, data, format);
      toast({ title: 'Export réussi', description: `Le fichier « articles-business-horizon.${format} » a été téléchargé.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Export impossible', description: e instanceof Error ? e.message : 'Erreur inconnue.' });
    }
  };

  // ─── Colonnes ─────────────────────────────────────────────────
  const columns: Column<AdminArticleRow>[] = [
    {
      key: 'title',
      header: 'Titre',
      render: (a) => (
        <div className="max-w-72">
          <button
            type="button"
            className="line-clamp-2 text-left text-sm font-medium hover:text-primary hover:underline"
            onClick={() => navigate(`#/admin/editor/${a.id}`)}
            title={a.title}
          >
            {a.title}
          </button>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">/{a.slug}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Catégorie',
      render: (a) => a.category ? (
        <Badge variant="outline" className="gap-1.5 border-border/70 font-normal">
          <span className="h-2 w-2 rounded-full" style={{ background: a.category.color || 'var(--primary)' }} aria-hidden="true" />
          {a.category.name}
        </Badge>
      ) : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: 'author',
      header: 'Auteur',
      className: 'hidden md:table-cell',
      render: (a) => (
        <span className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
              {a.author?.name?.split(/\s+/).map((p) => p[0]).slice(0, 2).join('') ?? '?'}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm">{a.author?.name ?? '—'}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (a) => {
        const meta = STATUS_META[a.status] ?? STATUS_META.DRAFT;
        return <Badge variant="outline" className={meta.className}>{meta.label}</Badge>;
      },
    },
    {
      key: 'views',
      header: 'Vues',
      className: 'hidden sm:table-cell text-right tabular-nums',
      render: (a) => <span className="text-sm tabular-nums">{formatNumber(a.views)}</span>,
    },
    {
      key: 'comments',
      header: 'Comm.',
      className: 'hidden lg:table-cell text-right tabular-nums',
      render: (a) => (
        <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" /> {a.commentCount ?? 0}
        </span>
      ),
    },
    {
      key: 'date',
      header: 'Modifié le',
      className: 'hidden xl:table-cell whitespace-nowrap',
      render: (a) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(a.publishedAt ?? a.scheduledAt ?? null, false)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-10',
      render: (a) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions pour ${a.title}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate(`#/admin/editor/${a.id}`)}>
              <Pencil className="h-4 w-4" /> Éditer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`#/article/${a.slug}`)}>
              <ExternalLink className="h-4 w-4" /> Voir sur le site
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => duplicateArticle(a)} disabled={busy}>
              <Copy className="h-4 w-4" /> Dupliquer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {a.status === 'PUBLISHED' ? (
              <DropdownMenuItem onClick={() => setConfirmState({ kind: 'ARCHIVE', article: a })} disabled={busy}>
                <ArchiveRestore className="h-4 w-4" /> Archiver
              </DropdownMenuItem>
            ) : a.status !== 'ARCHIVED' ? (
              <DropdownMenuItem onClick={() => setArticleStatus(a, 'PUBLISHED')} disabled={busy}>
                <UploadCloud className="h-4 w-4" /> Publier
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={() => setConfirmState({ kind: 'DELETE', article: a })} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* ─── Barre d'outils ─── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un article par titre, slug, tag…"
            className="pl-8"
            aria-label="Rechercher un article"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v)}>
            <SelectTrigger className="w-40" aria-label="Filtrer par statut">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {(Object.keys(STATUS_META) as ArticleStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v)}>
            <SelectTrigger className="w-44" aria-label="Filtrer par catégorie">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => doExport('csv')} title="Exporter en CSV">
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => doExport('json')} title="Exporter en JSON">
            <Download className="h-4 w-4" /> JSON
          </Button>
          <Button size="sm" onClick={() => navigate('#/admin/editor')}>
            <Plus className="h-4 w-4" /> Nouvel article
          </Button>
        </div>
      </div>

      {/* ─── Barre d'actions en masse ─── */}
      {selection.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <p className="text-sm font-medium">{selection.size} sélectionné(s)</p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bulk('PUBLISH')} disabled={busy}>
              <UploadCloud className="h-4 w-4" /> Publier
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmState({ kind: 'BULK_ARCHIVE', count: selection.size })} disabled={busy}>
              <Archive className="h-4 w-4" /> Archiver
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmState({ kind: 'BULK_DELETE', count: selection.size })} disabled={busy}>
              <Trash2 className="h-4 w-4" /> Supprimer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelection(new Set())}>Annuler</Button>
          </div>
        </div>
      ) : null}

      {/* ─── Tableau ─── */}
      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        getRowId={(a) => a.id}
        selection={selection}
        onSelectionChange={setSelection}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => load(p)}
        emptyLabel="Aucun article ne correspond à ces filtres."
      />

      {/* ─── Confirmations ─── */}
      <ConfirmDialog
        open={confirmState?.kind === 'DELETE'}
        onOpenChange={(o) => { if (!o) setConfirmState(null); }}
        title="Supprimer cet article ?"
        description={confirmState?.kind === 'DELETE' ? `« ${confirmState.article.title} » sera définitivement archivé et retiré du site. Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={() => { if (confirmState?.kind === 'DELETE') deleteArticle(confirmState.article); }}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'ARCHIVE'}
        onOpenChange={(o) => { if (!o) setConfirmState(null); }}
        title="Archiver cet article ?"
        description={confirmState?.kind === 'ARCHIVE' ? `« ${confirmState.article.title} » ne sera plus visible sur le site mais restera dans vos archives.` : ''}
        confirmLabel="Archiver"
        destructive={false}
        loading={busy}
        onConfirm={() => { if (confirmState?.kind === 'ARCHIVE') setArticleStatus(confirmState.article, 'ARCHIVED').then(() => setConfirmState(null)); }}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'BULK_DELETE'}
        onOpenChange={(o) => { if (!o) setConfirmState(null); }}
        title={`Supprimer ${confirmState?.kind === 'BULK_DELETE' ? confirmState.count : 0} article(s) ?`}
        description="Les articles sélectionnés seront définitivement supprimés. Cette action est irréversible."
        confirmLabel="Tout supprimer"
        loading={busy}
        onConfirm={() => bulk('DELETE')}
      />
      <ConfirmDialog
        open={confirmState?.kind === 'BULK_ARCHIVE'}
        onOpenChange={(o) => { if (!o) setConfirmState(null); }}
        title={`Archiver ${confirmState?.kind === 'BULK_ARCHIVE' ? confirmState.count : 0} article(s) ?`}
        description="Les articles sélectionnés ne seront plus visibles sur le site."
        confirmLabel="Tout archiver"
        destructive={false}
        loading={busy}
        onConfirm={() => bulk('ARCHIVE')}
      />

      {busy ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" /> Opération en cours…
        </div>
      ) : null}

      {/* Indicateur vues global (a11y / lecture mobile) */}
      <p className="text-xs text-muted-foreground sm:hidden">
        <Eye className="mr-1 inline h-3.5 w-3.5" />
        {formatNumber(total)} article(s) au total
      </p>
    </div>
  );
}
