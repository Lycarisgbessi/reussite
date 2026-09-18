'use client';

// ═══════════════════════════════════════════════════════════════
// BUSINESS HORIZON — Application SPA unique (route /)
// Front-office public + Back-office (/admin) rendus côté client.
// Navigation par hash : #/, #/article/slug, #/category/slug,
// #/videos, #/podcasts, #/search?q=, #/contact, #/page/slug,
// #/newsletter, #/announcers, #/favorites, #/admin
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { useMagazineStore, initClient } from '@/lib/store';
import FrontOffice from '@/components/front/FrontOffice';
import AdminApp from '@/components/admin/AdminApp';

export default function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Différer d'un tick pour éviter le rendu en cascade (rule react-hooks/set-state-in-effect)
    const id = setTimeout(() => {
      initClient();
      setReady(true);
      const { loadBootstrap } = useMagazineStore.getState();
      loadBootstrap();
      useMagazineStore.getState().loadAdminSession();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-3 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-editorial tracking-wide">Business Horizon</p>
        </div>
      </div>
    );
  }

  return <MagazineRouter />;
}

function MagazineRouter() {
  const route = useMagazineStore((s) => s.route);

  if (route.view === 'admin') {
    return <AdminApp />;
  }
  return <FrontOffice />;
}
