'use client';

// ═══════════════════════════════════════════════════════════════
// FOOTER — Réussite Magazine. Noir permanent (charte rouge/noir/blanc) :
// 4 colonnes (À propos, Rubriques, Informations, Newsletter) + barre
// basse : ©, mentions légales, plan du site, espace rédaction.
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  Clock,
  Facebook,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from 'lucide-react';
import { navigate, useMagazineStore } from '@/lib/store';
import { publicApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DrawCheck } from './mag/DrawCheck';
import { contactHref, isValidEmail } from './mag/helpers';

export function Footer() {
  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const settings = bootstrap?.settings;
  const { toast } = useToast();
  const { t } = useI18n();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const roots = (bootstrap?.categories || []).filter((c) => !c.parentId && c.showInMenu);
  // Liens de rubriques du menu footer (enfants réels uniquement — les
  // entrées parents de groupement ont une URL vide et sont exclues)
  const footerCatLinks = (bootstrap?.menus.footer || []).filter(
    (m) => m.active && m.parentId && m.url.startsWith('#/category/'),
  );

  // Partenaires : une ligne par partenaire — « Nom », « Nom | https://… »
  // ou « Nom | https://logo.png | https://site.com ».
  const partnerEntries = (settings?.partnersLogos || '')
    .split('\n')
    .map((line) => line.split('|').map((x) => x.trim()))
    .filter((parts) => parts[0])
    .map((parts) => ({
      name: parts[0],
      url: parts[2] || (parts[1] && /^https?:\/\//.test(parts[1]) && !/\.(png|jpe?g|webp|svg|gif)$/i.test(parts[1]) ? parts[1] : undefined),
      logoUrl: parts[1] && /\.(png|jpe?g|webp|svg|gif)$/i.test(parts[1]) ? parts[1] : undefined,
    }));

  const socials = [
    { key: 'facebook', url: settings?.facebook, Icon: Facebook, label: 'Facebook' },
    { key: 'twitter', url: settings?.twitter, Icon: Twitter, label: 'X (Twitter)' },
    { key: 'linkedin', url: settings?.linkedin, Icon: Linkedin, label: 'LinkedIn' },
    { key: 'youtube', url: settings?.youtube, Icon: Youtube, label: 'YouTube' },
  ].filter((s) => s.url);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast({ title: t('form.invalidEmail'), description: t('form.checkInput'), variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await publicApi.subscribeNewsletter({ email: email.trim(), source: 'footer' });
      setDone(true);
      toast({ title: t('form.subscribedTitle'), description: res.message || t('form.subscribedDesc') });
    } catch (err) {
      toast({ title: t('form.error'), description: err instanceof Error ? err.message : t('form.retryLater'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // Les libellés internes ('Email', 'Téléphone', 'Adresse') servent de clé
  // à contactHref ; seul le libellé affiché est traduit.
  const contactRows = [
    { Icon: Mail, value: settings?.contactEmail, label: t('footer.email'), href: contactHref('Email', settings?.contactEmail || '') },
    { Icon: Phone, value: settings?.contactPhone, label: t('footer.phone'), href: contactHref('Téléphone', settings?.contactPhone || '') },
    { Icon: MapPin, value: settings?.contactAddress, label: t('footer.address'), href: contactHref('Adresse', settings?.contactAddress || '') },
    { Icon: Clock, value: settings?.contactHours, label: t('footer.hours') },
  ].filter((r) => r.value);

  return (
    <footer className="mt-auto bg-neutral-950 text-neutral-300">
      <div className="h-0.5 w-full bg-primary" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* À propos */}
          <div>
            <a href="#/" aria-label={t('header.homeAria')} className="inline-block">
              <img
                src="/images/logo-reussite.png"
                alt="Réussite Magazine"
                className="h-8 w-auto"
                loading="lazy"
              />
            </a>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-neutral-400">
              {settings?.footerAbout || t('footer.aboutDefault')}
            </p>
            <div className="mt-4 flex gap-2">
              {socials.map(({ key, url, Icon, label }) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-8 items-center justify-center rounded-full border border-white/15 transition-colors hover:border-primary hover:bg-primary hover:text-white"
                >
                  <Icon className="size-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Rubriques */}
          <nav aria-label={t('footer.sectionsAria')}>
            <p className="eyebrow mb-3 text-brand-bright">{t('footer.sections')}</p>
            <ul className="space-y-2 text-[13px]">
              {footerCatLinks.length > 0
                ? footerCatLinks.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.url.startsWith('#') ? item.url : `#${item.url}`}
                        className="text-neutral-400 transition-colors hover:text-white"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))
                : roots.map((cat) => (
                    <li key={cat.id}>
                      <a
                        href={`#/category/${cat.slug}`}
                        className="text-neutral-400 transition-colors hover:text-white"
                      >
                        {cat.name}
                      </a>
                    </li>
                  ))}
              <li>
                <a href="#/shop" className="text-neutral-400 transition-colors hover:text-white">
                  Boutique
                </a>
              </li>
              <li>
                <a href="#/videos" className="text-neutral-400 transition-colors hover:text-white">
                  {t('nav.videos')}
                </a>
              </li>
              <li>
                <a href="#/podcasts" className="text-neutral-400 transition-colors hover:text-white">
                  {t('nav.podcasts')}
                </a>
              </li>
            </ul>
          </nav>

          {/* Informations */}
          <div>
            <p className="eyebrow mb-3 text-brand-bright">{t('footer.information')}</p>
            <ul className="space-y-2.5 text-[13px] text-neutral-400">
              {contactRows.map(({ Icon, value, label, href }) => {
                return (
                  <li key={label} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-brand-bright" aria-hidden="true" />
                    {href ? (
                      <a
                        href={href}
                        {...(href.startsWith('http')
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                        className="break-words text-neutral-400 transition-colors hover:text-white hover:underline underline-offset-2"
                      >
                        {value}
                      </a>
                    ) : (
                      <span>{value}</span>
                    )}
                  </li>
                );
              })}
              <li>
                <a href="#/contact" className="font-medium text-brand-bright hover:underline">
                  {t('footer.contactUs')}
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <p className="eyebrow mb-3 text-brand-bright">{t('footer.newsletter')}</p>
            <p className="text-[13px] leading-relaxed text-neutral-400">
              {t('footer.newsletterText')}
            </p>
            {done ? (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <DrawCheck className="size-8" />
                <p className="text-[13px] font-medium text-white">{t('footer.subscribed')}</p>
              </div>
            ) : (
              <form onSubmit={subscribe} className="mt-4 flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('footer.emailPlaceholder')}
                  aria-label={t('footer.emailLabel')}
                  className="h-10 border-white/15 bg-white/5 text-sm text-white placeholder:text-neutral-500"
                />
                <Button type="submit" disabled={busy} className="h-10 shrink-0 rounded-md px-4 text-[13px]">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : t('footer.subscribe')}
                </Button>
              </form>
            )}
            <p className="mt-2 text-[11px] text-neutral-500">
              {t('footer.privacyNote')}
            </p>
          </div>
        </div>
      </div>

      {/* Bandeau partenaires (réglage « Partenaires » du dashboard) */}
      {partnerEntries.length > 0 ? (
        <div className="border-t border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-6">
            <p className="eyebrow mb-3 text-center text-brand-bright">{t('footer.partners')}</p>
            <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {partnerEntries.map((entry, i) => (
                <li key={i}>
                  {entry.url ? (
                    <a
                      href={entry.url}
                      {...(entry.url.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="text-[13px] font-semibold uppercase tracking-wider text-neutral-400 transition-colors hover:text-white"
                    >
                      {entry.logoUrl ? (
                        <img src={entry.logoUrl} alt={entry.name} className="h-7 w-auto opacity-80 transition-opacity hover:opacity-100" loading="lazy" />
                      ) : (
                        entry.name
                      )}
                    </a>
                  ) : (
                    <span className="text-[13px] font-semibold uppercase tracking-wider text-neutral-500">
                      {entry.logoUrl ? (
                        <img src={entry.logoUrl} alt={entry.name} className="h-7 w-auto opacity-70" loading="lazy" />
                      ) : (
                        entry.name
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Barre basse */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-neutral-500 md:flex-row">
          <p>© {new Date().getFullYear()} Réussite Magazine — {t('footer.rights')}</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1" aria-label={t('footer.legalLinks')}>
            <a href="#/page/mentions-legales" className="transition-colors hover:text-white">
              {t('footer.legal')}
            </a>
            <a href="#/page/cgu" className="transition-colors hover:text-white">
              {t('footer.tos')}
            </a>
            <a href="#/page/politique-confidentialite" className="transition-colors hover:text-white">
              {t('footer.privacy')}
            </a>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="transition-colors hover:text-white">
                  {t('footer.sitemap')}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="center">
                <p className="eyebrow mb-2 text-primary">{t('footer.sitemap')}</p>
                <div className="custom-scrollbar max-h-64 space-y-1 overflow-y-auto pr-2">
                  <a href="#/" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-secondary">
                    {t('nav.home')}
                  </a>
                  {roots.map((cat) => (
                    <div key={cat.id}>
                      <a
                        href={`#/category/${cat.slug}`}
                        className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-secondary"
                      >
                        {cat.name}
                      </a>
                      {(cat.children || []).map((child) => (
                        <a
                          key={child.id}
                          href={`#/category/${child.slug}`}
                          className="block rounded px-2 py-1.5 pl-6 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          {child.name}
                        </a>
                      ))}
                    </div>
                  ))}
                  <a href="#/videos" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-secondary">
                    {t('nav.videos')}
                  </a>
                  <a href="#/podcasts" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-secondary">
                    {t('nav.podcasts')}
                  </a>
                  <a href="#/contact" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-secondary">
                    {t('nav.contact')}
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate('/announcers')}
                    className="block w-full rounded px-2 py-1.5 text-left text-sm font-medium hover:bg-secondary"
                  >
                    {t('nav.announcers')}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <a
              href="#/admin"
              className="inline-flex items-center gap-1 transition-colors hover:text-white"
            >
              <Lock className="size-3" aria-hidden="true" />
              {t('nav.adminSpace')}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
