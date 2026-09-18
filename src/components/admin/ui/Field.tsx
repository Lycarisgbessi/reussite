'use client';

// ═══════════════════════════════════════════════════════════════
// FIELD — Libellé + champ + infobulle d'aide + message d'erreur
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Compteur affiché à droite du libellé (ex : "42/60") */
  counter?: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, required, className, children, counter }: FieldProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('space-y-1.5', className)}>
        <div className="flex items-center gap-1.5">
          <Label htmlFor={htmlFor} className="text-[13px] font-medium">
            {label}
            {required ? <span className="ml-0.5 text-destructive">*</span> : null}
          </Label>
          {counter ? <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">{counter}</span> : null}
          {hint ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Aide : ${label}`}
                  className="text-muted-foreground/70 transition-colors hover:text-foreground"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-56 text-xs">
                {hint}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        {children}
        {error ? (
          <p className="text-xs font-medium text-destructive" role="alert">{error}</p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
