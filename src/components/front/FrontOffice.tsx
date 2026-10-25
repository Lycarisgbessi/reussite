'use client';

// ═══════════════════════════════════════════════════════════════
// FRONT OFFICE — layout global du site public :
// Header · FlashInfoBar · pub header · vue courante (fade) ·
// pub footer · Footer · SearchOverlay · NewsletterPopup ·
// CookieBanner · ScrollToTop · StickyMobileAd · InterstitialAd.
// Routeur de vues piloté par useMagazineStore (hash routing).
// ═══════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { publicApi } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from './Header';
import { Footer } from './Footer';
import { FlashInfoBar } from './FlashInfoBar';
import { SearchOverlay } from './SearchOverlay';
import { NewsletterPopup } from './NewsletterPopup';
import { CookieBanner } from './CookieBanner';
import { ScrollToTop } from './ScrollToTop';
import { MagazineTeaserCorner } from './announcers/MagazineTeaserCorner';
import { InstallBanner } from './InstallBanner';
import { ChatWidget } from './ChatWidget';
import { AdSlot, InterstitialAd, SidePeekAd, StickyMobileAd } from './ads/AdSlot';
import { HomeSkeleton } from './mag/Skeletons';
import { HomePage } from './home/HomePage';
import { ArticlePage } from './article/ArticlePage';
import { CategoryPage } from './category/CategoryPage';
import { VideosPage } from './videos/VideosPage';
import { VideoPage } from './videos/VideoPage';
import { PodcastsPage } from './podcasts/PodcastsPage';
import { GlobalPodcastPlayer } from './podcasts/GlobalPodcastPlayer';
import { SearchPage } from './search/SearchPage';
import { ContactPage } from './contact/ContactPage';
import { StaticPageView } from './static/StaticPageView';
import { NewsletterPage } from './newsletter/NewsletterPage';
import { FavoritesPage } from './favorites/FavoritesPage';
import { AnnouncersPage } from './announcers/AnnouncersPage';
import { ShopPage } from './shop/ShopPage';

export default function FrontOffice() {
  const route = useMagazineStore((s) => s.route);
  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const bootstrapLoading = useMagazineStore((s) => s.bootstrapLoading);
  const loadBootstrap = useMagazineStore((s) => s.loadBootstrap);
  const readerKey = useMagazineStore((s) => s.readerKey);
  const setFavorites = useMagazineStore((s) => s.setFavorites);
  const { t } = useI18n();

  // Remonte en haut de page à chaque navigation
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.view, route.param, route.query]);

  // Charge les favoris du lecteur au montage
  useEffect(() => {
    if (!readerKey) return;
    publicApi
      .favorites(readerKey)
      .then((res) => setFavorites(res.articles.map((a) => a.id)))
      .catch(() => {});
  }, [readerKey, setFavorites]);

  // ── État bootstrap : chargement / erreur ─────────────────────
  if (bootstrapLoading || !bootstrap) {
    if (bootstrapLoading) {
      return (
        <div className="flex min-h-screen flex-col bg-background">
          <HomeSkeleton />
        </div>
      );
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
        <p className="font-editorial text-2xl font-bold">{t('loadError')}</p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('loadErrorDesc')}</p>
        <Button className="mt-6 rounded-full px-8" onClick={() => loadBootstrap()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  // ── Rendu de la vue courante ─────────────────────────────────
  const renderView = () => {
    switch (route.view) {
      case 'article':
        return route.param ? <ArticlePage slug={route.param} /> : <HomePage />;
      case 'category':
        return route.param ? <CategoryPage slug={route.param} /> : <HomePage />;
      case 'videos':
        return <VideosPage />;
      case 'video':
        return route.param ? <VideoPage id={route.param} /> : <VideosPage />;
      case 'podcasts':
        return <PodcastsPage />;
      case 'search':
        return <SearchPage query={route.query.q || ''} />;
      case 'contact':
        return <ContactPage />;
      case 'page':
        return route.param ? <StaticPageView slug={route.param} /> : <HomePage />;
      case 'newsletter':
        return <NewsletterPage />;
      case 'announcers':
        return <AnnouncersPage />;
      case 'favorites':
        return <FavoritesPage />;
      case 'shop':
        return <ShopPage focusIssueId={route.query.numero || undefined} />;
      case 'home':
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background text-foreground">
      <Header />
      <FlashInfoBar />

      {/* Bannière publicitaire compacte sous le menu (CDC §6.1) */}
      <div className="mx-auto w-full max-w-3xl px-4 pt-3">
        <AdSlot placement="HEADER_BANNER" />
      </div>

      <main className="flex-1" id="main-content">
        <ErrorBoundary key={`${route.view}-${route.param}`} label={`view:${route.view}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${route.view}-${route.param}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
      </main>

      {/* Bannière publicitaire compacte avant le pied de page (CDC §6.1) */}
      <div className="mx-auto w-full max-w-3xl px-4 pb-6 pt-2">
        <AdSlot placement="FOOTER_BANNER" />
      </div>

      <Footer />

      {/* Overlays et éléments flottants */}
      <GlobalPodcastPlayer />
      <InstallBanner />
      <ChatWidget />
      <SearchOverlay />
      <NewsletterPopup />
      <CookieBanner />
      <ScrollToTop />
      <MagazineTeaserCorner />
      <SidePeekAd />
      <StickyMobileAd />
      <InterstitialAd />
    </div>
  );
}
