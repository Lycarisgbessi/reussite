# CONTRAT API — Business Horizon

Base : toutes les routes commencent par `/api`. Réponses JSON. Erreur = `{ error: string }` avec code HTTP 4xx/5xx.
Auth admin : en-tête `Authorization: Bearer <token>` (token HMAC retourné par `/api/auth/login`).
Le client API typé **existant** dans `src/lib/api.ts` fait foi : les endpoints ci-dessous doivent l'implémenter EXACTEMENT.

## Endpoints publics

### GET /api/site
Bootstrap : renvoie `{ settings, menus: { header: MenuItem[], footer: MenuItem[] }, categories (triées par order, avec children imbriqués + articleCount), flashInfos (actives, ordre asc), homeBlocks (triés par order), popup (NewsletterPopupConfig dérivée des settings) }`.

### GET /api/public/homepage
`{ featured (articles PUBLISHED featured=true, max 6, tri featuredOrder), latest (12 derniers), popular (6 triés par views 7j, fallback trending), categoryBlocks (pour chaque catégorie showInHome=true : { category, articles: 4 derniers }), latestVideos (4), latestPodcasts (4), partners (bannières NATIVE actives, max 6 → AdBanner) }`

### GET /api/public/articles?category=&tag=&search=&page=&limit=&sort=RECENT|POPULAR|AZ&exclude=
`{ articles: ArticleSummary[], total, page, totalPages }` — uniquement status=PUBLISHED et (publishedAt null ou <= now). Pagination (limit défaut 12).

### GET /api/public/articles/:slug
Incrémente `views` (fire & forget). Renvoie `{ article: ArticleFull (avec authorFull, tags), related: 4 articles même catégorie, approvedComments: PublicComment[] (status APPROVED, plus récents d'abord) }`. 404 si non trouvé/non publié.

### POST /api/public/articles/:id/like → `{ likes }`

### GET /api/public/articles/:articleId/comments → `{ comments: PublicComment[] }` (APPROVED)

### POST /api/public/comments { articleId, authorName, authorEmail, content } → `{ ok, pending: true }` (status PENDING)

### GET /api/public/videos?playlist=&page=&limit= → `{ items: VideoItem[], total, page, totalPages }` (published=true, tri publishedAt desc)

### GET /api/public/podcasts?page=&limit= → idem podcasts (published=true)
### POST /api/public/podcasts/:id/play → incrément plays → `{ ok }`

### GET /api/public/pages/:slug → `{ page: StaticPageItem }` (published=true, 404 sinon)

### GET /api/public/search?q=&category=&type= → `{ articles: ArticleSummary[], videos: VideoItem[], podcasts: PodcastItem[], pages: {slug,title}[], total }` (recherche LIKE sur titre/sous-titre/contenu/tags ; pages : titre+contenu)
### GET /api/public/suggest?q= → `{ suggestions: [{ slug, title, type: 'ARTICLE'|'VIDEO'|'PODCAST' }] }` max 8 (autocomplétion)

### POST /api/public/newsletter { email, name?, interests?, source? } → `{ ok, message }` (upsert ; si déjà abonné actif → message "déjà inscrit")
### POST /api/public/contact { name, email, subject, message } → `{ ok, message }` (enregistre un AnalyticsEvent type CONTACT + log; pas d'envoi réel)

### GET /api/public/ads?placement=KEY&category=slug
Sélectionne une campagne ACTIVE de l'emplacement (dates valides, ciblage device ignoré côté serveur ou via header user-agent, ciblage catégorie si renseigné), pondérée par `weight` (rotation). **Incrémente impressions**. Renvoie `{ banner: { id, imageUrl, htmlCode, targetUrl, advertiser } | null }`.

### POST /api/public/ads/:campaignId/click → incrément clicks → `{ ok }`

