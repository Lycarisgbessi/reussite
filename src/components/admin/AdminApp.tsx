'use client';

// ═══════════════════════════════════════════════════════════════
// ADMIN APP — Porte d'entrée du back-office
// Gate de session + routeur interne (#/admin/<section>) + garde
// par rôle (matrice section 16 du cahier des charges).
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore } from '@/lib/store';
import { Login } from './Login';
import { AdminShell } from './layout/AdminShell';
import { Overview } from './sections/Overview';
import { ArticlesList } from './sections/ArticlesList';
import { ArticleEditor } from './sections/ArticleEditor';
import { CategoriesAdmin } from './sections/CategoriesAdmin';
import { MediaAdmin } from './sections/MediaAdmin';
import { VideosAdmin } from './sections/VideosAdmin';
import { MagazineAdmin } from './sections/MagazineAdmin';
import { PodcastsAdmin } from './sections/PodcastsAdmin';
import { HomepageAdmin } from './sections/HomepageAdmin';
import { AdsAdmin } from './sections/AdsAdmin';
import { NewsletterAdmin } from './sections/NewsletterAdmin';
import { CommentsAdmin } from './sections/CommentsAdmin';
import { PagesAdmin } from './sections/PagesAdmin';
import { MenusAdmin } from './sections/MenusAdmin';
import { UsersAdmin } from './sections/UsersAdmin';
import { SettingsAdmin } from './sections/SettingsAdmin';
import { AnalyticsAdmin } from './sections/AnalyticsAdmin';
import { AuditLogsAdmin } from './sections/AuditLogsAdmin';
import type { AdminRole } from '@/lib/types';
import { ShieldAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// ─── Matrice des rôles (section 16 CDC) ────────────────────────
const ROLE_SECTIONS: Record<AdminRole, string[]> = {
  ADMIN: ['*'],
  EDITOR_IN_CHIEF: [
    'overview', 'analytics', 'articles', 'editor', 'categories', 'pages',
    'media', 'videos', 'podcasts', 'homepage', 'menus', 'comments',
  ],
  WRITER: ['overview', 'articles', 'editor', 'media'],
  COMMUNITY_MANAGER: ['overview', 'comments', 'newsletter', 'analytics'],
  AD_MANAGER: ['overview', 'ads', 'analytics'],
};

export function roleAllowed(role: AdminRole | undefined, section: string): boolean {
  if (!role) return false;
  const allowed = ROLE_SECTIONS[role];
  if (!allowed) return false;
  return allowed.includes('*') || allowed.includes(section);
}

/** Titre français de chaque section (affiché dans la barre supérieure). */
export const SECTION_TITLES: Record<string, string> = {
  overview: 'Tableau de bord',
  analytics: 'Analytics',
  articles: 'Articles',
  editor: 'Éditeur d’article',
  categories: 'Catégories',
  pages: 'Pages statiques',
  media: 'Médiathèque',
  videos: 'Vidéos',
  podcasts: 'Podcasts',
  homepage: 'Page d’accueil',
  menus: 'Menus de navigation',
  comments: 'Commentaires',
  newsletter: 'Newsletter',
  ads: 'Régie publicitaire',
  users: 'Utilisateurs',
  settings: 'Réglages du site',
  audit: 'Journal d’audit',
};

export default function AdminApp() {
  const adminUser = useMagazineStore((s) => s.adminUser);
  const route = useMagazineStore((s) => s.route);
  const loadAdminSession = useMagazineStore((s) => s.loadAdminSession);

  // Restauration de session (token localStorage) sans flash d'écran de login.
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadAdminSession();
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, [loadAdminSession]);

  // ─── Écran de vérification de session ─────────────────────────
  if (checking && !adminUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary border-t-transparent" aria-hidden="true" />
          <p className="font-editorial text-sm text-muted-foreground">Chargement de l’espace admin…</p>
        </div>
      </div>
    );
  }

  // ─── Non connecté → Login ─────────────────────────────────────
  if (!adminUser) {
    return <Login />;
  }

  // ─── Résolution de la section depuis la route (#/admin/<…>) ───
  const [sectionKey, ...rest] = (route.param || 'overview').split('/');
  const section = sectionKey || 'overview';
  const sectionId = rest.join('/') || undefined;
  const allowed = roleAllowed(adminUser.role, section);

  const renderSection = () => {
    if (!allowed) {
      return (
        <Card className="mx-auto max-w-lg mt-10 border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive/70" aria-hidden="true" />
            <h2 className="font-editorial text-lg font-semibold">Accès restreint</h2>
            <p className="text-sm text-muted-foreground">
              Votre rôle ne permet pas d’accéder à cette section. Contactez un administrateur si vous pensez qu’il s’agit d’une erreur.
            </p>
          </CardContent>
        </Card>
      );
    }
    switch (section) {
      case 'overview': return <Overview />;
      case 'analytics': return <AnalyticsAdmin />;
      case 'articles': return <ArticlesList />;
      case 'editor': return <ArticleEditor articleId={sectionId} />;
      case 'categories': return <CategoriesAdmin />;
      case 'pages': return <PagesAdmin />;
      case 'media': return <MediaAdmin />;
      case 'videos': return <VideosAdmin />;
      case 'magazine': return <MagazineAdmin />;
      case 'podcasts': return <PodcastsAdmin />;
      case 'homepage': return <HomepageAdmin />;
      case 'menus': return <MenusAdmin />;
      case 'comments': return <CommentsAdmin />;
      case 'newsletter': return <NewsletterAdmin />;
      case 'ads': return <AdsAdmin />;
      case 'users': return <UsersAdmin />;
      case 'settings': return <SettingsAdmin />;
      case 'audit': return <AuditLogsAdmin />;
      default: return <Overview />;
    }
  };

  return (
    <AdminShell section={section} title={SECTION_TITLES[section] ?? 'Administration'}>
      {renderSection()}
    </AdminShell>
  );
}
