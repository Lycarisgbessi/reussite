// ═══════════════════════════════════════════════════════════════
// GET /api/audio-proxy?url=… — proxy de streaming audio.
// Résout les redirections (Google Drive, etc.), transmet les
// en-têtes Range (seek) et force le bon Content-Type. Limité aux
// hôtes autorisés (drive.google.com, googleusercontent.com, dropbox
// et tout https direct référencé par la rédaction).
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_HOSTS = [
  'drive.google.com',
  'docs.google.com',
  'drive.usercontent.google.com',
  'googleusercontent.com',
  'dl.dropboxusercontent.com',
  'www.dropbox.com',
  'cdn.freesound.org',
  'sndicast.com',
  'storage.googleapis.com',
];

function hostAllowed(host: string): boolean {
  return ALLOWED_HOSTS.some(
    (h) => host === h || host.endsWith(`.${h}`) || host.endsWith(h),
  );
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url');
  if (!raw) return new Response('Paramètre url manquant', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response('URL invalide', { status: 400 });
  }
  if (target.protocol !== 'https:') return new Response('HTTPS requis', { status: 400 });

  // Google Drive : conversion robuste de toutes les variantes de lien
  // vers l'URL de téléchargement direct.
  if (hostAllowed(target.host) && /drive\.google\.com|docs\.google\.com/.test(target.host)) {
    let id = target.searchParams.get('id');
    if (!id) {
      const m =
        /\/file\/d\/([a-zA-Z0-9_-]{10,})/.exec(target.pathname) ||
        /\/d\/([a-zA-Z0-9_-]{10,})/.exec(target.pathname);
      if (m) id = m[1];
    }
    if (!id) return new Response('Lien Google Drive invalide (ID introuvable)', { status: 400 });
    target = new URL(`https://drive.google.com/uc?export=download&id=${id}`);
  } else if (!hostAllowed(target.host)) {
    return new Response('Hôte non autorisé', { status: 403 });
  }

  const range = req.headers.get('range');
  const upstreamHeaders: Record<string, string> = {
    // User-Agent standard : Drive renvoie sinon une page HTML.
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    Accept: '*/*',
  };
  if (range) upstreamHeaders['Range'] = range;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const upstream = await fetch(target.toString(), {
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    const contentType = upstream.headers.get('content-type') ?? '';
    // Drive renvoie du HTML (page de confirmation / virus-scan) : on
    // remplace par le lien de confirmation quand il est présent.
    if (contentType.includes('text/html')) {
      const body = await upstream.text();
      const confirmAction = /action="([^"]+)"/.exec(body)?.[1];
      const confirmToken =
        /name="confirm"\s+value="([^"]+)"/.exec(body)?.[1] ??
        /name="uuid"\s+value="([^"]+)"/.exec(body)?.[1];
      if (confirmAction) {
        const confirmUrl = new URL(confirmAction, 'https://drive.google.com');
        if (confirmToken) confirmUrl.searchParams.set('confirm', confirmToken);
        confirmUrl.searchParams.set('export', 'download');
        const retry = await fetch(confirmUrl.toString(), {
          headers: { ...upstreamHeaders, ...(range ? { Range: range } : {}) },
          redirect: 'follow',
        });
        if (retry.ok || retry.status === 206) {
          return new Response(retry.body, {
            status: retry.status,
            headers: filterHeaders(retry.headers),
          });
        }
      }
      return new Response(
        "Le fichier Google Drive n'est pas public ou est trop volumineux pour être diffusé. Ouvrez le partage « Tout le monde avec le lien ».",
        { status: 502 },
      );
    }

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`Source inaccessible (${upstream.status})`, { status: 502 });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: filterHeaders(upstream.headers),
    });
  } catch {
    return new Response('Flux audio inaccessible', { status: 504 });
  }
}

function filterHeaders(h: Headers): Headers {
  const out = new Headers();
  for (const key of [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'etag',
    'last-modified',
  ]) {
    const v = h.get(key);
    if (v) out.set(key, v);
  }
  if (!out.get('content-type')) out.set('content-type', 'audio/mpeg');
  out.set('Cache-Control', 'public, max-age=3600');
  out.set('Access-Control-Allow-Origin', '*');
  return out;
}
