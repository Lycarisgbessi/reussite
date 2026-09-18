// ═══════════════════════════════════════════════════════════════
// AUTHENTIFICATION BACK-OFFICE — Réussite Magazine
// Mots de passe scrypt (salt:hash hex), tokens HMAC-SHA256,
// gardes Bearer + journal d'audit.
// ═══════════════════════════════════════════════════════════════
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';
import { HttpError, serializeUser } from '@/lib/server/utils';
import type { AdminUser } from '@/lib/types';

const AUTH_SECRET = process.env.AUTH_SECRET || 'bh-secret-dev-2026';
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// ─── Mots de passe (scrypt) ───────────────────────────────────
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const expected = Buffer.from(hash, 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ─── Tokens HMAC (payload base64url « userId.expireAt ») ──────
export function signToken(userId: string): string {
  const expireAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(`${userId}.${expireAt}`, 'utf8').toString('base64url');
  const signature = createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/** Renvoie le userId si le token est valide et non expiré, sinon null. */
export function verifyToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  try {
    const expected = createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const sep = decoded.lastIndexOf('.');
    if (sep <= 0) return null;
    const userId = decoded.slice(0, sep);
    const expireAt = Number(decoded.slice(sep + 1));
    if (!userId || !Number.isFinite(expireAt) || Date.now() > expireAt) return null;
    return userId;
  } catch {
    return null;
  }
}

// ─── Gardes Bearer ────────────────────────────────────────────
/** Renvoie l'utilisateur admin authentifié, ou null (jamais de password exposé). */
export async function getAuthUser(req: Request): Promise<AdminUser | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  const userId = verifyToken(header.slice(7).trim());
  if (!userId) return null;
  const row = await db.adminUser.findUnique({ where: { id: userId } });
  if (!row || !row.active) return null;
  return serializeUser(row);
}

/**
 * Exige une session admin valide.
 * Renvoie l'utilisateur ou lève HttpError(401) — à intercepter via handleRouteError.
 */
export async function requireAuth(req: Request): Promise<AdminUser> {
  const user = await getAuthUser(req);
  if (!user) throw new HttpError(401, 'Non authentifié. Veuillez vous reconnecter.');
  return user;
}

// ─── Journal d'audit (fire & forget) ──────────────────────────
export function logAudit(userId: string, userName: string, action: string, details = ''): void {
  void db.auditLog
    .create({
      data: { userId, userName, action, details: details.slice(0, 500) },
    })
    .catch(() => {});
}
