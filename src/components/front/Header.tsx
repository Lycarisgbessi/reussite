'use client';

// ═══════════════════════════════════════════════════════════════
// HEADER — sticky : topbar (date FR, réseaux, annonceurs, thème, pro),
// logo, recherche, bouton S'abonner, menu catégories + sous-menus,
// menu mobile en Sheet latéral avec accordéon.
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  ChevronDown,
  Facebook,
  Linkedin,
  Menu,
  Moon,
  Search,
  Sun,
  Twitter,
  Youtube,
} from 'lucide-react';
import { navigate, useMagazineStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { formatFrDate } from './mag/helpers';
import { cn } from '@/lib/utils';

export function Header() {
  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const theme = useMagazineStore((s) => s.theme);
  const toggleTheme = useMagazineStore((s) => s.toggleTheme);
  const setSearchOpen = useMagazineStore((s) => s.setSearchOpen);
  const mobileMenuOpen = useMagazineStore((s) => s.mobileMenuOpen);
  const setMobileMenuOpen = useMagazineStore((s) => s.setMobileMenuOpen);

  const settings = bootstrap?.settings;
  // Le composant n'est rendu qu'après hydratation (page.tsx attend « ready »)
  const [today] = useState(() => {
    if (typeof window === 'undefined') return '';
    const d = formatFrDate(new Date(), 'EEEE d MMMM yyyy');
    return d.charAt(0).toUpperCase() + d.slice(1);
  });

  const roots = (bootstrap?.categories || []).filter((c) => !c.parentId && c.showInMenu);

  const socials = [
    { key: 'facebook', url: settings?.facebook, Icon: Facebook, label: 'Facebook' },
    { key: 'twitter', url: settings?.twitter, Icon: Twitter, label: 'X (Twitter)' },
    { key: 'linkedin', url: settings?.linkedin, Icon: Linkedin, label: 'LinkedIn' },
    { key: 'youtube', url: settings?.youtube, Icon: Youtube, label: 'YouTube' },
  ].filter((s) => s.url);

  const fixedLinks = [
    { label: 'Accueil', href: '#/' },
    { label: 'Vidéos', href: '#/videos' },
    { label: 'Podcasts', href: '#/podcasts' },
    { label: 'Contact', href: '#/contact' },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      {/* ── Topbar ─────────────────────────────────────────────── */}
      <div className="hidden border-b bg-secondary/60 sm:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 text-xs text-muted-foreground">
          <p className="font-medium">{today || '\u00a0'}</p>
          <div className="flex items-center gap-1">
            {socials.map(({ key, url, Icon, label }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-background hover:text-primary"
              >
                <Icon className="size-3.5" />
              </a>
            ))}
            <span className="mx-2 h-4 w-px bg-border" aria-hidden="true" />
            <a href="#/announcers" className="rounded px-2 py-1 transition-colors hover:text-primary">
              Espace annonceurs
            </a>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            {settings?.darkModeEnabled !== false && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-background hover:text-primary"
              >
                {theme === 'dark' ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              </button>
            )}
            <a
              href="#/admin"
              className="ml-1 rounded px-2 py-1 opacity-50 transition-opacity hover:opacity-100"
              title="Espace rédaction"
            >
              Pro
            </a>
          </div>
        </div>
      </div>

      {/* ── Barre principale ───────────────────────────────────── */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <a href="#/" className="group flex shrink-0 items-baseline gap-2" aria-label="Business Horizon — Accueil">
          <span className="font-editorial text-xl font-bold tracking-tight sm:text-2xl">
            BUSINESS <span className="text-primary">HORIZON</span>
          </span>
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground lg:block">
            {settings?.tagline || 'Entrepreneuriat · Business · Innovation'}
          </span>
        </a>

        {/* Menu desktop */}
        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navigation principale">
          <a
            href="#/"
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
          >
            Accueil
          </a>
          {roots.map((cat) => (
            <div key={cat.id} className="group relative">
              <a
                href={`#/category/${cat.slug}`}
                className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
                aria-haspopup={cat.children && cat.children.length > 0 ? 'true' : undefined}
              >
                {cat.name}
                {cat.children && cat.children.length > 0 ? (
                  <ChevronDown className="size-3.5 transition-transform duration-200 group-hover:rotate-180" />
                ) : null}
              </a>
              {cat.children && cat.children.length > 0 ? (
                <div className="invisible absolute left-0 top-full z-50 translate-y-1 pt-1 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="min-w-60 rounded-lg border bg-popover p-1.5 shadow-xl">
                    <a
                      href={`#/category/${cat.slug}`}
                      className="block rounded-md px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
                    >
                      Tous les articles
                    </a>
                    {cat.children.map((child) => (
                      <a
                        key={child.id}
                        href={`#/category/${child.slug}`}
                        className="block rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary"
                      >
                        {child.name}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          <a
            href="#/videos"
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
          >
            Vidéos
          </a>
          <a
            href="#/podcasts"
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
          >
            Podcasts
          </a>
          <a
            href="#/contact"
            className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
          >
            Contact
          </a>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Rechercher"
            className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-secondary hover:text-primary"
          >
            <Search className="size-5" />
          </button>
          <Button
            size="sm"
            className="cta-pulse ml-1 hidden h-10 rounded-full px-5 font-semibold sm:inline-flex"
            onClick={() => navigate('/newsletter')}
          >
            S'abonner
          </Button>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Ouvrir le menu"
                className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-secondary lg:hidden"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader className="border-b">
                <SheetTitle className="font-editorial text-lg font-bold">
                  BUSINESS <span className="text-primary">HORIZON</span>
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {settings?.tagline || 'Entrepreneuriat · Business · Innovation'}
                </SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4 py-3" aria-label="Menu mobile">
                <a
                  href="#/"
                  className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  Accueil
                </a>
                {roots.map((cat) =>
                  cat.children && cat.children.length > 0 ? (
                    <Accordion key={cat.id} type="single" collapsible>
                      <AccordionItem value={cat.slug} className="border-none">
                        <AccordionTrigger className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-secondary hover:no-underline">
                          {cat.name}
                        </AccordionTrigger>
                        <AccordionContent className="pb-1 pl-2">
                          <a
                            href={`#/category/${cat.slug}`}
                            className="block rounded-md px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
                          >
                            Tous les articles
                          </a>
                          {cat.children.map((child) => (
                            <a
                              key={child.id}
                              href={`#/category/${child.slug}`}
                              className={cn(
                                'block rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                              )}
                            >
                              {child.name}
                            </a>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ) : (
                    <a
                      key={cat.id}
                      href={`#/category/${cat.slug}`}
                      className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                    >
                      {cat.name}
                    </a>
                  ),
                )}
                {fixedLinks.slice(1).map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
              <div className="mt-auto border-t p-4">
                <Button
                  className="w-full rounded-full"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/newsletter');
                  }}
                >
                  S'abonner à la newsletter
                </Button>
                <div className="mt-3 flex justify-center gap-2">
                  {socials.map(({ key, url, Icon, label }) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="flex size-9 items-center justify-center rounded-full border transition-colors hover:bg-secondary hover:text-primary"
                    >
                      <Icon className="size-4" />
                    </a>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
