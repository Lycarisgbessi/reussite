'use client';

import { useEffect, useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// HEADER — Réussite Magazine.
// Masthead noir permanent (logo officiel + tagline), topbar fine
// (date, réseaux, thème, annonceurs), recherche, abonnement et
// menu hamburger sur TOUS les écrans (aucun overflow horizontal).
// Le menu latéral contient la navigation complète avec accordéon.
// ═══════════════════════════════════════════════════════════════
import {
  Facebook,
  Globe,
  Linkedin,
  Mail,
  Menu,
  Moon,
  Phone,
  Search,
  Sun,
  Thermometer,
  Twitter,
  Youtube,
} from 'lucide-react';
import { navigate, useMagazineStore } from '@/lib/store';
import { LOCALES, useFormatDate, useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { contactHref } from './mag/helpers';
import { HeaderCovers } from './HeaderCovers';
import { cn } from '@/lib/utils';

export function Header() {  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const theme = useMagazineStore((s) => s.theme);
  const toggleTheme = useMagazineStore((s) => s.toggleTheme);
  const setSearchOpen = useMagazineStore((s) => s.setSearchOpen);
  const mobileMenuOpen = useMagazineStore((s) => s.mobileMenuOpen);
  const setMobileMenuOpen = useMagazineStore((s) => s.setMobileMenuOpen);

  const { t, setLocale, locale } = useI18n();
  const { formatDate } = useFormatDate();

  const settings = bootstrap?.settings;
  // Le composant n'est rendu qu'après hydratation (page.tsx attend « ready »)
  const todayRaw = formatDate(new Date(), 'EEEE d MMMM yyyy');
  const today = todayRaw ? todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1) : '';

  // ── Barre utilitaire : météo Conakry + fuseau horaire ──
  const [weather, setWeather] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('https://api.open-meteo.com/v1/forecast?latitude=9.537&longitude=-13.6785&current=temperature_2m')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.current?.temperature_2m != null) {
          setWeather(`${Math.round(d.current.temperature_2m)}°C`);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const tz = (() => {
    try {
      return (
        Intl.DateTimeFormat('fr', { timeZone: 'Africa/Conakry', timeZoneName: 'short' })
          .formatToParts(new Date())
          .find((x) => x.type === 'timeZoneName')?.value ?? 'GMT'
      );
    } catch {
      return 'GMT';
    }
  })();

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
        <div className="relative mx-auto flex h-8 max-w-7xl items-center justify-between px-4 text-[11px] text-white/60">
          <div className="flex min-w-0 items-center gap-3">
            <p className="hidden shrink-0 font-medium tracking-wide lg:block">{today || '\u00a0'}</p>
            <span className="hidden h-3.5 w-px bg-white/15 lg:block" aria-hidden="true" />
            <span className="hidden shrink-0 items-center gap-1 lg:flex">
              <Thermometer className="size-3 shrink-0 text-brand-bright" aria-hidden="true" />
              Conakry {weather ?? '…'} · {tz}
            </span>
            <span className="hidden h-3.5 w-px bg-white/15 md:block" aria-hidden="true" />
            <a
              href="tel:+224628209866"
              className="hidden min-w-0 items-center gap-1.5 transition-colors hover:text-white md:flex"
              aria-label="628 20 98 66"
            >
              <Phone className="size-3 shrink-0 text-brand-bright" aria-hidden="true" />
              <span className="shrink-0 font-semibold text-white/80">628 20 98 66</span>
            </a>
            {settings?.contactPhone && (
              <a
                href={contactHref('Téléphone', settings.contactPhone)}
                className="hidden min-w-0 items-center gap-1.5 transition-colors hover:text-white md:flex"
                aria-label={t('nav.phoneLabel')}
              >
                <Phone className="size-3 shrink-0 text-brand-bright" aria-hidden="true" />
                <span className="truncate">{settings.contactPhone}</span>
              </a>
            )}
            {settings?.contactEmail && (
              <a
                href={contactHref('Email', settings.contactEmail)}
                className="hidden min-w-0 items-center gap-1.5 transition-colors hover:text-white lg:flex"
                aria-label={t('nav.emailLabel')}
              >
                <Mail className="size-3 shrink-0 text-brand-bright" aria-hidden="true" />
                <span className="truncate">{settings.contactEmail}</span>
              </a>
            )}
          </div>
          {/* Slogan du magazine — placé au centre de la barre utilitaire */}
          <p className="pointer-events-none absolute inset-x-0 hidden text-center font-editorial text-[12px] font-semibold italic tracking-wide text-white/80 lg:block">
            « Avec Réussite, Osez l'Avenir… »
          </p>
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
              {t('nav.announcers')}
            </a>
            <span className="mx-1.5 h-3.5 w-px bg-white/15" aria-hidden="true" />
            {settings?.darkModeEnabled !== false && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}
                className="flex size-6.5 items-center justify-center rounded-full transition-colors hover:bg-white/10 hover:text-white"
              >
                {theme === 'dark' ? <Sun className="size-3" /> : <Moon className="size-3" />}
              </button>
            )}
            {/* Sélecteur de langue (desktop) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('common.language')}
                  className="flex size-6.5 items-center justify-center gap-1 rounded-full transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Globe className="size-3" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {LOCALES.map((l) => (
                  <DropdownMenuItem
                    key={l}
                    onClick={() => setLocale(l)}
                    className={l === locale ? 'font-semibold' : undefined}
                  >
                    {t(`lang.${l}`)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <a
              href="#/admin"
              className="ml-1.5 rounded px-1.5 py-0.5 opacity-70 transition-opacity hover:opacity-100"
              title={t('nav.adminSpace')}
            >
              {t('nav.pro')}
            </a>
          </div>
        </div>
      </div>

      {/* ── Masthead noir avec logo officiel ───────────────────── */}
      <div className="border-b-2 border-primary bg-neutral-950">
        {/* Masthead élargi : logo en GRAND au centre-gauche, couvertures à droite.
            Hauteur généreuse (h-24 → h-32) pour bien cadrer sans débordement. */}
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between gap-6 px-4 sm:h-28 lg:h-32">
          <a
            href="#/"
            className="flex min-w-0 shrink items-center gap-5"
            aria-label={t('header.homeAria')}
          >
            {/* Charte : fond noir conservé, logo en BLANC pour la visibilité */}
            {/* Le logo contient déjà « Réussite Magazine » et « Trimestriel
                des décideurs africains » : aucun texte dupliqué ici. */}
            <img
              src="/images/logo-reussite-white.png"
              alt="Réussite Magazine — Trimestriel des décideurs africains"
              className="h-16 w-auto shrink-0 sm:h-20 md:h-24 lg:h-28"
            />
          </a>

          {/* ── Carrousel des unes : défilement auto, centre en exergue ── */}
          <HeaderCovers />

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label={t('nav.search')}
              className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Search className="size-[18px]" />
            </button>
            {settings?.darkModeEnabled !== false && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? t('nav.themeLight') : t('nav.themeDark')}
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
              {t('nav.subscribe')}
            </Button>

            {/* Menu hamburger — tous les écrans */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label={t('nav.menu')}
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
                    {t('nav.home')}
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
                              {t('nav.allArticles')}
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
                    {t('nav.videos')}
                  </a>
                  <a href="#/podcasts" className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary">
                    {t('nav.podcasts')}
                  </a>
                  <a href="#/favorites" className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary">
                    {t('nav.favorites')}
                  </a>
                  <a href="#/announcers" className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary">
                    {t('nav.announcers')}
                  </a>
                  <a href="#/contact" className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary">
                    {t('nav.contact')}
                  </a>
                  {/* Liens personnalisés du menu « header » gérés dans le
                      tableau de bord (Menus) — incohérence d'origine corrigée :
                      ils sont désormais réellement consommés par la navigation. */}
                  {(bootstrap?.menus.header || [])
                    .filter((m) => m.active && !m.parentId && m.url)
                    .map((m) => (
                      <a
                        key={m.id}
                        href={m.url.startsWith('#') ? m.url : `#${m.url}`}
                        className="rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary hover:text-primary"
                      >
                        {m.label}
                      </a>
                    ))}
                </nav>
                {/* Sélecteur de langue (mobile) */}
                <div className="border-t px-4 py-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Globe className="size-3" aria-hidden="true" />
                    {t('common.language')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {LOCALES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLocale(l)}
                        aria-pressed={l === locale}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          l === locale
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )}
                      >
                        {t(`lang.${l}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-auto border-t p-4">
                  <Button
                    className="w-full rounded-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate('/newsletter');
                    }}
                  >
                    {t('nav.subscribeNewsletter')}
                  </Button>
                  {(settings?.contactPhone || settings?.contactEmail) && (
                    <div className="mt-3 space-y-1.5 rounded-lg border bg-secondary/40 p-3">
                      {settings?.contactPhone && (
                        <a
                          href={contactHref('Téléphone', settings.contactPhone)}
                          className="flex items-center gap-2.5 text-sm transition-colors hover:text-primary"
                          aria-label={t('nav.phoneLabel')}
                        >
                          <Phone className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                          <span className="min-w-0 break-words">{settings.contactPhone}</span>
                        </a>
                      )}
                      {settings?.contactEmail && (
                        <a
                          href={contactHref('Email', settings.contactEmail)}
                          className="flex items-center gap-2.5 text-sm transition-colors hover:text-primary"
                          aria-label={t('nav.emailLabel')}
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
        {/* ── Bande horizontale des rubriques (rouge sang / blanc) ── */}
        {/* Bande des rubriques — légèrement descendue pour laisser respirer le masthead */}
        <div className="mt-3 bg-black/0 px-0">
        <nav className="overflow-x-auto bg-primary text-white shadow-lg shadow-primary/25" aria-label="Rubriques">
          <ul className="mx-auto flex h-11 max-w-7xl items-center gap-1 overflow-x-auto whitespace-nowrap px-3 scrollbar-none">
            <li>
              <a
                href="#/"
                className="flex h-full items-center px-3.5 text-[12.5px] font-bold uppercase tracking-wide transition-colors hover:bg-white/20"
              >
                {t('nav.home')}
              </a>
            </li>
            {roots.map((cat) => (
              <li key={cat.id} className="flex items-center">
                <span className="h-4 w-px bg-white/25" aria-hidden="true" />
                <a
                  href={`#/category/${cat.slug}`}
                  className="flex h-full items-center px-3.5 text-[12.5px] font-bold uppercase tracking-wide transition-colors hover:bg-white/20"
                >
                  {cat.name}
                </a>
              </li>
            ))}
            <li className="flex items-center">
              <span className="h-4 w-px bg-white/25" aria-hidden="true" />
              <a
                href="#/videos"
                className="flex h-full items-center px-3.5 text-[12.5px] font-bold uppercase tracking-wide transition-colors hover:bg-white/20"
              >
                {t('nav.videos')}
              </a>
            </li>
            <li>
              <span className="h-4 w-px bg-white/25" aria-hidden="true" />
              <a
                href="#/podcasts"
                className="flex h-full items-center px-3.5 text-[12.5px] font-bold uppercase tracking-wide transition-colors hover:bg-white/20"
              >
                {t('nav.podcasts')}
              </a>
            </li>
          </ul>
        </nav>
        </div>
    </header>
  );
}
