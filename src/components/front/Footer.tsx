'use client';

// ═══════════════════════════════════════════════════════════════
// FOOTER — 4 colonnes (À propos, Rubriques, Informations, Newsletter)
// + barre basse : ©, mentions légales, plan du site, espace rédaction.
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
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DrawCheck } from './mag/DrawCheck';
import { isValidEmail } from './mag/helpers';

export function Footer() {
  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const settings = bootstrap?.settings;
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const roots = (bootstrap?.categories || []).filter((c) => !c.parentId && c.showInMenu);
  const footerMenu = (bootstrap?.menus.footer || []).filter((m) => m.active && !m.parentId);

  const socials = [
    { key: 'facebook', url: settings?.facebook, Icon: Facebook, label: 'Facebook' },
    { key: 'twitter', url: settings?.twitter, Icon: Twitter, label: 'X (Twitter)' },
    { key: 'linkedin', url: settings?.linkedin, Icon: Linkedin, label: 'LinkedIn' },
    { key: 'youtube', url: settings?.youtube, Icon: Youtube, label: 'YouTube' },
  ].filter((s) => s.url);

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast({ title: 'Adresse email invalide', description: 'Vérifiez votre saisie.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await publicApi.subscribeNewsletter({ email: email.trim(), source: 'footer' });
      setDone(true);
      toast({ title: 'Inscription confirmée', description: res.message || 'Merci de nous rejoindre !' });
    } catch (err) {
      toast({ title: 'Erreur', description: err instanceof Error ? err.message : 'Réessayez plus tard.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const contactRows = [
    { Icon: Mail, value: settings?.contactEmail, label: 'Email' },
    { Icon: Phone, value: settings?.contactPhone, label: 'Téléphone' },
    { Icon: MapPin, value: settings?.contactAddress, label: 'Adresse' },
    { Icon: Clock, value: settings?.contactHours, label: 'Horaires' },
  ].filter((r) => r.value);

  return (
    <footer className="mt-auto border-t bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* À propos */}
          <div>
            <p className="font-editorial text-lg font-bold">
              BUSINESS <span className="text-primary">HORIZON</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {settings?.footerAbout ||
                "Le magazine de référence de l'entrepreneuriat, du business et de l'innovation."}
            </p>
            <div className="mt-4 flex gap-2">
              {socials.map(({ key, url, Icon, label }) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-full border bg-card transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Rubriques */}
          <nav aria-label="Rubriques du site">
            <p className="eyebrow mb-3 text-primary">Rubriques</p>
            <ul className="space-y-2 text-sm">
              {footerMenu.length > 0
                ? footerMenu.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.url.startsWith('#') ? item.url : `#${item.url}`}
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))
                : roots.map((cat) => (
                    <li key={cat.id}>
                      <a
                        href={`#/category/${cat.slug}`}
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        {cat.name}
                      </a>
                    </li>
                  ))}
              <li>
                <a href="#/videos" className="text-muted-foreground transition-colors hover:text-primary">
                  Vidéos
                </a>
              </li>
              <li>
                <a href="#/podcasts" className="text-muted-foreground transition-colors hover:text-primary">
                  Podcasts
                </a>
              </li>
            </ul>
          </nav>

          {/* Informations */}
          <div>
            <p className="eyebrow mb-3 text-primary">Informations</p>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {contactRows.map(({ Icon, value, label }) => (
                <li key={label} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{value}</span>
                </li>
              ))}
              <li>
                <a href="#/contact" className="font-medium text-primary hover:underline">
                  Nous contacter →
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <p className="eyebrow mb-3 text-primary">Newsletter</p>
            <p className="text-sm text-muted-foreground">
              L'essentiel de l'actu business chaque semaine, dans votre boîte mail.
            </p>
            {done ? (
              <div className="mt-4 flex items-center gap-3 rounded-lg border bg-card p-3">
                <DrawCheck className="size-8" />
                <p className="text-sm font-medium">Inscription confirmée. Merci !</p>
              </div>
            ) : (
              <form onSubmit={subscribe} className="mt-4 flex gap-2">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Votre email"
                  aria-label="Adresse email pour la newsletter"
                  className="h-11"
                />
                <Button type="submit" disabled={busy} className="h-11 shrink-0 rounded-lg px-4">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : "S'inscrire"}
                </Button>
              </form>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              En vous inscrivant, vous acceptez notre politique de confidentialité.
            </p>
          </div>
        </div>
      </div>

      {/* Barre basse */}
      <div className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Business Horizon — Tous droits réservés.</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1" aria-label="Liens légaux">
            <a href="#/page/mentions-legales" className="transition-colors hover:text-primary">
              Mentions légales
            </a>
            <a href="#/page/cgu" className="transition-colors hover:text-primary">
              CGU
            </a>
            <a href="#/page/politique-confidentialite" className="transition-colors hover:text-primary">
              Confidentialité
            </a>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="transition-colors hover:text-primary">
                  Plan du site
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="center">
                <p className="eyebrow mb-2 text-primary">Plan du site</p>
                <div className="custom-scrollbar max-h-64 space-y-1 overflow-y-auto pr-2">
                  <a href="#/" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-secondary">
                    Accueil
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
                          className="block rounded px-2 py-1 pl-6 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          {child.name}
                        </a>
                      ))}
                    </div>
                  ))}
                  <a href="#/videos" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-secondary">
                    Vidéos
                  </a>
                  <a href="#/podcasts" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-secondary">
                    Podcasts
                  </a>
                  <a href="#/contact" className="block rounded px-2 py-1.5 text-sm font-medium hover:bg-secondary">
                    Contact
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate('/announcers')}
                    className="block w-full rounded px-2 py-1.5 text-left text-sm font-medium hover:bg-secondary"
                  >
                    Espace annonceurs
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <a
              href="#/admin"
              className="inline-flex items-center gap-1 opacity-60 transition-opacity hover:opacity-100"
            >
              <Lock className="size-3" aria-hidden="true" />
              Espace rédaction
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
