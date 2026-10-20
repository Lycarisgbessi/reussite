// ═══════════════════════════════════════════════════════════════
// ROUTEUR AUTH — /api/auth/*
// POST /login (rate limité) · GET /me · POST /password
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  clientLimitKey, handleRouteError, HttpError, jsonError, ok, rateLimit, readBody,
  requireFields, serializeUser,
} from '@/lib/server/utils';
import { hashPassword, logAudit, requireAuth, signToken, verifyPassword } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path = [] } = await ctx.params;
    const [root] = path;

    // POST /api/auth/login
    if (root === 'login') {
      if (!rateLimit(clientLimitKey(req, 'login'), 20)) {
        return jsonError(429, 'Trop de tentatives, réessayez dans une minute.');
      }
      const body = await readBody<Record<string, unknown>>(req);
      const missing = requireFields(body, ['email', 'password']);
      if (missing) throw new HttpError(400, missing);

      const email = String(body.email).trim().toLowerCase();
      const password = String(body.password);
      const user = await db.adminUser.findUnique({ where: { email } });
      if (!user || !verifyPassword(password, user.password) || !user.active) {
        return jsonError(401, 'Identifiants invalides');
      }

      return ok({ token: signToken(user.id), user: serializeUser(user) });
    }

    // POST /api/auth/password
    if (root === 'password') {
      const auth = await requireAuth(req);
      const body = await readBody<Record<string, unknown>>(req);
      const missing = requireFields(body, ['currentPassword', 'newPassword']);
      if (missing) throw new HttpError(400, missing);
      const newPassword = String(body.newPassword);
      if (newPassword.length < 6) {
        throw new HttpError(400, 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
      }

      const row = await db.adminUser.findUnique({ where: { id: auth.id } });
      if (!row) throw new HttpError(401, 'Session invalide. Veuillez vous reconnecter.');
      if (!verifyPassword(String(body.currentPassword), row.password)) {
        throw new HttpError(400, 'Mot de passe actuel incorrect.');
      }
      await db.adminUser.update({ where: { id: row.id }, data: { password: hashPassword(newPassword) } });
      logAudit(row.id, row.name, 'PASSWORD_CHANGE', 'Modification du mot de passe');
      return ok({ ok: true });
    }

    return jsonError(404, 'Ressource introuvable.');
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const { path = [] } = await ctx.params;
    const [root] = path;

    // GET /api/auth/me
    if (root === 'me') {
      const auth = await requireAuth(req);
      const row = await db.adminUser.findUnique({
        where: { id: auth.id },
        include: { _count: { select: { articles: true } } },
      });
      if (!row) throw new HttpError(401, 'Session invalide. Veuillez vous reconnecter.');
      return ok({ user: serializeUser(row) });
    }

    return jsonError(404, 'Ressource introuvable.');
  } catch (err) {
    return handleRouteError(err);
  }
}
