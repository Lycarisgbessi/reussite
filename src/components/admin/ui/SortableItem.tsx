'use client';

// ═══════════════════════════════════════════════════════════════
// SORTABLE ITEM — ligne réordonnable @dnd-kit avec poignée
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function SortableItem({ id, children, className }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1',
        isDragging && 'z-20 opacity-80 shadow-lg ring-1 ring-primary/40 rounded-lg',
        className,
      )}
      {...attributes}
      {...listeners}
    >
      <span
        className="shrink-0 rounded p-1 text-muted-foreground/60 hover:bg-accent hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-hidden="true"
      >
        <GripVertical className="h-4 w-4" />
      </span>
      {children}
    </div>
  );
}
