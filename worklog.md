# Worklog — Plateforme Média Business Horizon

Projet : Plateforme média digitale (magazine entrepreneuriat, business & innovation)
Réf. cahier des charges : /home/z/my-project/upload/Pasted Content_1789683428042.txt

## Décisions globales (Task 1 — Lead)

- Stack : Next.js 16 App Router, TypeScript, Tailwind 4, shadcn/ui, Prisma + SQLite, Zustand, framer-motion.
- **Route unique `/`** : toute la plateforme est une SPA rendue par `src/app/page.tsx` avec navigation par hash (`#/`, `#/article/:slug`, `#/category/:slug`, `#/videos`, `#/podcasts`, `#/search?q=`, `#/contact`, `#/page/:slug`, `#/newsletter`, `#/announcers`, `#/favorites`, `#/admin`).
- Backend : uniquement des API routes (`/api/site`, `/api/public/[...path]`, `/api/auth/[...path]`, `/api/admin/[...path]`, `/api/rss`). Admin protégé par Bearer token (HMAC) — voir `/home/z/my-project/API_CONTRACT.md`.
- Schéma Prisma complet déployé (26 modèles conformes section 11 du cahier des charges).
- Types partagés : `src/lib/types.ts` ; client API : `src/lib/api.ts` ; store Zustand : `src/lib/store.ts`.
- Identité visuelle : "Business Horizon" — ambre/or (primary oklch 0.62 0.16 55), zinc, serif éditorial (Georgia) pour les titres, classe `.font-editorial`, `.eyebrow`, `.article-body`, animations (ticker, reveal, shimmer, tilt) dans `globals.css`. Mode sombre supporté.
- Images : servies depuis `/images/*.jpg` (public/images) — générées en Task 3. Les noms de fichiers attendus sont listés dans API_CONTRACT.md.

## Conventions
- Langue : **français** partout (UI, contenu, erreurs).
- Composants shadcn/ui exclusivement (src/components/ui), pas de bleu/indigo.
- Toasts : `sonner` (déjà dans ui/sonner.tsx) ou use-toast.
- Content blocks article : JSON array de ContentBlock (voir types.ts).

---
Task ID: 1
Agent: Lead (Z.ai Code)
Task: Fondations du projet (schéma, types, client API, store, thème, shell SPA)

Work Log:
- Lecture complète du cahier des charges (571 lignes, 22 sections).
- Analyse du projet existant (package.json, layout, globals.css, lib/db).
- Écriture de prisma/schema.prisma (26 modèles) + `bun run db:push` OK.
- Écriture de src/lib/types.ts (contrat de types complet).
- Écriture de src/lib/api.ts (client API typed complet : publicApi, authApi, adminApi).
- Écriture de src/lib/store.ts (zustand : hash router, bootstrap, session admin, thème, favoris).
- Réécriture de globals.css (thème éditorial ambre/zinc + animations + accessibilité prefers-reduced-motion).
- layout.tsx : métadonnées FR Business Horizon.
- page.tsx : shell SPA (FrontOffice vs AdminApp selon la route).

Stage Summary:
- Fondations prêtes : tous les agents peuvent s'appuyer sur types.ts, api.ts, store.ts, globals.css.
- Contrat API détaillé dans API_CONTRACT.md (à lire impérativement).
- À faire par les agents suivants : API backend (2-a), front-office (2-b), back-office (2-c), seed (2-d), images (3), intégration (4).

---
Task ID: 2-d
Agent: Contenu seed
Task: Script de seed idempotent (prisma/seed.ts) + injection d'un contenu éditorial francophone riche et crédible en SQLite

