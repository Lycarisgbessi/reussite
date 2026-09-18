// One-shot functional test of API handlers (bun direct call, no HTTP server needed)
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { scryptSync, randomBytes } from 'node:crypto';

const db = new PrismaClient();

function hash(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

function req(method: string, url: string, body?: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function cleanup() {
  await db.favorite.deleteMany({ where: { readerKey: 'rk-test' } });
  await db.article.deleteMany({ where: { slug: { contains: 'mon-premier-article-test' } } });
  await db.article.deleteMany({ where: { title: 'Titre Modifié' } });
  await db.video.deleteMany({ where: { title: 'Vidéo Test' } });
  await db.podcast.deleteMany({ where: { title: 'Pod Test' } });
  await db.staticPage.deleteMany({ where: { slug: { startsWith: 'a-propos' } } });
  await db.menuItem.deleteMany({ where: { label: 'Accueil' } });
  await db.newsletterSubscriber.deleteMany({ where: { email: { contains: 'abonne-' } } });
  await db.newsletterCampaign.deleteMany({});
  await db.adCampaign.deleteMany({});
  await db.flashInfo.deleteMany({});
  await db.siteSetting.deleteMany({ where: { key: { in: ['homeBlocks', 'siteName', 'newsletterPopupDelay', 'commentsEnabled'] } } });
  await db.category.deleteMany({ where: { slug: { contains: 'test-cat-' } } });
  await db.category.deleteMany({ where: { slug: 'nouvelle-rubrique' } });
  await db.media.deleteMany({});
  await db.analyticsEvent.deleteMany({});
  await db.auditLog.deleteMany({});
  await db.adminUser.deleteMany({ where: { email: { contains: 'test-api-' } } });
}

async function main() {
  await cleanup();

  // ── setup : catégorie + utilisateur test ──
  const cat = await db.category.create({
    data: { name: 'Test Cat', slug: `test-cat-${Date.now()}`, showInHome: true },
  });
  const user = await db.adminUser.create({
    data: {
      email: `test-api-${Date.now()}@bh.test`,
      name: 'Test API',
      password: hash('password123'),
      role: 'ADMIN',
    },
  });

  // ── AUTH ──
  const { POST: authPost, GET: authGet } = await import(
    '../src/app/api/auth/[...path]/route'
  );
  const loginRes = await authPost(
    req('POST', '/api/auth/login', { email: user.email, password: 'password123' }),
    { params: Promise.resolve({ path: ['login'] }) },
  );
  const login = await loginRes.json();
  console.log('LOGIN', loginRes.status, typeof login.token === 'string' && !('password' in login.user));
  console.log('login.user keys:', Object.keys(login.user).join(','));

  const badLogin = await authPost(
    req('POST', '/api/auth/login', { email: user.email, password: 'wrong' }),
    { params: Promise.resolve({ path: ['login'] }) },
  );
  console.log('BAD LOGIN', badLogin.status, (await badLogin.json()).error);

  const meRes = await authGet(req('GET', '/api/auth/me', undefined, login.token), {
    params: Promise.resolve({ path: ['me'] }),
  });
  console.log('ME', meRes.status, (await meRes.json()).user.name);

  const pwRes = await authPost(
    req('POST', '/api/auth/password', { currentPassword: 'password123', newPassword: 'newpass456' }, login.token),
    { params: Promise.resolve({ path: ['password'] }) },
  );
  console.log('PASSWORD', pwRes.status, await pwRes.json());

  // ── ADMIN articles ──
  const admin = await import('../src/app/api/admin/[...path]/route');
  const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) });
  const T = login.token;

  const createRes = await admin.POST(
    req('POST', '/api/admin/articles', {
      title: 'Mon Premier Article Test',
      subtitle: 'Sous-titre de test',
      content: [
        { id: 'b1', type: 'paragraph', text: 'Bonjour le monde du business.' },
        { id: 'b2', type: 'list', items: ['un', 'deux'] },
      ],
      categoryId: cat.id,
      status: 'PUBLISHED',
      tags: ['Test', 'Business'],
    }, T),
    ctx(['articles']),
  ) as Response;
  const created = await createRes.json();
  console.log('ARTICLE CREATE', createRes.status, created.article?.slug, created.article?.readingTime, created.article?.tags);

  const artId = created.article.id as string;

  const listRes = await admin.GET(req('GET', '/api/admin/articles?page=1', undefined, T), ctx(['articles'])) as Response;
  const list = await listRes.json();
  console.log('ADMIN LIST', listRes.status, list.total, list.items?.[0]?.title, list.items?.[0]?.commentCount);

  const updRes = await admin.PUT(
    req('PUT', `/api/admin/articles/${artId}`, { title: 'Titre Modifié', status: 'PUBLISHED' }, T),
    ctx(['articles', artId]),
  ) as Response;
  console.log('ARTICLE UPDATE', updRes.status, (await updRes.json()).article?.title);

  const verRes = await admin.GET(req('GET', `/api/admin/articles/${artId}/versions`, undefined, T), ctx(['articles', artId, 'versions'])) as Response;
  const vers = await verRes.json();
  console.log('VERSIONS', verRes.status, vers.versions?.length);

  const restoreRes = await admin.POST(
    req('POST', `/api/admin/articles/${artId}/versions`, { versionId: vers.versions[0].id }, T),
    ctx(['articles', artId, 'versions']),
  ) as Response;
  console.log('RESTORE', restoreRes.status, (await restoreRes.json()).article?.title);

  const bulkRes = await admin.POST(
    req('POST', '/api/admin/articles/bulk', { action: 'ARCHIVE', ids: [artId] }, T),
    ctx(['articles', 'bulk']),
  ) as Response;
  console.log('BULK', bulkRes.status, await bulkRes.json());

  // ── PUBLIC ──
  const pub = await import('../src/app/api/public/[...path]/route');

  // republish for public visibility
  await admin.PUT(req('PUT', `/api/admin/articles/${artId}`, { status: 'PUBLISHED' }, T), ctx(['articles', artId]));

  const pubList = await pub.GET(req('GET', '/api/public/articles?limit=5'), ctx(['articles'])) as Response;
  const pl = await pubList.json();
  console.log('PUBLIC LIST', pubList.status, pl.total, pl.articles?.[0]?.title, pl.articles?.[0]?.category?.name);

  const detail = await pub.GET(req('GET', `/api/public/articles/${created.article.slug}`), ctx(['articles', created.article.slug])) as Response;
  const dd = await detail.json();
  console.log('PUBLIC DETAIL', detail.status, dd.article?.content?.length, dd.approvedComments?.length, Array.isArray(dd.related));

  const search = await pub.GET(req('GET', '/api/public/search?q=business'), ctx(['search'])) as Response;
  console.log('SEARCH', search.status, (await search.json()).total);

  const suggest = await pub.GET(req('GET', '/api/public/suggest?q=titre'), ctx(['suggest'])) as Response;
  console.log('SUGGEST', suggest.status, (await suggest.json()).suggestions?.length);

  const commentRes = await pub.POST(
    req('POST', '/api/public/comments', {
      articleId: artId,
      authorName: 'Jean',
      authorEmail: 'jean@test.fr',
      content: 'Super article !',
    }),
    ctx(['comments']),
  ) as Response;
  console.log('COMMENT POST', commentRes.status, await commentRes.json());

  const commentsGet = await pub.GET(req('GET', `/api/public/articles/${artId}/comments`), ctx(['articles', artId, 'comments'])) as Response;
  console.log('COMMENTS GET (approved only)', commentsGet.status, (await commentsGet.json()).comments?.length);

  // approve via admin then re-check
  const cm = await db.comment.findFirst({ where: { articleId: artId } });
  await admin.PUT(req('PUT', `/api/admin/comments/${cm.id}`, { status: 'APPROVED', reply: 'Merci !' }, T), ctx(['comments', cm.id]));
  const commentsGet2 = await pub.GET(req('GET', `/api/public/articles/${artId}/comments`), ctx(['articles', artId, 'comments'])) as Response;
  const approved = (await commentsGet2.json()).comments;
  console.log('COMMENTS APPROVED', approved.length, approved[0]?.reply);

  const like = await pub.POST(req('POST', `/api/public/articles/${artId}/like`), ctx(['articles', artId, 'like'])) as Response;
  console.log('LIKE', like.status, await like.json());

  const fav = await pub.POST(req('POST', '/api/public/favorites', { readerKey: 'rk-test', articleId: artId }), ctx(['favorites'])) as Response;
  console.log('FAV TOGGLE ON', fav.status, await fav.json());
  const favs = await pub.GET(req('GET', '/api/public/favorites?readerKey=rk-test'), ctx(['favorites'])) as Response;
  console.log('FAVS', favs.status, (await favs.json()).articles?.length);

  const nl = await pub.POST(req('POST', '/api/public/newsletter', { email: `abonne-${Date.now()}@test.fr`, name: 'A. Bonné' }), ctx(['newsletter'])) as Response;
  console.log('NEWSLETTER', nl.status, await nl.json());

  const ct = await pub.POST(req('POST', '/api/public/contact', { name: 'A', email: 'a@b.fr', subject: 'S', message: 'M' }), ctx(['contact'])) as Response;
  console.log('CONTACT', ct.status, await ct.json());

  const track = await pub.POST(req('POST', '/api/public/track', { type: 'PAGE_VIEW', path: '/' }), ctx(['track'])) as Response;
  console.log('TRACK', track.status, await track.json());

  // video + podcast
  const vRes = await admin.POST(req('POST', '/api/admin/videos', { title: 'Vidéo Test', youtubeId: 'https://youtu.be/dQw4w9WgXcQ' }, T), ctx(['videos'])) as Response;
  const vv = await vRes.json();
  console.log('VIDEO CREATE', vRes.status, vv.video?.youtubeId, vv.video?.thumbnailUrl);

  const pubVids = await pub.GET(req('GET', '/api/public/videos'), ctx(['videos'])) as Response;
  console.log('PUBLIC VIDEOS', pubVids.status, (await pubVids.json()).items?.length);

  const yt = await admin.GET(req('GET', '/api/admin/youtube?urlOrId=https://youtu.be/dQw4w9WgXcQ', undefined, T), ctx(['youtube'])) as Response;
  const ytMeta = await yt.json();
  console.log('YOUTUBE META', yt.status, ytMeta.thumbnailUrl);

  const pRes = await admin.POST(req('POST', '/api/admin/podcasts', { title: 'Pod Test', audioUrl: '/audio/test.mp3' }, T), ctx(['podcasts'])) as Response;
  const pp = await pRes.json();
  console.log('PODCAST CREATE', pRes.status, pp.podcast?.title);
  const play = await pub.POST(req('POST', `/api/public/podcasts/${pp.podcast.id}/play`), ctx(['podcasts', pp.podcast.id, 'play'])) as Response;
  console.log('PLAY', play.status, await play.json());

  // page + menu
  const pageRes = await admin.POST(req('POST', '/api/admin/pages', { title: 'À propos' }, T), ctx(['pages'])) as Response;
  const page = await pageRes.json();
  console.log('PAGE CREATE', pageRes.status, page.page?.slug);
  const pubPage = await pub.GET(req('GET', `/api/public/pages/${page.page.slug}`), ctx(['pages', page.page.slug])) as Response;
  console.log('PUBLIC PAGE', pubPage.status, (await pubPage.json()).page?.title);

  const menuRes = await admin.POST(req('POST', '/api/admin/menus', { label: 'Accueil', url: '#/' }, T), ctx(['menus'])) as Response;
  console.log('MENU CREATE', menuRes.status, (await menuRes.json()).item?.location);

  // settings + homepage blocks
  const setRes = await admin.PUT(req('PUT', '/api/admin/settings', { siteName: 'BH Test', newsletterPopupDelay: 12, commentsEnabled: false }, T), ctx(['settings'])) as Response;
  const s = await setRes.json();
  console.log('SETTINGS PUT', setRes.status, s.settings?.siteName, s.settings?.newsletterPopupDelay, s.settings?.commentsEnabled);
  const setGet = await admin.GET(req('GET', '/api/admin/settings', undefined, T), ctx(['settings'])) as Response;
  const sg = await setGet.json();
  console.log('SETTINGS GET', setGet.status, typeof sg.settings?.themeColor, Object.keys(sg.settings).length);

  const blocksRes = await admin.PUT(
    req('PUT', '/api/admin/homepage', { blocks: [{ id: 'x1', type: 'LATEST', title: 'Une', categorySlug: '', enabled: true, order: 0 }] }, T),
    ctx(['homepage']),
  ) as Response;
  console.log('HOME BLOCKS PUT', blocksRes.status, (await blocksRes.json()).blocks?.length);

  const featured = await admin.PUT(req('PUT', '/api/admin/homepage/featured', { articleIds: [artId] }, T), ctx(['homepage', 'featured'])) as Response;
  console.log('FEATURED PUT', featured.status, await featured.json());

  const adsPl = await admin.GET(req('GET', '/api/admin/ads/placements', undefined, T), ctx(['ads', 'placements'])) as Response;
  const ads = await adsPl.json();
  console.log('PLACEMENTS', adsPl.status, ads.placements?.length);

  const campRes = await admin.POST(
    req('POST', '/api/admin/ads/campaigns', { name: 'Camp 1', advertiser: 'Ann', placementId: ads.placements[0].id, weight: 2 }, T),
    ctx(['ads', 'campaigns']),
  ) as Response;
  const camp = await campRes.json();
  console.log('AD CAMPAIGN', campRes.status, camp.campaign?.placementKey);

  const pubAd = await pub.GET(req('GET', `/api/public/ads?placement=${ads.placements[0].key}`), ctx(['ads'])) as Response;
  const adBanner = await pubAd.json();
  console.log('PUBLIC AD', pubAd.status, adBanner.banner?.advertiser);

  const adClick = await pub.POST(req('POST', `/api/public/ads/${camp.campaign.id}/click`), ctx(['ads', camp.campaign.id, 'click'])) as Response;
  console.log('AD CLICK', adClick.status, await adClick.json());

  const adStats = await admin.GET(req('GET', '/api/admin/ads/stats', undefined, T), ctx(['ads', 'stats'])) as Response;
  const st = await adStats.json();
  console.log('AD STATS', adStats.status, st.stats?.[0]?.ctr);

  // stats & analytics & audit & export & categories
  const stats = await admin.GET(req('GET', '/api/admin/stats', undefined, T), ctx(['stats'])) as Response;
  const sj = await stats.json();
  console.log('STATS', stats.status, sj.overview?.visits30d !== undefined, sj.chart?.length, sj.topArticles?.length > 0);

  const analytics = await admin.GET(req('GET', '/api/admin/analytics?days=7', undefined, T), ctx(['analytics'])) as Response;
  console.log('ANALYTICS', analytics.status, (await analytics.json()).chart?.length);

  const audit = await admin.GET(req('GET', '/api/admin/audit-logs', undefined, T), ctx(['audit-logs'])) as Response;
  const aj = await audit.json();
  console.log('AUDIT', audit.status, aj.total > 0, aj.items?.[0]?.action);

  const catRes = await admin.POST(req('POST', '/api/admin/categories', { name: 'Nouvelle Rubrique' }, T), ctx(['categories'])) as Response;  const nc = await catRes.json();
  console.log('CATEGORY CREATE', catRes.status, nc.category?.slug);

  const delCat = await admin.DELETE(req('DELETE', `/api/admin/categories/${nc.category.id}`, undefined, T), ctx(['categories', nc.category.id])) as Response;
  console.log('CATEGORY DELETE (no articles)', delCat.status);
  try {
    const delCatBlocked = await admin.DELETE(req('DELETE', `/api/admin/categories/${cat.id}`, undefined, T), ctx(['categories', cat.id])) as Response;
    console.log('CATEGORY DELETE (has articles)', delCatBlocked.status);
  } catch (e) {
    // En appel direct, le HttpError n'est pas intercepté par Next : on vérifie le statut 400.
    console.log('CATEGORY DELETE (has articles → 400)', (e as { status?: number }).status === 400 ? 'OK 400' : 'FAIL');
  }

  const exJ = await admin.GET(req('GET', '/api/admin/export?type=articles&format=json', undefined, T), ctx(['export'])) as Response;
  console.log('EXPORT JSON', exJ.status, typeof (await exJ.json()).data === 'string');
  const exC = await admin.GET(req('GET', '/api/admin/export?type=subscribers&format=csv', undefined, T), ctx(['export'])) as Response;
  const csvData = (await exC.json()).data as string;
  console.log('EXPORT CSV', exC.status, csvData.startsWith('\ufeff'), csvData.split('\n')[0]);

  const usersRes = await admin.GET(req('GET', '/api/admin/users', undefined, T), ctx(['users'])) as Response;
  const uj = await usersRes.json();
  console.log('USERS', usersRes.status, uj.users?.length, !('password' in uj.users[0]));

  // unauth check
  const unauth = await admin.GET(req('GET', '/api/admin/stats'), ctx(['stats'])) as Response;
  console.log('UNAUTH 401', unauth.status);

  // ── RSS direct ──
  const rss = await import('../src/app/api/rss/route');
  const rssRes = await rss.GET(req('GET', '/api/rss'));
  const rssText = await rssRes.text();
  console.log('RSS', rssRes.status, rssRes.headers.get('content-type'), rssText.includes('enclosure'));

  // ── cleanup ──
  await cleanup();
  console.log('CLEANUP OK');
}

main()
  .catch((e) => {
    console.error('TEST FAILURE:', e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
