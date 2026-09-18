# Task 2-d — Agent Contenu (seed)

## Résumé
Création de `prisma/seed.ts` (exécution : `cd /home/z/my-project && bun run prisma/seed.ts`), idempotent (purge deleteMany dans l'ordre FK puis recréation), injectant tout le contenu éditorial francophone du magazine Business Horizon.

## Décisions structurantes
1. **homeBlocks** : le schéma Prisma n'a pas de table dédiée → stockés dans `SiteSetting` sous la clé `homeBlocks` (valeur = JSON.stringify des 6 blocs). Les agents 2-a (API `/api/site`, `/api/admin/homepage`) et 2-b (accueil) doivent lire cette clé.
2. **AdminUser** : upsert par email (ids stables entre deux runs) ; hash `scryptSync(password, salt, 64)` avec salt = randomBytes(16).toString('hex'), stocké `salt:hash` — l'API auth (2-a) doit réutiliser exactement ce format.
3. **ArticleVersion** : 1 version initiale par article (savedBy = nom de l'auteur) pour peupler l'historique du back-office.
4. **NewsletterCampaign.articleIds** : liste d'IDs réels d'articles séparés par des virgules.
5. Clés SiteSetting complémentaires ajoutées pour atteindre 44 clés : `copyrightText`, `rssEnabled`, `analyticsEnabled`, `commentsModeration` (+ `homeBlocks`).

## Volumes finaux (vérifiés par le script lui-même)
- 5 AdminUser · 17 Category (8 racines + 9 enfants) · 15 Tag
- 23 Article : 20 PUBLISHED (6 featured order 1-6, 6 trending), 2 DRAFT, 1 SCHEDULED (+3 j) · 23 ArticleVersion
- 12 Comment (9 APPROVED, 3 PENDING, 2 replies) · 12 Media · 6 Video · 5 Podcast
- 5 StaticPage · 29 MenuItem (header 11, footer 18 en 3 colonnes) · 3 FlashInfo
- 8 AdPlacement · 10 AdCampaign · 44 SiteSetting · 18 NewsletterSubscriber · 2 NewsletterCampaign
- 1000 AnalyticsEvent · 8 AuditLog

## Slugs catégories (17)
entrepreneuriat, creation-entreprise, financement-levees-fonds, success-stories, business-economie, actualites-economiques, marches-secteurs, management-leadership, ressources-humaines, strategie-entreprise, startups-innovation, tech-digital, intelligence-artificielle, interviews-portraits, dossiers-analyses, tribune-libre, evenements

## Qualité éditoriale
- Tous les articles rédigés en français journalistique (pas de lorem ipsum) : 7-11 blocs ContentBlock variés, paragraphes 3-5 phrases, citations signées, listes, callouts « À retenir », 2 blocs image (contrat d'images), 3 blocs video YouTube.
- seoTitle ≤ 60 caractères et seoDescription ≤ 160 caractères vérifiés pour les 23 articles ; views 620-9500 ; likes = round(views/12) ; readingTime 4-12 ; dates publiées échelonnées sur 30 jours.