Work Log:
- Lecture de worklog.md, prisma/schema.prisma (déployé, non modifié), API_CONTRACT.md (section Images attendues) et src/lib/types.ts (ContentBlock).
- Écriture de prisma/seed.ts : purge deleteMany dans l'ordre FK (AuditLog, Favorite, AnalyticsEvent, ArticleVersion, ArticleTag, Comment, Article, Category enfants puis parents, Tag, Media, Video, Podcast, StaticPage, MenuItem, NewsletterSubscriber, NewsletterCampaign, AdCampaign, AdPlacement, SiteSetting, FlashInfo), puis recréation complète. AdminUser géré par upsert (idempotent, ids stables).
- Hash scrypt conforme : scryptSync(password, salt(16 bytes → hex), 64).toString('hex'), stocké « salt:hash » — 5 comptes : admin@businesshorizon.fr/admin123 (ADMIN Camille Rousseau), marc.dupont/editeur123 (EDITOR_IN_CHIEF), claire.martin/redacteur123 (WRITER), sophie.leroy/cm123456 (COMMUNITY_MANAGER), karim.benali/pub123456 (AD_MANAGER).
- 17 catégories (8 racines + 9 enfants) avec couleurs, covers du contrat, descriptions FR rédigées ; Événements showInMenu=true mais showInHome=false ; 15 tags.
- 23 articles rédigés intégralement en français journalistique (7-11 blocs ContentBlock variés chacun : paragraphes 3-5 phrases, h2/h3, citations avec auteur, listes 4-6 items, callouts « À retenir », 2 blocs image, 3 blocs video YouTube). 20 PUBLIÉS (dates échelonnées sur 30 jours, views 620-9500, likes=views/12, readingTime 4-12, seoTitle ≤60 / seoDescription ≤160 pour tous) + 2 DRAFT + 1 SCHEDULED (+3 jours). 6 featured (featuredOrder 1-6), 6 trending. 1 ArticleVersion initiale par article.
- 12 médias (chemins exacts du contrat), 6 vidéos (youtubeIds réels, thumbnails i.ytimg.com), 5 podcasts saison 1 (SoundHelix 1-5, covers /images/podcast-{n}.jpg), 5 pages statiques riches (a-propos avec équipe et chiffres, mentions-legales, politique-confidentialite RGPD, cgu, espace-annonceurs avec tarifs).
- Menus : 11 items header (Accueil, 7 catégories racines, Vidéos, Podcasts, Contact) + 18 items footer en 3 colonnes (Rubriques 6, Ressources 4, Légal 5) via parentId.
- Régie pub : 8 AdPlacement (toutes les clés du contrat) + 10 AdCampaign actives (NextBank Pro, CloudSuite, FundMe, EcoDrive Énergie, LegalStart ; images ad-banner-1/2, ad-square-1, ad-native-1 ; dates -5j → +60j ; weight 1-3 ; impressions 1500-45000, CTR 0,4-2,5 % ; utm_campaign par campagne).
- 3 FlashInfo actifs ; 44 SiteSetting (toutes les clés de SiteSettings en STRING + copyrightText, rssEnabled, analyticsEnabled, commentsModeration + clé homeBlocks en JSON — DECISION : les homeBlocks (6 blocs FEATURED/LATEST/CATEGORY×3/MEDIA, slugs cohérents avec les catégories créées) sont stockés dans SiteSetting.key='homeBlocks' car le schéma n'a pas de table dédiée — agent 2-a à implémenter ainsi dans /api/site et /api/admin/homepage).
- 12 commentaires (9 APPROVED dont 2 avec reply rédaction, 3 PENDING) répartis sur 6 articles ; 18 abonnés newsletter (16 actifs, sources popup/footer/article) ; 2 campagnes (1 SENT à 16 destinataires, openRate 0.46, clickRate 0.13, sentAt -7j ; 1 DRAFT).
- 1000 AnalyticsEvent sur 30 jours (680 PAGE_VIEW, 200 ARTICLE_VIEW, 40 SEARCH, 20 NEWSLETTER_SUB, 60 AD_CLICK ; distribution biaisée vers les jours récents, heures 8h-19h, batch createMany de 250) ; 8 AuditLog plausibles.
- Exécution vérifiée 2 fois : succès + idempotence confirmée. Contrôles automatiques en fin de script (résumé + assertions).

Stage Summary:
- Volumes injectés : 5 users, 17 catégories, 15 tags, 23 articles (20 publiés/6 featured/6 trending), 23 versions, 12 commentaires, 12 médias, 6 vidéos, 5 podcasts, 5 pages statiques, 29 items de menu, 8 placements, 10 campagnes pub, 3 flash infos, 44 réglages (dont homeBlocks), 18 abonnés, 2 campagnes newsletter, 1000 événements analytics, 8 logs d'audit.
- Slugs de catégories à réutiliser tels quels : entrepreneuriat, creation-entreprise, financement-levees-fonds, success-stories, business-economie, actualites-economiques, marches-secteurs, management-leadership, ressources-humaines, strategie-entreprise, startups-innovation, tech-digital, intelligence-artificielle, interviews-portraits, dossiers-analyses, tribune-libre, evenements.
- Pour l'agent 2-a (API) : homeBlocks = SiteSetting key 'homeBlocks' (JSON) ; hash scrypt identique au format du seed ; commentaires du seed référencent les slugs d'articles réels.
- Pour l'agent 2-b (front) : images du contrat référencées partout (covers, ad-*, og-default) — à générer en Task 3 ; dégradation propre prévue par le contrat si image manquante.

---
Task ID: 4
Agent: Lead (Z.ai Code)
Task: Finalisation — génération des images manquantes, correction bug CTR, vérification end-to-end complète (front-office + back-office) avec agent-browser

Work Log:
- Audit initial : 7 images manquantes (ad-banner-1/2, ad-square-1, ad-native-1, og-default, podcast-4/5) référencées en DB mais absentes de public/images ; lint 0 erreur ; serveur dev opérationnel.
- Ajout des specs podcast-4/5 dans scripts/generate-images.ts + correction des tailles 1440x720 → 1440x704 (l'API exige des multiples de 32) ; régénération : 28/28 images servies en 200.
- BUG corrigé (section 10.3-n CDC) : CTR publicitaire affiché « 136,0 % » au lieu de ~1,4 % — l'API admin renvoyait déjà un pourcentage (×100) et formatPercent() multipliait à nouveau. Normalisation de l'API en ratio (3 endroits : handleAdStats, overview.adCtr, overview.adStats.ctr → Math.round(x*10000)/10000) ; commentaire types.ts ajouté. Vérifié en DB + UI : dashboard « CTR 1,4 % », régie « CTR global 1,4 % ».
- Vérification agent-browser front-office : accueil (hero slider, flash info défilant, pubs header/sidebar/footer, populaires classés, blocs thématiques), article (fil d'Ariane, blocs riches, citations, tags, box auteur, pub in-article, commentaires), catégorie (bannière, filtres sous-rubriques, tri), vidéos (grille YouTube + modal embed), podcasts (épisodes, lecteur sticky avec vitesse, « Écouter plus tard »), recherche (auto-complétion + page résultats filtrée), contact (formulaire validé + coordonnées dynamiques), mentions légales, favoris, like (651), partage social.
- Interactions testées et persistées en DB : commentaire QA soumis (statut PENDING, modération a priori) puis approuvé via le back-office (toast + compteurs 4→3 / 9→10) ; inscription newsletter via popup (source « popup », coche animée + toast) ; like + favoris.
- Popup newsletter : déclencheur TIME (12 s) respecté après reset sessionStorage ; fréquence via localStorage.
- Back-office vérifié : dashboard (stats, graphique audience, top 5), éditeur d'articles (blocs réordonnables, tags+suggestions, SEO 50/60, À la une/Populaire, aperçu/versions), commentaires (Valider/Rejeter/Répondre), régie pub (8 emplacements CDC §6.1, onglets, stats + graphique), page d'accueil (carrousel 6/6 + flash info + blocs + popup), réglages (6 onglets, couleurs), utilisateurs (5 rôles CDC §16), médiathèque (12 médias), analytics, journal d'audit, menus, pages, catégories.
- Mode sombre validé (front + admin) ; mobile 390 px + émulation iPhone 14 (menu hamburger, slider, pub sticky mobile fixed bottomGap=0, ciblage device UA vérifié via curl mobile) ; footer sticky (mt-auto + min-h-screen flex) ; flux RSS podcast XML valide (iTunes/Atom) ; ciblage device et APIs 200 confirmés (2 000+ lignes de logs sans erreur après le dernier fix ; les erreurs « Parsing ecmascript » du log sont antérieures au correctif ??/|| de NewsletterAdmin.tsx déjà appliqué).

Stage Summary:
- Plateforme conforme au cahier des charges, vérifiée de bout en bout dans le navigateur : tous les parcours critiques passent (publication/modération, pub avec tracking, newsletter, recherche, médias riches, réglages).
- Correctifs de cette phase : 7 images générées, bug CTR ×100 corrigé (API normalisée en ratio), tailles de génération 1440x704.
- Accès démo : admin@businesshorizon.fr / admin123 (5 comptes avec rôles différenciés, voir worklog Task 2-d).
