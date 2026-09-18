'use client';

// ═══════════════════════════════════════════════════════════════
// HELPERS PARTAGÉS — Back-office Réussite Magazine
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import type { AdminRole, ArticleStatus, ContentBlock } from '@/lib/types';

// ─── Rôles en français ─────────────────────────────────────────
export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: 'Administrateur',
  EDITOR_IN_CHIEF: 'Éditeur en chef',
  WRITER: 'Rédacteur',
  COMMUNITY_MANAGER: 'Community Manager',
  AD_MANAGER: 'Régie publicitaire',
};

// ─── Statuts d'article ─────────────────────────────────────────
export const STATUS_META: Record<ArticleStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-zinc-200/70 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-200 border-zinc-300/60 dark:border-zinc-600' },
  REVIEW: { label: 'En relecture', className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900' },
  SCHEDULED: { label: 'Planifié', className: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-900' },
  PUBLISHED: { label: 'Publié', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900' },
  ARCHIVED: { label: 'Archivé', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900' },
};

// ─── Dates ─────────────────────────────────────────────────────
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function formatDate(iso?: string | null, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (withTime ? dateTimeFmt : dateFmt).format(d);
}

/** Convertit une date ISO en valeur pour <input type="datetime-local"> */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Nombres ───────────────────────────────────────────────────
const numFmt = new Intl.NumberFormat('fr-FR');
export function formatNumber(n?: number | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '0';
  return numFmt.format(n);
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits).replace('.', ',')} %`;
}

// ─── Slug ──────────────────────────────────────────────────────
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── YouTube ───────────────────────────────────────────────────
/** Extrait l'ID YouTube d'un lien (watch?v=, youtu.be/, embed/, shorts/) ou renvoie l'entrée si déjà un ID. */
export function extractYouTubeId(input: string): string {
  const s = input.trim();
  if (!s) return '';
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,})/i,
    /(?:youtu\.be\/)([\w-]{6,})/i,
    /(?:youtube\.com\/embed\/)([\w-]{6,})/i,
    /(?:youtube\.com\/shorts\/)([\w-]{6,})/i,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{6,20}$/.test(s)) return s;
  return '';
}

export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

// ─── Google Drive → lien audio direct ──────────────────────────
export function parseDriveAudioLink(url: string): string {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{10,})/);
  if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
  return url;
}

// ─── Initiales avatar ──────────────────────────────────────────
export function initials(name: string): string {
  const res = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return res || '?';
}

// ─── Comptage de mots (temps de lecture) ───────────────────────
export function countBlockWords(blocks: ContentBlock[]): number {
  let words = 0;
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph': words += b.text.split(/\s+/).filter(Boolean).length; break;
      case 'heading': words += b.text.split(/\s+/).filter(Boolean).length; break;
      case 'quote': words += `${b.text} ${b.author ?? ''}`.split(/\s+/).filter(Boolean).length; break;
      case 'callout': words += `${b.text} ${b.title ?? ''}`.split(/\s+/).filter(Boolean).length; break;
      case 'list': words += b.items.join(' ').split(/\s+/).filter(Boolean).length; break;
      case 'image': words += (b.caption ?? '').split(/\s+/).filter(Boolean).length; break;
      case 'video': words += (b.title ?? '').split(/\s+/).filter(Boolean).length; break;
      default: break;
    }
  }
  return words;
}

// ─── Téléchargement de fichier (export CSV/JSON) ───────────────
export function downloadExport(filename: string, data: string, format: 'json' | 'csv') {
  const blob = new Blob([format === 'csv' ? `\uFEFF${data}` : data], {
    type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Copier dans le presse-papiers ─────────────────────────────
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Détection d'erreur d'authentification (token expiré) ──────
export function isAuthError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /401|non autoris|unauthorized|expir/i.test(msg);
}

// ─── Debounce simple (hook) ────────────────────────────────────
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
