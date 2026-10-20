// ═══════════════════════════════════════════════════════════════
// WEB PUSH SERVEUR — envoi VAPID à tous les abonnés.
// Variables : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
// Génération : bunx web-push generate-vapid-keys
// ═══════════════════════════════════════════════════════════════
import webpush from 'web-push';
import { db } from '@/lib/db';

export function pushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure(): boolean {
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:contact@reussitemagazine.com',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Diffuse une notification à tous les abonnés. Les abonnements
 * obsolètes (410) sont purgés. Ne lance jamais d'exception.
 */
export async function broadcastPush(payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!configure()) return { sent: 0, removed: 0 };
  const subs = await db.pushSubscription.findMany();
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...payload, url: payload.url || '/' }),
          { TTL: 24 * 3600, urgency: 'normal' },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
          removed += 1;
        }
      }
    }),
  );
  return { sent, removed };
}
