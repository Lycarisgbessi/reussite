'use client';

// ═══════════════════════════════════════════════════════════════
// NEWSLETTER ADMIN — Abonnés (recherche, activation, export) et
// campagnes (sélection d'articles, programmation, envoi).
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { ArticleSummary, NewsletterCampaign, NewsletterSubscriber } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { DataTable, type Column } from '../ui/DataTable';
import { Field } from '../ui/Field';
import {
  formatDate, formatPercent, downloadExport, isAuthError, toLocalInput, useDebounced,
} from '../ui/helpers';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Search, Plus, Pencil, Trash2, Loader2, Send, Download, Mail, MailOpen,
  Users, CheckSquare, Square,
} from 'lucide-react';

const CAMPAIGN_STATUS: Record<NewsletterCampaign['status'], { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-zinc-200/70 text-zinc-700 border-zinc-300/60 dark:bg-zinc-700/60 dark:text-zinc-200 dark:border-zinc-600' },
  SCHEDULED: { label: 'Planifiée', className: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900' },
  SENT: { label: 'Envoyée', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900' },
};

const SOURCE_LABELS: Record<string, string> = {
  POPUP: 'Popup',
  FOOTER: 'Pied de page',
  HERO: 'Bandeau',
  PAGE: 'Page newsletter',
  ARTICLE: 'Article',
  MANUAL: 'Manuel',
};

export function NewsletterAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  // ─── Abonnés ───
  const [subs, setSubs] = React.useState<NewsletterSubscriber[]>([]);
  const [subsTotal, setSubsTotal] = React.useState(0);
  const [subsPage, setSubsPage] = React.useState(1);
  const [subsTotalPages, setSubsTotalPages] = React.useState(1);
  const [subsLoading, setSubsLoading] = React.useState(true);
  const [subSearch, setSubSearch] = React.useState('');
  const debouncedSubSearch = useDebounced(subSearch, 400);

  // ─── Campagnes ───
  const [campaigns, setCampaigns] = React.useState<NewsletterCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = React.useState(true);

  // Dialog campagne
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<NewsletterCampaign | null>(null);
  const [subject, setSubject] = React.useState('');
  const [intro, setIntro] = React.useState('');
  const [selectedArticles, setSelectedArticles] = React.useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [publishedArticles, setPublishedArticles] = React.useState<ArticleSummary[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const [sendTarget, setSendTarget] = React.useState<NewsletterCampaign | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<NewsletterCampaign | null>(null);

  const handleErr = (e: unknown, fallback: string) => {
    if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
    toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : fallback });
  };

  const loadSubs = React.useCallback(async (p: number, q: string) => {
    setSubsLoading(true);
    try {
      const res = await adminApi.subscribers({ page: p, search: q || undefined });
      setSubs(res.items);
      setSubsTotal(res.total);
      setSubsPage(res.page);
      setSubsTotalPages(res.totalPages);
    } catch (e) {
      handleErr(e, 'Chargement impossible.');
    } finally {
      setSubsLoading(false);
    }
     
  }, []);

  const loadCampaigns = React.useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const r = await adminApi.campaigns();
      setCampaigns([...r.campaigns].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)));
    } catch (e) {
      handleErr(e, 'Chargement impossible.');
    } finally {
      setCampaignsLoading(false);
    }
     
  }, []);

  React.useEffect(() => { loadSubs(1, debouncedSubSearch); }, [debouncedSubSearch, loadSubs]);
  React.useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  React.useEffect(() => {
    adminApi.articles({ status: 'PUBLISHED', limit: 50 })
      .then((r) => setPublishedArticles(r.items))
      .catch(() => {});
  }, []);

  // ─── Abonnés : actions ────────────────────────────────────────
  const toggleSubscriber = async (s: NewsletterSubscriber, active: boolean) => {
    setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, active } : x)));
    try {
      await adminApi.updateSubscriber(s.id, { active });
      toast({ title: active ? 'Abonné réactivé' : 'Abonné désactivé', description: s.email });
    } catch (e) {
      setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: !active } : x)));
      handleErr(e, 'Mise à jour impossible.');
    }
  };

  const removeSubscriber = async (s: NewsletterSubscriber) => {
    try {
      await adminApi.deleteSubscriber(s.id);
      toast({ title: 'Abonné supprimé', description: `${s.email} a été retiré de la liste.` });
      loadSubs(subsPage, debouncedSubSearch);
    } catch (e) {
      handleErr(e, 'Suppression impossible.');
    }
  };

  const exportSubs = async () => {
    try {
      const { data } = await adminApi.export('subscribers', 'csv');
      downloadExport(`abonnes-newsletter.${'csv'}`, data, 'csv');
      toast({ title: 'Export réussi', description: 'La liste des abonnés a été téléchargée en CSV.' });
    } catch (e) {
      handleErr(e, 'Export impossible.');
    }
  };

  // ─── Campagnes : CRUD + envoi ─────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setSubject('');
    setIntro('');
    setSelectedArticles(new Set());
    setScheduledAt('');
    setDialogOpen(true);
  };

  const openEdit = (c: NewsletterCampaign) => {
    setEditing(c);
    setSubject(c.subject);
    setIntro(c.intro);
    setSelectedArticles(new Set(c.articleIds ? c.articleIds.split(',').filter(Boolean) : []));
    setScheduledAt(toLocalInput(c.scheduledAt));
    setDialogOpen(true);
  };

  const toggleArticle = (id: string) => {
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitCampaign = async () => {
    if (!subject.trim()) {
      toast({ variant: 'destructive', title: 'Sujet requis', description: 'Renseignez l’objet de la campagne.' });
      return;
    }
    setSaving(true);
    const payload: Partial<NewsletterCampaign> = {
      subject: subject.trim(),
      intro,
      articleIds: Array.from(selectedArticles).join(','),
      status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };
    try {
      if (editing) {
        await adminApi.updateCampaign(editing.id, payload);
        toast({ title: 'Campagne enregistrée', description: `« ${payload.subject} » a été mise à jour.` });
      } else {
        await adminApi.createCampaign(payload);
        toast({ title: 'Campagne créée', description: scheduledAt ? 'La campagne est planifiée.' : 'La campagne a été créée en brouillon.' });
      }
      setDialogOpen(false);
      loadCampaigns();
    } catch (e) {
      handleErr(e, 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const doSend = async () => {
    if (!sendTarget) return;
    setSendingId(sendTarget.id);
    try {
      const { campaign } = await adminApi.sendCampaign(sendTarget.id);
      toast({
        title: 'Campagne envoyée',
        description: `« ${campaign.subject} » envoyée à ${campaign.recipients} abonné(s).`,
      });
      setSendTarget(null);
      loadCampaigns();
    } catch (e) {
      handleErr(e, 'Envoi impossible.');
      setSendTarget(null);
    } finally {
      setSendingId(null);
    }
  };

  const doDeleteCampaign = async () => {
    if (!deleteTarget) return;
    try {
      await adminApi.deleteCampaign(deleteTarget.id);
      toast({ title: 'Campagne supprimée', description: `« ${deleteTarget.subject} » a été supprimée.` });
      setDeleteTarget(null);
      loadCampaigns();
    } catch (e) {
      handleErr(e, 'Suppression impossible.');
      setDeleteTarget(null);
    }
  };

  // ─── Colonnes abonnés ─────────────────────────────────────────
  const subColumns: Column<NewsletterSubscriber>[] = [
    {
      key: 'email',
      header: 'E-mail',
      render: (s) => (
        <div>
          <p className="text-sm font-medium">{s.email}</p>
          {s.name ? <p className="text-xs text-muted-foreground">{s.name}</p> : null}
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (s) => <Badge variant="secondary" className="font-normal">{SOURCE_LABELS[s.source] ?? (s.source || '—')}</Badge>,
    },
    {
      key: 'interests',
      header: 'Centres d’intérêt',
      className: 'hidden md:table-cell',
      render: (s) => <span className="text-xs text-muted-foreground">{s.interests || '—'}</span>,
    },
    {
      key: 'active',
      header: 'Actif',
      render: (s) => <Switch checked={s.active} onCheckedChange={(c) => toggleSubscriber(s, c)} aria-label={`Activer ${s.email}`} />,
    },
    {
      key: 'date',
      header: 'Inscrit le',
      className: 'hidden lg:table-cell whitespace-nowrap',
      render: (s) => <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'w-12',
      render: (s) => (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeSubscriber(s)} aria-label={`Supprimer ${s.email}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <Tabs defaultValue="subscribers" className="space-y-4">
      <TabsList>
        <TabsTrigger value="subscribers" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Abonnés</TabsTrigger>
        <TabsTrigger value="campaigns" className="gap-1.5"><MailOpen className="h-3.5 w-3.5" /> Campagnes</TabsTrigger>
      </TabsList>

      {/* ═════════ ABONNÉS ═════════ */}
      <TabsContent value="subscribers" className="mt-0 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
              placeholder="Rechercher un abonné par e-mail ou nom…"
              className="pl-8"
              aria-label="Rechercher un abonné"
            />
          </div>
          <Button size="sm" variant="outline" onClick={exportSubs}>
            <Download className="h-4 w-4" /> Exporter en CSV
          </Button>
        </div>
        <DataTable
          columns={subColumns}
          rows={subs}
          loading={subsLoading}
          getRowId={(s) => s.id}
          page={subsPage}
          totalPages={subsTotalPages}
          total={subsTotal}
          onPageChange={(p) => loadSubs(p, debouncedSubSearch)}
          emptyLabel="Aucun abonné trouvé."
        />
      </TabsContent>

      {/* ═════════ CAMPAGNES ═════════ */}
      <TabsContent value="campaigns" className="mt-0 space-y-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">Composez vos campagnes à partir des derniers articles publiés.</p>
          <Button size="sm" className="ml-auto" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nouvelle campagne
          </Button>
        </div>

        {campaignsLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-14 text-muted-foreground">
            <Mail className="h-9 w-9 opacity-40" />
            <p className="text-sm">Aucune campagne. Créez votre première newsletter.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {campaigns.map((c) => {
              const meta = CAMPAIGN_STATUS[c.status];
              return (
                <div key={c.id} className="flex flex-col rounded-xl border border-border/70 bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{c.subject}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.intro || 'Pas d’introduction.'}</p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0', meta.className)}>{meta.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-muted/50 px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Destinataires</p>
                      <p className="text-sm font-semibold tabular-nums">{c.status === 'SENT' ? c.recipients : '—'}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ouverture</p>
                      <p className="text-sm font-semibold tabular-nums">{c.status === 'SENT' ? formatPercent(c.openRate, 0) : '—'}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 px-2 py-1.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Clics</p>
                      <p className="text-sm font-semibold tabular-nums">{c.status === 'SENT' ? formatPercent(c.clickRate, 0) : '—'}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {c.status === 'SENT' && c.sentAt ? `Envoyée le ${formatDate(c.sentAt, true)}` : c.scheduledAt ? `Programmée pour le ${formatDate(c.scheduledAt, true)}` : `Créée le ${formatDate(c.createdAt)}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                    {c.status !== 'SENT' ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" /> Modifier
                        </Button>
                        <Button size="sm" className="gap-1" onClick={() => setSendTarget(c)} disabled={sendingId === c.id}>
                          <Send className="h-3.5 w-3.5" /> Envoyer maintenant
                        </Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">Supprimer la campagne</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Dialog campagne ─── */}
        <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o && !saving) setDialogOpen(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <DialogHeader>
              <DialogTitle className="font-editorial">{editing ? 'Modifier la campagne' : 'Nouvelle campagne'}</DialogTitle>
              <DialogDescription>La newsletter reprend automatiquement le visuel du site avec vos articles sélectionnés.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Field label="Sujet de l’e-mail" required counter={<span>{subject.length}</span>}>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex : Le meilleur de la semaine 🚀" />
              </Field>
              <Field label="Intro / édito">
                <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Bonjour, voici les incontournables de la semaine…" className="min-h-20 text-sm" />
              </Field>
              <Field
                label="Articles inclus"
                hint="Sélectionnez les articles publiés à mettre en avant dans l’e-mail."
                counter={<span>{selectedArticles.size} sélectionné(s)</span>}
              >
                <div className="rounded-lg border border-border/60">
                  <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                    <span className="text-xs text-muted-foreground">{publishedArticles.length} article(s) publié(s)</span>
                    <Button
                      type="button" variant="ghost" size="sm" className="h-6 text-[11px]"
                      onClick={() => setSelectedArticles(
                        selectedArticles.size === publishedArticles.length
                          ? new Set()
                          : new Set(publishedArticles.map((a) => a.id)),
                      )}
                    >
                      {selectedArticles.size === publishedArticles.length && publishedArticles.length > 0
                        ? <><Square className="h-3 w-3" /> Tout désélectionner</>
                        : <><CheckSquare className="h-3 w-3" /> Tout sélectionner</>}
                    </Button>
                  </div>
                  <ScrollArea className="max-h-56">
                    <ul className="divide-y divide-border/50">
                      {publishedArticles.map((a) => (
                        <li key={a.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-accent/60">
                            <Checkbox
                              checked={selectedArticles.has(a.id)}
                              onCheckedChange={() => toggleArticle(a.id)}
                              aria-label={`Inclure ${a.title}`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{a.title}</p>
                              <p className="text-[11px] text-muted-foreground">{a.category?.name} · {formatDate(a.publishedAt)}</p>
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              </Field>
              <Field label="Programmation (optionnelle)" hint="Laissez vide pour un brouillon simple.">
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} aria-label="Date d'envoi programmée" />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
              <Button onClick={submitCampaign} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editing ? 'Enregistrer' : 'Créer la campagne'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      {/* ─── Confirmations ─── */}
      <ConfirmDialog
        open={sendTarget !== null}
        onOpenChange={(o) => { if (!o) setSendTarget(null); }}
        title="Envoyer cette campagne maintenant ?"
        description={sendTarget ? `« ${sendTarget.subject} » sera envoyée immédiatement à tous les abonnés actifs. Cette action est irréversible.` : ''}
        confirmLabel="Envoyer à tous les abonnés"
        destructive={false}
        loading={sendingId !== null}
        onConfirm={doSend}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer cette campagne ?"
        description={deleteTarget ? `« ${deleteTarget.subject} » sera définitivement supprimée.` : ''}
        confirmLabel="Supprimer"
        onConfirm={doDeleteCampaign}
      />
    </Tabs>
  );
}
