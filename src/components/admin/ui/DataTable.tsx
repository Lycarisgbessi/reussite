'use client';

// ═══════════════════════════════════════════════════════════════
// DATA TABLE — tableau générique (colonnes, sélection, pagination)
// + PAGER réutilisable
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Pagination ────────────────────────────────────────────────
interface PagerProps {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pager({ page, totalPages, total, onPageChange, className }: PagerProps) {
  if (totalPages <= 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-1 py-3', className)}>
      <p className="text-xs text-muted-foreground">
        {total !== undefined ? `${new Intl.NumberFormat('fr-FR').format(total)} résultat(s) — ` : ''}
        Page {page} sur {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline" size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Page précédente"
        >
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>
        <Button
          variant="outline" size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Page suivante"
        >
          Suivant <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── DataTable ─────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  skeletonRows?: number;
  emptyLabel?: string;
  selection?: Set<string>;
  onSelectionChange?: (next: Set<string>) => void;
  getRowId: (row: T) => string;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns, rows, loading, skeletonRows = 6, emptyLabel = 'Aucun résultat',
  selection, onSelectionChange, getRowId,
  page, totalPages, total, onPageChange, onRowClick,
}: DataTableProps<T>) {
  const allIds = React.useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selection?.has(id));
  const someSelected = allIds.some((id) => selection?.has(id)) && !allSelected;

  const toggleAll = () => {
    if (!selection || !onSelectionChange) return;
    const next = new Set(selection);
    if (allSelected) allIds.forEach((id) => next.delete(id));
    else allIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    if (!selection || !onSelectionChange) return;
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  return (
    <div className="space-y-1">
      <div className="overflow-x-auto custom-scrollbar rounded-lg border border-border/70 bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {selection && onSelectionChange ? (
                <TableHead className="w-10 pl-3">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
              ) : null}
              {columns.map((col) => (
                <TableHead key={col.key} className={cn('whitespace-nowrap', col.headerClassName)}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {selection && onSelectionChange ? (
                    <TableCell className="pl-3"><Skeleton className="h-4 w-4" /></TableCell>
                  ) : null}
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (selection && onSelectionChange ? 1 : 0)}>
                  <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                    <Inbox className="h-8 w-8 opacity-40" />
                    <p className="text-sm">{emptyLabel}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const id = getRowId(row);
                return (
                  <TableRow
                    key={id}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selection && onSelectionChange ? (
                      <TableCell className="pl-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selection.has(id)}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label="Sélectionner la ligne"
                        />
                      </TableCell>
                    ) : null}
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {page !== undefined && totalPages !== undefined && onPageChange ? (
        <Pager page={page} totalPages={totalPages} total={total} onPageChange={onPageChange} />
      ) : null}
    </div>
  );
}
