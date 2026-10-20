# Audit front-end — Réussite Magazine (Phase 0)

Date : 2026-10-08 · Périmètre : interface publique + cohérence tableau de bord → front.

## A. Problèmes majeurs (corrigés dans les phases 1→9)

| # | Constat | Fichiers | Correctif (phase) |
|---|---------|----------|-------------------|
| A1 | **Aucune internationalisation** : tout est en dur en français, `<html lang="fr">` figé, dates `date-fns` locale `fr` forcée, pas de RTL pour l'arabe | tout `src/components/front/**`, `helpers.ts`, `layout.tsx` | Phase 1 |
| A2 | **Pas de mise en forme riche** dans l'éditeur : les paragraphes sont rendus en texte brut (`whitespace-pre-line`), impossible de mettre en gras/italique/liens | `ArticleEditor.tsx`, `BlocksRenderer.tsx` | Phase 2 |
| A3 | **Médiathèque URL uniquement** : aucun import de fichier, aucun pipeline d'upload | `MediaAdmin.tsx`, `MediaPicker.tsx` | Phase 3 |
| A4 | **Vidéos en popup uniquement** : pas d'URL dédiée par vidéo (non partageable, pas de SEO), `parseHash` renvoie silencieusement à l'accueil pour toute vue inconnue (`#/video/x`) | `VideosPage.tsx`, `store.ts` | Phase 4 |
| A5 | **Lecteur podcast non persistant** : l'état (`useState`/`useRef` locaux) meurt avec la vue lors de la navigation → la lecture s'arrête dès qu'on quitte la page | `PodcastsPage.tsx:27-32` | Phase 5 |
| A6 | **Audio Google Drive non fiable** : conversion naïve en `uc?export=download` (bloquée par redirections/CORS selon les fichiers), aucune remontée d'erreur au lecteur | `PodcastsAdmin` (`parseDriveAudioLink`) | Phase 5 |
| A7 | **Podcasts à plat** : « Saison N · Épisode M » affiché mais aucune hiérarchie navigable, titres de saisons non personnalisables | `PodcastsPage.tsx`, `PodcastsAdmin.tsx` | Phase 5 |
| A8 | **Flash info peut être vide** : si aucun message actif, le bandeau disparaît totalement ; aucune alimentation automatique par les publications | `FlashInfoBar.tsx:22` | Phase 6 |
| A9 | **Pubs limitées** : mode image (statique) ou HTML brut uniquement ; pas de mode GIF/vidéo explicite ; `StickyMobileAd` ignore les campagnes HTML (incohérence) ; `dangerouslySetInnerHTML` sur `htmlCode` = surface XSS si compte admin compromis | `AdSlot.tsx:149,111` | Phase 7 |
| A10 | **Pas de PWA** : aucun manifest, service worker, prompt d'installation ni notification push | `public/`, `layout.tsx` | Phase 8 |

## B. Bugs et manquements relevés (interface)

1. **Incohérence Menus admin ↔ Header** : le tableau de bord gère des `MenuItem` (header/footer), mais le menu du Header est construit **uniquement depuis les catégories** (`showInMenu`). Modifier/supprimer un élément de menu "header" dans le dashboard **n'a aucun effet** sur la navigation principale. `Header.tsx:58`.
2. **`metadataBase: http://localhost:3000`** dans `layout.tsx` → mauvaises URL Open Graph en production.
3. **SEO SPA** : une seule page réelle (`/`) → un seul titre/description pour tous les articles ; les titres ne changent jamais lors de la navigation (corrigé en phase 1/9 via `document.title` dynamique par vue).
4. **Liste des playlists vidéos incomplète** : construite côté client en accumulant les résultats de la page courante uniquement (`VideosPage.tsx:50-52`) → les filtres dépendent de la pagination.
5. **Vitesse de lecture podcast limitée** : bascule uniquement 1× ↔ 1,5×, pas de choix 2×, pas de mémorisation.
6. **Aucune gestion d'erreur audio** : si l'URL Drive échoue, le lecteur reste muet sans message ; événement `onError` non écouté (`PodcastsPage.tsx:297-307`).
7. **Date du Header figée** : calculée une fois au montage (`useState`), devient fausse après minuit en session longue (mineur).
8. **Pas d'Error Boundary** : une erreur de rendu dans une vue fait tomber toute la SPA (écran blanc).
9. **`InterstitialAd` compte l'impression à l'ouverture** mais `StickyMobileAd` ne compte **aucune impression** (seulement les clics) → stats sous-estimées ; de même `AdSlot` n'incrémente pas d'impression côté front (dépend de l'API `ad()` — à vérifier côté serveur, l'appel `ad()` semble tracer).
10. **Accessibilité** : liens « Pro » vers l'admin avec `opacity-50` (contraste faible) ; `aria-label` en dur en français (résolu par l'i18n).
11. **`formatViews`** : `replace(',0','')` peut tronquer à tort (ex. « 10,03 k » → « 10,03 k » ok, mais « 1,01 » reste ; cas « 20,0 k » → « 20 k » correct) — comportement globalement OK, garder sous surveillance.
12. **Favoris** : si l'appel `favorites` échoue, silence total (acceptable) ; `toggleFavoriteLocal` optimiste sans rollback si l'API échoue (à verrouiller).
13. **`.env` avec identifiants Neon réels** présent dans le dossier de travail — vérifier qu'il est bien ignoré par git (`.gitignore`), ne jamais le committer.
14. **`next.config.ts`** : `ignoreBuildErrors: true` et `ignoreDuringBuilds` (ESLint) → les erreurs de type passent inaperçues en build (risque régressions).

## C. Cohérence tableau de bord → interface (vérifications)

| Élément dashboard | Répercussion front | Statut |
|---|---|---|
| Articles (publier, à la une, tendance) | Oui (bootstrap + API) | ✅ |
| Catégories (menu/accueil) | Oui (Header, CategoryBlocks) | ✅ |
| **Menus (header)** | **Non consommés par le Header** | ❌ → B1 |
| Menus (footer) | Consommés par le Footer | ✅ (à confirmer au test navigateur) |
| Flash info | Oui, mais vide si aucun item actif | ⚠️ A8 |
| Blocs page d'accueil / À la une | Oui | ✅ |
| Médiathèque | Oui (URL) — pas d'upload | ⚠️ A3 |
| Vidéos (publié, playlist) | Oui | ✅ (playlist incomplète B4) |
| Podcasts (saison/épisode) | Oui mais à plat | ⚠️ A7 |
| Régie pub (emplacements, campagnes) | Oui, flags settings respectés | ⚠️ A9/B9 |
| Pages statiques, commentaires, newsletter, réglages | Oui | ✅ |

## D. Conclusion

Le socle est sain (SPA hash-routée propre, Zustand, composants bien structurés), mais les 10 points majeurs (A1–A10) et les incohérences B1/B4/B9 dégradent l'expérience. Tout est traité dans les phases 1 → 9 du plan.
