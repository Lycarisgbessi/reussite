// ═══════════════════════════════════════════════════════════════
// GET /api/rss — Flux RSS XML des podcasts (20 derniers épisodes)
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handleRouteError, loadSettings } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(req: NextRequest) {
  try {
    const [settings, podcasts] = await Promise.all([
      loadSettings(),
      db.podcast.findMany({
        where: { published: true },
        orderBy: { publishedAt: 'desc' },
        take: 20,
      }),
    ]);

    const origin = req.nextUrl.origin;
    const siteLink = `${origin}/#/podcasts`;

    const items = podcasts
      .map((p) => {
        const title = xmlEscape(p.title);
        const link = xmlEscape(`${siteLink}#ep-${p.id}`);
        const description = xmlEscape(p.description || p.title);
        const pubDate = p.publishedAt.toUTCString();
        const guid = xmlEscape(p.id);
        const cover = p.coverImage ? xmlEscape(new URL(p.coverImage, origin).toString()) : '';
        const rawAudio = /drive\.google\.com|docs\.google\.com/i.test(p.audioUrl)
          ? `${origin}/api/audio-proxy?url=${encodeURIComponent(p.audioUrl)}`
          : p.audioUrl;
        const audioUrl = rawAudio ? xmlEscape(new URL(rawAudio, origin).toString()) : '';
        const itunesDuration = p.duration ? xmlEscape(p.duration) : '';
        return [
          '    <item>',
          `      <title>${title}</title>`,
          `      <link>${link}</link>`,
          `      <guid isPermaLink="false">${guid}</guid>`,
          `      <pubDate>${pubDate}</pubDate>`,
          `      <description>${description}</description>`,
          cover ? `      <itunes:image href="${cover}" />` : '',
          itunesDuration ? `      <itunes:duration>${itunesDuration}</itunes:duration>` : '',
          audioUrl
            ? `      <enclosure url="${audioUrl}" length="0" type="audio/mpeg" />`
            : '',
          '    </item>',
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(`${settings.siteName} — Podcast`)}</title>
    <link>${xmlEscape(siteLink)}</link>
    <description>${xmlEscape(settings.tagline || 'Podcasts Réussite Magazine')}</description>
    <language>fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEscape(`${origin}/api/rss`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
