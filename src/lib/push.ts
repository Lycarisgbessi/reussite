'use client';

// ═══════════════════════════════════════════════════════════════
// PUSH CLIENT — abonnement Web Push (VAPID) + SW.
// ═══════════════════════════════════════════════════════════════

/** Convertit la clé VAPID base64 → Uint8Array pour pushManager. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // Vérification périodique des mises à jour du SW (nouvelle version
    // déployée) — sw.js fait skipWaiting + clients.claim au remplacement.
    if (typeof setInterval === 'function') {
      setInterval(() => {
        void reg.update().catch(() => {});
      }, 60 * 60 * 1000);
    }
    return reg;
  } catch {
    return null;
  }
}

export async function isPushEnabled(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

/** Demande la permission et abonne l'utilisateur. throws si refus/erreur. */
export async function subscribeToPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Notifications non supportées par ce navigateur.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Autorisation de notification refusée.');

  const keyRes = await fetch('/api/push');
  const { publicKey, configured } = (await keyRes.json()) as { publicKey: string; configured: boolean };
  if (!configured || !publicKey) throw new Error('Notifications non configurées sur le serveur.');

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    }));
  const json = sub.toJSON();
  await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys as { p256dh: string; auth: string },
    }),
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unsubscribe', endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
}
