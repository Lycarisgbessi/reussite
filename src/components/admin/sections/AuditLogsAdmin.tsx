'use client';

// ═══════════════════════════════════════════════════════════════
// AUDIT LOGS — Journal d'audit : traçabilité des actions admin
// (créations, modifications, suppressions, connexions).
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { AuditLogItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { DataTable, type Column } from '../ui/DataTable';
import { formatDate, initials, isAuthError } from '../ui/helpers';
import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

/** Couleur + libellé du badge selon le type d'action. */
function actionMeta(action: string): { label: string; className: string } {
  const a = action.toUpperCase();
  if (a.includes('CREATE')) return { label: 'Création', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900' };
  if (a.includes('UPDATE') || a.includes('RESTORE')) return { label: 'Modification', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900' };
  if (a.includes('DELETE')) return { label: 'Suppression', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900' };
  if (a.includes('LOGIN')) return { label: 'Connexion', className: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900' };
  if (a.includes('SEND') || a.includes('PUBLISH')) return { label: 'Publication', className: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-900' };
  return { label: action || 'Action', className: 'bg-zinc-200/70 text-zinc-700 border-zinc-300/60 dark:bg-zinc-700/60 dark:text-zinc-200 dark:border-zinc-600' };
}

export function AuditLogsAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [rows, setRows] = React.useState<AuditLogItem[]>([]);
  const [allRows, setAllRows] = React.useState<AuditLogItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');

  const load = React.useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await adminApi.auditLogs(p);
      setAllRows(res.items);
      setTotal(res.total);
      setPage(res.page);
      setTotalPages(res.totalPages);
      setRows(res.items);
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Chargement impossible.' });
    } finally {
      setLoading(false);
    }
  }, [toast, clearAdminSession]);

  React.useEffect(() => { load(1); }, [load]);

  // Filtre client (utilisateur, action, détails)
  React.useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) { setRows(allRows); return; }
    setRows(allRows.filter((r) =>
      r.userName?.toLowerCase().includes(q)
      || r.action?.toLowerCase().includes(q)
      || r.details?.toLowerCase().includes(q),
    ));
  }, [search, allRows]);

  const columns: Column<AuditLogItem>[] = [
    {
      key: 'user',
      header: 'Utilisateur',
      render: (r) => (
        <span className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">{initials(r.userName || '?')}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium">{r.userName || 'Système'}</span>
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => {
        const meta = actionMeta(r.action);
        return <Badge variant="outline" className={cn('whitespace-nowrap font-normal', meta.className)}>{meta.label}</Badge>;
      },
    },
    {
      key: 'details',
      header: 'Détails',
      className: 'max-w-96',
      render: (r) => (
        <span className="block truncate text-sm text-muted-foreground" title={r.details}>{r.details || '—'}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      className: 'whitespace-nowrap text-right',
      render: (r) => <span className="text-xs text-muted-foreground tabular-nums">{formatDate(r.createdAt, true)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-muted-foreground">
          Toutes les actions effectuées dans le CMS sont tracées ici.
        </p>
        <div className="relative sm:ml-auto sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer (utilisateur, action…)"
            className="pl-8"
            aria-label="Filtrer le journal d'audit"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        skeletonRows={8}
        getRowId={(r) => r.id}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={(p) => load(p)}
        emptyLabel={search ? 'Aucune entrée ne correspond à ce filtre.' : 'Aucune activité enregistrée.'}
      />
    </div>
  );
}
