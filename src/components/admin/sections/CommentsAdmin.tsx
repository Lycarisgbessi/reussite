'use client';

// ═══════════════════════════════════════════════════════════════
// COMMENTS ADMIN — Modération : onglets par statut, validation,
// rejet, réponse inline, suppression. Rafraîchit le badge sidebar.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { CommentItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { AdminNavContext } from '../layout/AdminShell';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { formatDate, isAuthError, initials } from '../ui/helpers';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pager } from '../ui/DataTable';
import {
  Check, X, Reply, Trash2, MessageSquare, ExternalLink, Loader2, CornerDownRight,
} from 'lucide-react';

type TabStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const TAB_META: Record<TabStatus, { label: string }> = {
  PENDING: { label: 'En attente' },
  APPROVED: { label: 'Validés' },
  REJECTED: { label: 'Rejetés' },
};

export function CommentsAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);
  const { refreshBadges } = React.useContext(AdminNavContext);

  const [lists, setLists] = React.useState<Record<TabStatus, CommentItem[]>>({ PENDING: [], APPROVED: [], REJECTED: [] });
  const [counts, setCounts] = React.useState<Record<TabStatus, number>>({ PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [pages, setPages] = React.useState<Record<TabStatus, number>>({ PENDING: 1, APPROVED: 1, REJECTED: 1 });
  const [totalPages, setTotalPages] = React.useState<Record<TabStatus, number>>({ PENDING: 1, APPROVED: 1, REJECTED: 1 });
  const [loading, setLoading] = React.useState<Record<TabStatus, boolean>>({ PENDING: true, APPROVED: false, REJECTED: false });
  const [tab, setTab] = React.useState<TabStatus>('PENDING');
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [replyingId, setReplyingId] = React.useState<string | null>(null);
  const [replyText, setReplyText] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState<CommentItem | null>(null);

  const loadStatus = React.useCallback(async (status: TabStatus, page = 1) => {
    setLoading((prev) => ({ ...prev, [status]: true }));
    try {
      const res = await adminApi.comments({ status, page });
      setLists((prev) => ({ ...prev, [status]: res.items }));
      setCounts((prev) => ({ ...prev, [status]: res.total }));
      setPages((prev) => ({ ...prev, [status]: res.page }));
      setTotalPages((prev) => ({ ...prev, [status]: res.totalPages }));
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Chargement impossible.' });
    } finally {
      setLoading((prev) => ({ ...prev, [status]: false }));
    }
  }, [toast, clearAdminSession]);

  React.useEffect(() => {
    // Charge les 3 statuts au montage pour les compteurs d'onglets
    (['PENDING', 'APPROVED', 'REJECTED'] as TabStatus[]).forEach((s) => loadStatus(s, 1));
  }, [loadStatus]);

  const afterAction = () => {
    (['PENDING', 'APPROVED', 'REJECTED'] as TabStatus[]).forEach((s) => loadStatus(s, 1));
    refreshBadges();
  };

  const setStatus = async (c: CommentItem, status: 'APPROVED' | 'REJECTED') => {
    setBusyId(c.id);
    try {
      await adminApi.updateComment(c.id, { status });
      toast({
        title: status === 'APPROVED' ? 'Commentaire validé' : 'Commentaire rejeté',
        description: `Le commentaire de ${c.authorName} a été ${status === 'APPROVED' ? 'publié' : 'masqué'}.`,
      });
      afterAction();
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Action impossible.' });
    } finally {
      setBusyId(null);
    }
  };

  const sendReply = async (c: CommentItem) => {
    if (!replyText.trim()) {
      toast({ variant: 'destructive', title: 'Réponse vide', description: 'Rédigez votre réponse avant de l’envoyer.' });
      return;
    }
    setBusyId(c.id);
    try {
      await adminApi.updateComment(c.id, { reply: replyText.trim() });
      toast({ title: 'Réponse enregistrée', description: `Votre réponse au commentaire de ${c.authorName} est publiée.` });
      setReplyingId(null);
      setReplyText('');
      afterAction();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Réponse impossible.' });
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await adminApi.deleteComment(deleteTarget.id);
      toast({ title: 'Commentaire supprimé', description: `Le commentaire de ${deleteTarget.authorName} a été supprimé.` });
      setDeleteTarget(null);
      afterAction();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Suppression impossible.' });
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  const renderList = (status: TabStatus) => {
    const items = lists[status];
    if (loading[status]) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-14 text-muted-foreground">
          <MessageSquare className="h-9 w-9 opacity-40" />
          <p className="text-sm">Aucun commentaire {TAB_META[status].label.toLowerCase()}.</p>
        </div>
      );
    }
    return (
      <>
        <div className="space-y-3">
          {items.map((c) => (
            <article key={c.id} className="rounded-xl border border-border/70 bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials(c.authorName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="text-sm font-semibold">{c.authorName}</p>
                    <a href={`mailto:${c.authorEmail}`} className="text-xs text-muted-foreground hover:text-primary hover:underline">{c.authorEmail}</a>
                    <span className="text-xs text-muted-foreground">· {formatDate(c.createdAt, true)}</span>
                  </div>
                  {c.articleTitle ? (
                    <button
                      type="button"
                      onClick={() => c.articleSlug && navigate(`#/article/${c.articleSlug}`)}
                      className="mt-0.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> {c.articleTitle}
                    </button>
                  ) : null}
                  <p className="mt-2 text-sm leading-relaxed">{c.content}</p>
                  {c.reply ? (
                    <div className="mt-3 rounded-lg border-l-4 border-primary/50 bg-primary/5 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                        <CornerDownRight className="h-3 w-3" /> Réponse de la rédaction
                      </p>
                      <p className="mt-1 text-sm">{c.reply}</p>
                    </div>
                  ) : null}

                  {/* Réponse inline */}
                  {replyingId === c.id ? (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Votre réponse publique au commentaire…"
                        className="min-h-20 text-sm"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => sendReply(c)} disabled={busyId === c.id}>
                          {busyId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
                          Envoyer la réponse
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setReplyingId(null); setReplyText(''); }}>Annuler</Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {status !== 'APPROVED' ? (
                    <Button size="sm" variant="outline" className="gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950" onClick={() => setStatus(c, 'APPROVED')} disabled={busyId === c.id}>
                      <Check className="h-4 w-4" /> Valider
                    </Button>
                  ) : null}
                  {status !== 'REJECTED' ? (
                    <Button size="sm" variant="outline" className="gap-1 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950" onClick={() => setStatus(c, 'REJECTED')} disabled={busyId === c.id}>
                      <X className="h-4 w-4" /> Rejeter
                    </Button>
                  ) : null}
                  <Button
                    size="sm" variant="outline" className="gap-1"
                    onClick={() => { setReplyingId(replyingId === c.id ? null : c.id); setReplyText(c.reply ?? ''); }}
                  >
                    <Reply className="h-4 w-4" /> Répondre
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Supprimer</span>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Pager page={pages[status]} totalPages={totalPages[status]} total={counts[status]} onPageChange={(p) => loadStatus(status, p)} />
      </>
    );
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabStatus)} className="space-y-4">
      <TabsList>
        {(['PENDING', 'APPROVED', 'REJECTED'] as TabStatus[]).map((s) => (
          <TabsTrigger key={s} value={s} className="gap-1.5">
            {TAB_META[s].label}
            <Badge
              variant="secondary"
              className={cn('ml-1 h-5 min-w-5 px-1 text-[10px]', s === 'PENDING' && counts.PENDING > 0 && 'bg-primary text-primary-foreground')}
            >
              {counts[s]}
            </Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {(['PENDING', 'APPROVED', 'REJECTED'] as TabStatus[]).map((s) => (
        <TabsContent key={s} value={s} className="mt-0 space-y-3">
          {renderList(s)}
        </TabsContent>
      ))}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Supprimer ce commentaire ?"
        description={deleteTarget ? `Le commentaire de ${deleteTarget.authorName} sera définitivement supprimé.` : ''}
        confirmLabel="Supprimer"
        onConfirm={doDelete}
      />
    </Tabs>
  );
}
