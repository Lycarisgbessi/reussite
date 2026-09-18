// ═══════════════════════════════════════════════════════════════
// HELPERS FRONT-OFFICE — dates FR, initiales, contraste, formats
// ═══════════════════════════════════════════════════════════════
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Convertit une valeur en Date de manière sûre (null si invalide). */
export function safeDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  try {
    const d = typeof value === 'string' ? parseISO(value) : value;
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Date longue en français : « 12 septembre 2026 ». */
export function formatFrDate(
  value: string | Date | null | undefined,
  pattern = 'd MMMM yyyy',
): string {
  const d = safeDate(value);
  return d ? format(d, pattern, { locale: fr }) : '';
}

/** Date relative en français : « il y a 3 jours ». */
export function frRelative(value: string | Date | null | undefined): string {
  const d = safeDate(value);
  return d ? formatDistanceToNow(d, { locale: fr, addSuffix: true }) : '';
}

/** Initiales d'un nom (2 lettres max). */
export function initials(name: string): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Choix du texte (noir/blanc) selon la luminance d'une couleur hex. */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
  if (!m) return '#ffffff';
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#1c1917' : '#ffffff';
}

/** Nombre de vues formaté : 12 450 → « 12,4 k ». */
export function formatViews(views: number): string {
  if (!Number.isFinite(views)) return '0';
  if (views >= 1000) {
    const k = views / 1000;
    return `${k.toFixed(1).replace('.', ',').replace(',0', '')} k`;
  }
  return String(views);
}

/** Secondes → « 3:42 ». */
export function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Validation d'email simple. */
export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((email || '').trim());
}
