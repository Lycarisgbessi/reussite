'use client';

// ═══════════════════════════════════════════════════════════════
// ADMIN SHELL — Sidebar sombre groupée + topbar + menu utilisateur
// + navigation mobile (Sheet) + compteurs temps réel (commentaires
// en attente). Les entrées sont filtrées selon le rôle (CDC §16).
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi, authApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { roleAllowed } from '../AdminApp';
import { ROLE_LABELS, isAuthError } from '../ui/helpers';
import { cn } from '@/lib/utils';
import type { AdminRole } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Field } from '../ui/Field';
import {
  LayoutDashboard, BarChart3, FileText, FolderTree, FileStack, Images,
  MonitorPlay, Mic, Home, ListTree, MessageSquare, Mail, Megaphone,
  Users, Settings, ScrollText, Mountain, ExternalLink, Sun, Moon,
  LogOut, KeyRound, Menu, Loader2, Newspaper,
} from 'lucide-react';

// ─── Navigation (groupes, icônes, sections) ────────────────────
interface NavItem { key: string; label: string; icon: React.ElementType; badge?: 'commentsPending' | 'drafts' }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Pilotage',
    items: [
      { key: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
      { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Contenu',
    items: [
      { key: 'articles', label: 'Articles', icon: FileText, badge: 'drafts' },
      { key: 'categories', label: 'Catégories', icon: FolderTree },
      { key: 'pages', label: 'Pages', icon: FileStack },
      { key: 'media', label: 'Médias', icon: Images },
    ],
  },
  {
    label: 'Médias riches',
    items: [
      { key: 'videos', label: 'Vidéos', icon: MonitorPlay },
      { key: 'podcasts', label: 'Podcasts', icon: Mic },
    ],
  },
  {
    label: 'Accueil & navigation',
    items: [
      { key: 'homepage', label: 'Page d’accueil', icon: Home },
      { key: 'menus', label: 'Menus', icon: ListTree },
    ],
  },
  {
    label: 'Audience',
    items: [
      { key: 'comments', label: 'Commentaires', icon: MessageSquare, badge: 'commentsPending' },
      { key: 'newsletter', label: 'Newsletter', icon: Mail },
    ],
  },
  {
    label: 'Publicité',
    items: [{ key: 'ads', label: 'Régie publicitaire', icon: Megaphone }],
  },
  {
    label: 'Système',
    items: [
      { key: 'users', label: 'Utilisateurs', icon: Users },
      { key: 'settings', label: 'Réglages', icon: Settings },
      { key: 'audit', label: 'Journal d’audit', icon: ScrollText },
    ],
  },
];

// ─── Contexte des compteurs de la sidebar ──────────────────────
export interface AdminNavContextValue {
  pendingComments: number;
  draftArticles: number;
  refreshBadges: () => void;
}
export const AdminNavContext = React.createContext<AdminNavContextValue>({
  pendingComments: 0,
  draftArticles: 0,
  refreshBadges: () => {},
});

// ─── Contenu de la navigation (réutilisé desktop + Sheet) ──────
function NavContent({ section, role, badges, onNavigate }: {
  section: string;
  role: AdminRole;
  badges: AdminNavContextValue;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto custom-scrollbar px-3 py-4" aria-label="Navigation admin">
      {NAV_GROUPS.map((group) => {
        const visible = group.items.filter((it) => roleAllowed(role, it.key));
        if (visible.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {visible.map((item) => {
                const Icon = item.icon;
                const active = section === item.key || (item.key === 'articles' && section === 'editor');
                const badgeValue = item.badge === 'commentsPending'
                  ? badges.pendingComments
                  : item.badge === 'drafts'
                    ? badges.draftArticles
                    : 0;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => { navigate(`#/admin/${item.key}`); onNavigate?.(); }}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                        'text-zinc-300 hover:bg-white/10 hover:text-white',
                        active && 'bg-primary/90 text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary-foreground' : 'text-zinc-400 group-hover:text-zinc-200')} aria-hidden="true" />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {badgeValue > 0 ? (
                        <span
                          className={cn(
                            'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none',
                            active ? 'bg-primary-foreground/25 text-primary-foreground' : 'bg-primary text-primary-foreground',
                          )}
                        >
                          {badgeValue > 99 ? '99+' : badgeValue}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

// ─── Logo ──────────────────────────────────────────────────────
function SidebarLogo() {
  return (
    <div className="flex items-center gap-2.5 px-4 pt-5 pb-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/30">
        <Mountain className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="leading-tight">
        <p className="font-editorial text-[15px] font-bold text-white">Business Horizon</p>
        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">CMS v1.0</p>
      </div>
    </div>
  );
}

// ─── Dialog changement de mot de passe ─────────────────────────
function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) { setCurrent(''); setNext(''); setConfirm(''); setError(null); }
  }, [open]);

  const submit = async () => {
    setError(null);
    if (!current || !next) { setError('Renseignez votre mot de passe actuel et le nouveau.'); return; }
    if (next.length < 6) { setError('Le nouveau mot de passe doit contenir au moins 6 caractères.'); return; }
    if (next !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    try {
      await authApi.changePassword(current, next);
      toast({ title: 'Mot de passe modifié', description: 'Votre nouveau mot de passe est actif.' });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Modification impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-editorial">Changer de mot de passe</DialogTitle>
          <DialogDescription>Choisissez un mot de passe solide, d’au moins 6 caractères.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive" role="alert">{error}</p> : null}
          <Field label="Mot de passe actuel" required>
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field label="Nouveau mot de passe" required>
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirmer le nouveau mot de passe" required>
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shell principal ───────────────────────────────────────────
export function AdminShell({ section, title, children }: {
  section: string;
  title: string;
  children: React.ReactNode;
}) {
  const adminUser = useMagazineStore((s) => s.adminUser);
  const theme = useMagazineStore((s) => s.theme);
  const toggleTheme = useMagazineStore((s) => s.toggleTheme);
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);
  const { toast } = useToast();

  const [pendingComments, setPendingComments] = React.useState(0);
  const [draftArticles, setDraftArticles] = React.useState(0);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [pwdOpen, setPwdOpen] = React.useState(false);

  const refreshBadges = React.useCallback(async () => {
    try {
      const stats = await adminApi.stats();
      setPendingComments(stats.overview.commentsPending);
      setDraftArticles(stats.overview.articlesDraft);
    } catch (e) {
      if (isAuthError(e)) {
        clearAdminSession();
        navigate('/');
        toast({ variant: 'destructive', title: 'Session expirée', description: 'Merci de vous reconnecter.' });
      }
      // Silence sinon (les compteurs sont non critiques)
    }
  }, [clearAdminSession, toast]);

  React.useEffect(() => { refreshBadges(); }, [refreshBadges]);

  const badgesValue = React.useMemo(
    () => ({ pendingComments, draftArticles, refreshBadges }),
    [pendingComments, draftArticles, refreshBadges],
  );

  const handleLogout = () => {
    clearAdminSession();
    navigate('/');
    toast({ title: 'Déconnecté', description: 'À bientôt sur Business Horizon !' });
  };

  if (!adminUser) return null;
  const role = adminUser.role;

  return (
    <AdminNavContext.Provider value={badgesValue}>
      <div className="flex min-h-screen bg-muted/40">
        {/* ─── Sidebar desktop ─── */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-zinc-900 lg:flex dark:bg-zinc-950 dark:border-r dark:border-zinc-800">
          <SidebarLogo />
          <NavContent section={section} role={role} badges={badgesValue} />
          <div className="border-t border-zinc-800 px-4 py-3">
            <p className="text-[11px] text-zinc-500">Business Horizon CMS v1.0</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">© {new Date().getFullYear()} — Tous droits réservés</p>
          </div>
        </aside>

        {/* ─── Zone principale ─── */}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          {/* Topbar */}
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="flex h-14 items-center gap-2 px-4 md:px-6">
              {/* Burger mobile */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <Button
                  variant="ghost" size="icon" className="lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Ouvrir le menu de navigation"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <SheetContent side="left" className="w-72 gap-0 bg-zinc-900 p-0 text-zinc-100 dark:bg-zinc-950 [&>button]:text-zinc-400">
                  <SheetHeader className="p-0">
                    <SheetTitle className="sr-only">Navigation admin</SheetTitle>
                    <SidebarLogo />
                  </SheetHeader>
                  <NavContent
                    section={section} role={role} badges={badgesValue}
                    onNavigate={() => setMobileOpen(false)}
                  />
                  <div className="border-t border-zinc-800 px-4 py-3">
                    <p className="text-[11px] text-zinc-500">Business Horizon CMS v1.0</p>
                  </div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <h1 className="truncate font-editorial text-lg font-semibold md:text-xl">{title}</h1>
              </div>

              {/* Actions droite */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline" size="sm" className="hidden gap-1.5 sm:inline-flex"
                  onClick={() => navigate('/')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Voir le site
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                >
                  {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="ml-1 flex items-center gap-2 rounded-full p-1 pr-2.5 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                      aria-label="Menu utilisateur"
                    >
                      <Avatar className="h-8 w-8 border border-border">
                        <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                          {adminUser.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden min-w-0 flex-col items-start leading-tight md:flex">
                        <span className="max-w-32 truncate text-xs font-semibold">{adminUser.name}</span>
                        <span className="max-w-32 truncate text-[10px] text-muted-foreground">{ROLE_LABELS[role]}</span>
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <p className="text-sm font-semibold">{adminUser.name}</p>
                      <p className="truncate text-xs font-normal text-muted-foreground">{adminUser.email}</p>
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <Newspaper className="h-3 w-3" /> {ROLE_LABELS[role]}
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setPwdOpen(true)}>
                      <KeyRound className="h-4 w-4" /> Changer le mot de passe
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/')}>
                      <ExternalLink className="h-4 w-4" /> Voir le site
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="h-4 w-4" /> Se déconnecter
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Contenu */}
          <main className="flex-1 px-4 py-5 md:px-6 md:py-7 lg:px-8" id="admin-main">
            {children}
          </main>

          {/* Pied de page admin (stick au bas via flex) */}
          <footer className="mt-auto border-t border-border/60 px-4 py-3 text-center text-[11px] text-muted-foreground md:px-6">
            Business Horizon CMS v1.0 — Espace d’administration
          </footer>
        </div>

        <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
      </div>
    </AdminNavContext.Provider>
  );
}