### POST /api/public/track { type, path, meta? } → enregistre AnalyticsEvent (types : PAGE_VIEW, ARTICLE_VIEW, SEARCH, NEWSLETTER_SUB, CONTACT, AD_CLICK) → `{ ok }`

### GET /api/public/favorites?readerKey= → `{ articles: ArticleSummary[] }`
### POST /api/public/favorites { readerKey, articleId } → toggle → `{ favorited: boolean }`

## Auth

### POST /api/auth/login { email, password } → 200 `{ token, user: AdminUser }` | 401 `{ error: "Identifiants invalides" }`
- Vérifier user actif ; hash scrypt avec sel (format `salt:hash` hex) via node:crypto.
- Token = HMAC-SHA256 signé de `userId.expireAt` avec secret env ou fallback fixe, format `<payloadBase64>.<sig>`.

### GET /api/auth/me (auth) → `{ user: AdminUser }`
### POST /api/auth/password (auth) { currentPassword, newPassword } → `{ ok }`

## Admin (toutes protégées par Bearer ; 401 si absent/invalide)

### GET /api/admin/stats → `{ overview: DashboardStats, chart: AnalyticsPoint[] (30j), topArticles (8 par vues), adStats: AdStatRow[], trafficSources (par event type) }`
### GET /api/admin/analytics?days=30 → idem stats avec fenêtre paramétrable
### GET /api/admin/audit-logs?page= → paginé `{ items, total, page, totalPages }` (desc)

### GET /api/admin/articles?page=&limit=&status=&search=&categoryId=&authorId=
Paginé, tous statuts, tri updatedAt desc, include category/author/tags + commentCount.
### GET /api/admin/articles/:id → `{ article: ArticleFull }`
### POST /api/admin/articles (payload ArticlePayload) → crée + ArticleVersion initiale + audit. Génère slug si absent (slugify du titre + unicité). Si status=PUBLISHED et publishedAt absent → now.
### PUT /api/admin/articles/:id → update + crée ArticleVersion (snapshot AVANT modification) + audit. Si status passe à PUBLISHED sans publishedAt → now.
### DELETE /api/admin/articles/:id → soft delete (status=ARCHIVED) + audit. Réponse `{ ok }`.
### POST /api/admin/articles/bulk { action: PUBLISH|ARCHIVE|DELETE, ids[] } → `{ ok }`
### GET /api/admin/articles/:id/versions → `{ versions[] }` (desc)
### POST /api/admin/articles/:id/versions { versionId } → restaure → `{ article }`

### GET /api/admin/categories → toutes (avec articleCount), arborescence plate triée (order asc)
### POST /api/admin/categories | PUT /api/admin/categories/:id | DELETE /api/admin/categories/:id (refuser si articles liés → 400 `{ error }`)
### POST /api/admin/categories/reorder { ids[] } → applique order=index

### GET /api/admin/tags → `{ tags: string[] }`

### GET /api/admin/media?search=&page= | POST /api/admin/media | PUT /api/admin/media/:id | DELETE /api/admin/media/:id

### GET /api/admin/videos?page=&published=&search= | POST /api/admin/videos | PUT /api/admin/videos/:id | DELETE /api/admin/videos/:id
### GET /api/admin/youtube?urlOrId= → extrait l'ID (formats youtu.be/, watch?v=, embed/, id brut) → tente oEmbed YouTube (noembed) sinon titre="" → `{ title, thumbnailUrl: https://i.ytimg.com/vi/<id>/hqdefault.jpg, duration: "" }` (ne JAMAIS échouer en 500 : renvoyer les métadonnées minimales).

### GET /api/admin/podcasts?page=&search= | POST | PUT /:id | DELETE /:id

### GET /api/admin/pages | GET /api/admin/pages/:id | POST | PUT /:id | DELETE /:id

### GET /api/admin/menus → `{ items }` (location, order)
### POST /api/admin/menus | PUT /:id | DELETE /:id | POST /api/admin/menus/reorder { ids[] }

