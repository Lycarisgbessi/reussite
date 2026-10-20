// ═══════════════════════════════════════════════════════════════
// /api/push — Web Push public :
//   GET  /api/push/key        → clé publique VAPID (applicationServerKey)
//   POST /api/push/subscribe  → enregistre un abonnement
//   POST /api/push/unsubscribe→ supprime un abonnement
// L'envoi des notifications est réservé au back-office
// (/api/admin/push/send + automatique à la publication).
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handleRouteError, HttpError, ok, readBody } from '@/lib/server/utils';
import { pushConfigured } from '@/lib/server/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    if (sp.get('action') === 'key' || req.nextUrl.pathname === '/api/push/key') {
      return ok({ publicKey: process.env.VAPID_PUBLIC_KEY ?? '', configured: pushConfigured() });
    }
    return ok({ publicKey: process.env.VAPID_PUBLIC_KEY ?? '', configured: pushConfigured() });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody<{ action?: string; endpoint?: string; keys?: { p256dh?: string; auth?: string } }>(req);
    const endpoint = String(body.endpoint ?? '');
    if (!endpoint || !/^https:\/\//.test(endpoint)) {
      throw new HttpError(400, 'Endpoint de notification invalide.');
    }

    if (body.action === 'unsubscribe') {
      await db.pushSubscription.deleteMany({ where: { endpoint } });
      return ok({ ok: true });
    }

    const p256dh = String(body.keys?.p256dh ?? '');
    const auth = String(body.keys?.auth ?? '');
    if (!p256dh || !auth) throw new HttpError(400, 'Clés de notification manquantes.');
    if (!pushConfigured()) {
      throw new HttpError(503, 'Notifications non configurées (clés VAPID manquantes).');
    }

    await db.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth },
      create: { endpoint, p256dh, auth },
    });
    return ok({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
