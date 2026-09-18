'use client';

// ═══════════════════════════════════════════════════════════════
// HEADER — Réussite Magazine.
// Masthead noir permanent (logo officiel + tagline), topbar fine
// (date, réseaux, thème, annonceurs), recherche, abonnement et
// menu hamburger sur TOUS les écrans (aucun overflow horizontal).
// Le menu latéral contient la navigation complète avec accordéon.
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  Facebook,
  Linkedin,
  Mail,
  Menu,
  Moon,
  Phone,
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
import { contactHref, formatFrDate } from './mag/helpers';
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
  const tagline = settings?.tagline || 'Trimestriel des décideurs africains';

  const socials = [
    { key: 'facebook', url: settings?.facebook, Icon: Facebook, label: 'Facebook' },
    { key: 'twitter', url: settings?.twitter, Icon: Twitter, label: 'X (Twitter)' },
    { key: 'linkedin', url: settings?.linkedin, Icon: Linkedin, label: 'LinkedIn' },
    { key: 'youtube', url: settings?.youtube, Icon: Youtube, label: 'YouTube' },
  ].filter((s) => s.url);

  return (
    <header className="sticky top-0 z-50">
      {/* ── Topbar fine (noir permanent) ────────────────────────── */}
      <div className="hidden border-b border-white/10 bg-neutral-950 sm:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-4 text-[11px] text-white/60">
          <div className="flex min-w-0 items-center gap-3">
            <p className="hidden shrink-0 font-medium tracking-wide lg:block">{today || '\u00a0'}</p>
            {settings?.contactPhone && (
              <a
                href={contactHref('Téléphone', settings.contactPhone)}
                className="hidden min-w-0 items-center gap-1.5 transition-colors hover:text-white md:flex"
                aria-label="Téléphone de la rédaction"
              >
                <Phone className="size-3 shrink-0 text-brand-bright" aria-hidden="true" />
                <span className="truncate">{settings.contactPhone}</span>
              </a>
            )}
            {settings?.contactEmail && (
              <a
                href={contactHref('Email', settings.contactEmail)}
                className="hidden min-w-0 items-center gap-1.5 transition-colors hover:text-white lg:flex"
                aria-label="Email de la rédaction"
              >
                <Mail className="size-3 shrink-0 text-brand-bright" aria-hidden="true" />
                <span className="truncate">{settings.contactEmail}</span>
              </a>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {socials.map(({ key, url, Icon, label }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex size-6.5 items-center justify-center rounded-full transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon className="size-3" />
              </a>
            ))}
            <span className="mx-2 h-3.5 w-px bg-white/15" aria-hidden="true" />
            <a href="#/announcers" className="rounded px-1.5 py-0.5 transition-colors hover:text-white">
              Espace annonceurs
            </a>
            <span className="mx-1.5 h-3.5 w-px bg-white/15" aria-hidden="true" />
            {settings?.darkModeEnabled !== false && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                className="flex size-6.5 items-center justify-center rounded-full transition-colors hover:bg-white/10 hover:text-white"
              >
                {theme === 'dark' ? <Sun className="size-3" /> : <Moon className="size-3" />}
              </button>
            )}
            <a
              href="#/admin"
              className="ml-1.5 rounded px-1.5 py-0.5 opacity-50 transition-opacity hover:opacity-100"
              title="Espace rédaction"
            >
              Pro
            </a>
          </div>
        </div>
      </div>

      {/* ── Masthead noir avec logo officiel ───────────────────── */}
      <div className="border-b-2 border-primary bg-neutral-950">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16">
          <a
            href="#/"
            className="flex shrink-0 items-center gap-3"
            aria-label="Réussite Magazine — Accueil"
          >
            {/* png transparent : rouge du logo sur fond noir permanent */}
            <img
              src="/images/logo-reussite.png"
              alt="Réussite Magazine — Trimestriel des décideurs africains"
              className="h-7 w-auto sm:h-8 md:h-9"
            />
            <span className="hidden border-l border-white/15 pl-3 text-[10px] font-medium uppercase leading-relaxed tracking-[0.22em] text-white/55 md:block">
              {tagline}
            </span>
          </a>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Rechercher"
              className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Search className="size-[18px]" />
            </button>
            {settings?.darkModeEnabled !== false && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
              >
                {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
              </button>
            )}
            <Button
              size="sm"
              className="ml-1 hidden h-9 rounded-full px-4 text-[13px] font-semibold sm:inline-flex"
              onClick={() => navigate('/newsletter')}
            >
              S'abonner
            </Button>

            {/* Menu hamburger — tous les écrans */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Ouvrir le menu"
                  className="flex size-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-84 overflow-y-auto sm:w-88">
                <SheetHeader className="border-b">
                  <SheetTitle className="font-editorial text-lg font-bold">
                    Réussite <span className="text-primary">Magazine</span>
                  </SheetTitle>
                  <SheetDescription className="text-xs">{tagline}</SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col gap-0.5 px-3 py-3" aria-label="Menu principal">
                  <a
                    href="#/"
                    className="rounded-md px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary hover:text-primary"
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
                        className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
                      >
                        {cat.name}
                      </a>
                    ),
                  )}
                  <div className="my-2 h-px bg-border" aria-hidden="true" />
                  <a href="#/videos" className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary">
                    Vidéos
                  </a>
                  <a href="#/podcasts" className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary">
                    Podcasts
                  </a>
                  <a href="#/favorites" className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary">
                    Mes favoris
                  </a>
                  <a href="#/announcers" className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary">
                    Espace annonceurs
                  </a>
                  <a href="#/contact" className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary">
                    Contact
                  </a>
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
                  {(settings?.contactPhone || settings?.contactEmail) && (
                    <div className="mt-3 space-y-1.5 rounded-lg border bg-secondary/40 p-3">
                      {settings?.contactPhone && (
                        <a
                          href={contactHref('Téléphone', settings.contactPhone)}
                          className="flex items-center gap-2.5 text-sm transition-colors hover:text-primary"
                          aria-label="Téléphone de la rédaction"
                        >
                          <Phone className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          <span className="min-w-0 break-words">{settings.contactPhone}</span>
                        </a>
                      )}
                      {settings?.contactEmail && (
                        <a
                          href={contactHref('Email', settings.contactEmail)}
                          className="flex items-center gap-2.5 text-sm transition-colors hover:text-primary"
                          aria-label="Email de la rédaction"
                        >
                          <Mail className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          <span className="min-w-0 break-words">{settings.contactEmail}</span>
                        </a>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-center gap-2">
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
      </div>
    </header>
  );
}