### GET /api/admin/comments?status=&page= → include articleTitle/articleSlug | PUT /api/admin/comments/:id { status?, reply? } | DELETE /:id

### GET /api/admin/newsletter/subscribers?page=&search=&active= | PUT /:id { active } | DELETE /:id
### GET /api/admin/newsletter/campaigns | POST | PUT /:id | DELETE /:id
### POST /api/admin/newsletter/campaigns/:id/send → marque SENT, sentAt=now, recipients = nb abonnés actifs, openRate/clickRate simulés (0.42±, 0.12±) + audit.

### GET /api/admin/ads/placements | PUT /api/admin/ads/placements/:id { label?, format?, active? }
### GET /api/admin/ads/campaigns?placementId=&active= | POST /api/admin/ads/campaigns | PUT /:id | DELETE /:id
### GET /api/admin/ads/stats → lignes par campagne avec CTR

### GET /api/admin/flash-info | POST | PUT /:id | DELETE /:id

### GET /api/admin/homepage → `{ blocks }` | PUT /api/admin/homepage { blocks[] } (remplace, conserve ids)
### PUT /api/admin/homepage/featured { articleIds[] } → met featured=true + featuredOrder=index sur la liste, false sur les autres.

### GET /api/admin/settings → `{ settings }` (objet complet avec défauts) | PUT /api/admin/settings (merge partiel → `{ settings }`)

### GET /api/admin/users → sans password ; POST (hash password) | PUT /:id | DELETE /:id (refuser suppression dernier ADMIN ; empêcher retrait de son propre rôle ADMIN si dernier)
### GET /api/admin/export?type=articles|subscribers|comments&format=json|csv → `{ data: string }` (contenu JSON.stringify ou CSV texte)

### GET /api/rss → flux RSS podcast XML (Content-Type application/rss+xml, 20 derniers épisodes)

## Règles communes
- SQLite via `import { db } from '@/lib/db'`. Champs Json → String (JSON.parse/stringify) : content des articles = JSON array ContentBlock.
- Audit : helper `logAudit(userId, userName, action, details)` sur toute écriture admin.
- Rate limiting simple : map en mémoire (IP+route → timestamps, max 20/min) sur login, comments, newsletter, contact, track.
- Validation basique des payloads (zod ou manuel) ; messages d'erreur en français.
- Dates en ISO. Les réponses doivent correspondre EXACTEMENT aux types de `src/lib/types.ts`.
- CORS inutile (même origine). Cache : aucun (revalidation instantanée exigée par le CDC).

## Images attendues (Task 3) — chemins exacts à référencer dans le seed
`/images/cover-entrepreneuriat-1.jpg`, `/images/cover-entrepreneuriat-2.jpg`, `/images/cover-financement-1.jpg`, `/images/cover-success-1.jpg`, `/images/cover-business-1.jpg`, `/images/cover-business-2.jpg`, `/images/cover-management-1.jpg`, `/images/cover-management-2.jpg`, `/images/cover-startups-1.jpg`, `/images/cover-startups-2.jpg`, `/images/cover-ia-1.jpg`, `/images/cover-ia-2.jpg`, `/images/cover-interview-1.jpg`, `/images/cover-interview-2.jpg`, `/images/cover-dossier-1.jpg`, `/images/cover-dossier-2.jpg`, `/images/cover-tribune-1.jpg`, `/images/cover-evenement-1.jpg`, `/images/podcast-1.jpg`, `/images/podcast-2.jpg`, `/images/podcast-3.jpg`, `/images/ad-banner-1.jpg` (paysage large), `/images/ad-banner-2.jpg`, `/images/ad-square-1.jpg` (carré), `/images/ad-native-1.jpg`, `/images/og-default.jpg`
Catégorie bannières réutilisent les covers. En cas d'image manquante, l'UI doit dégrader proprement (fallback gradient + initiales).
