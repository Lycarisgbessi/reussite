// ═══════════════════════════════════════════════════════════════
// GET /article/:slug — PAGE DE PARTAGE pour les réseaux sociaux.
// Le site est une SPA routée par hash (#/article/…) : Facebook,
// WhatsApp, X etc. ne lisent PAS le fragment et n'exécutent pas le
// JS. Cette route réelle sert donc aux crawlers des balises OG
// complètes (image de couverture + description de l'article), puis
// redirige instantanément les visiteurs humains vers la SPA.
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { contentToText } from '@/lib/server/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlPage(opts: {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
  siteName: string;
  redirectTo: string;
  type?: string;
}): string {
  const { title, description, imageUrl, url, siteName, redirectTo, type = 'article' } = opts;
  const t = escapeHtml(title);
  const d = escapeHtml(description).slice(0, 300);
  const img = escapeHtml(imageUrl);
  const u = escapeHtml(url);
  const sn = escapeHtml(siteName);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${u}" />
<meta property="og:type" content="${type}" />
<meta property="og:site_name" content="${sn}" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:width" content="1200" />
<meta property="og:url" content="${u}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
<meta http-equiv="refresh" content="0;url=${redirectTo}" />
</head>
<body>
<p>Redirection vers ${sn}…</p>
<script>location.replace(${JSON.stringify(redirectTo)});</script>
<noscript><a href="${redirectTo}">Ouvrir l'article sur ${sn}</a></noscript>
</body>
</html>`;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const origin = req.nextUrl.origin;
  const siteName = 'Réussite Magazine';

  const article = await db.article.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: { category: { select: { name: true } } },
  }).catch(() => null);

  if (!article) {
    return new Response(
      htmlPage({
        title: `${siteName} — Trimestriel des décideurs africains`,
        description: 'Entrepreneuriat, business, management et innovation : articles, dossiers, interviews, vidéos et podcasts.',
        imageUrl: `${origin}/images/og-site.jpg`,
        url: `${origin}/`,
        siteName,
        redirectTo: `${origin}/#/`,
        type: 'website',
      }),
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  // Description : SEO dédié → chapeau → sous-titre → début du contenu
  const description =
    article.seoDescription ||
    article.excerpt ||
    article.subtitle ||
    contentToText(article.content).slice(0, 280);

  const cover = article.coverImage?.startsWith('http')
    ? article.coverImage
    : `${origin}${article.coverImage || '/images/og-site.jpg'}`;

  return new Response(
    htmlPage({
      title: `${article.title} — ${siteName}`,
      description: description.replace(/\s+/g, ' ').trim(),
      imageUrl: cover,
      url: `${origin}/article/${article.slug}`,
      siteName,
      redirectTo: `${origin}/#/article/${article.slug}`,
    }),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
