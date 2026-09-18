'use client';

// ═══════════════════════════════════════════════════════════════
// STAT CARD — carte KPI du tableau de bord / analytics
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  sub?: React.ReactNode;
  loading?: boolean;
  className?: string;
  iconClassName?: string;
  onClick?: () => void;
}

export function StatCard({ label, value, icon, sub, loading, className, iconClassName, onClick }: StatCardProps) {
  return (
    <Card
      className={cn(
        'border-border/70 shadow-sm transition-shadow',
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
          iconClassName,
        )}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1.5 h-7 w-20" />
          ) : (
            <p className="mt-0.5 truncate font-editorial text-2xl font-semibold leading-tight tabular-nums">{value}</p>
          )}
          {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
