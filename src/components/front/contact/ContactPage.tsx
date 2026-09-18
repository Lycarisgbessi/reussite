'use client';

// ═══════════════════════════════════════════════════════════════
// CONTACT PAGE — formulaire (nom, email, sujet, message) +
// informations dynamiques (settings) + réseaux sociaux +
// encart « Devenir annonceur ».
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Facebook,
  Linkedin,
  Loader2,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  Send,
  Twitter,
  Youtube,
} from 'lucide-react';
import { publicApi } from '@/lib/api';
import { navigate, useMagazineStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { contactHref, isValidEmail } from '../mag/helpers';

const SUBJECTS = [
  "Demande d'information",
  'Proposer un article ou une tribune',
  'Partenariat',
  'Publicité / Annonceurs',
  'Signaler une erreur',
  'Autre demande',
];

export function ContactPage() {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const socials = [
    { key: 'facebook', url: settings?.facebook, Icon: Facebook, label: 'Facebook' },
    { key: 'twitter', url: settings?.twitter, Icon: Twitter, label: 'X (Twitter)' },
    { key: 'linkedin', url: settings?.linkedin, Icon: Linkedin, label: 'LinkedIn' },
    { key: 'youtube', url: settings?.youtube, Icon: Youtube, label: 'YouTube' },
  ].filter((s) => s.url);

  const infoRows = [
    { Icon: Mail, value: settings?.contactEmail, label: 'Email' },
    { Icon: Phone, value: settings?.contactPhone, label: 'Téléphone' },
    { Icon: MapPin, value: settings?.contactAddress, label: 'Adresse' },
    { Icon: Clock, value: settings?.contactHours, label: 'Horaires' },
  ].filter((r) => r.value);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) {
      toast({ title: 'Champs manquants', description: 'Renseignez votre nom et votre message.', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(form.email)) {
      toast({ title: 'Adresse email invalide', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await publicApi.contact({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject || 'Demande d’information',
        message: form.message.trim(),
      });
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
      toast({ title: 'Message envoyé !', description: 'Notre équipe vous répondra sous 48 h ouvrées.' });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible d’envoyer le message.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="eyebrow text-primary">Contact</p>
        <h1 className="font-editorial text-3xl font-bold sm:text-4xl">Parlons de votre projet</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Une question, une proposition, un partenariat ? La rédaction vous lit.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-5">
        {/* Formulaire */}
        <Card className="p-6 sm:p-8 lg:col-span-3">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <CheckCircle2 className="size-14 text-primary" aria-hidden="true" />
              <p className="font-editorial text-xl font-bold">Message bien reçu !</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Merci pour votre message. Notre équipe reviendra vers vous au plus vite à l'adresse
                indiquée.
              </p>
              <Button variant="outline" className="mt-2 rounded-full" onClick={() => setSent(false)}>
                Envoyer un autre message
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="contact-name">Nom complet *</Label>
                <Input
                  id="contact-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Votre nom"
                  className="h-11"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="contact-email">Email *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="vous@exemple.com"
                  className="h-11"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="contact-subject">Sujet</Label>
                <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                  <SelectTrigger id="contact-subject" className="h-11" aria-label="Sujet du message">
                    <SelectValue placeholder="Choisissez un sujet" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="contact-message">Message *</Label>
                <Textarea
                  id="contact-message"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="Décrivez votre demande…"
                  rows={6}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy} className="min-h-[44px] rounded-full px-8">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Envoyer le message
                </Button>
              </div>
            </form>
          )}
        </Card>

        {/* Informations */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <p className="eyebrow mb-4 text-primary">Coordonnées</p>
            <ul className="space-y-4 text-sm">
              {infoRows.map(({ Icon, value, label }) => {
                const href = contactHref(label, value);
                return (
                  <li key={label} className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold">{label}</p>
                      {href ? (
                        <a
                          href={href}
                          {...(href.startsWith('http')
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                          className="break-words text-muted-foreground transition-colors hover:text-primary hover:underline underline-offset-2"
                        >
                          {value}
                        </a>
                      ) : (
                        <p className="text-muted-foreground">{value}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {socials.length > 0 ? (
              <>
                <p className="eyebrow mb-3 mt-6 text-primary">Suivez-nous</p>
                <div className="flex gap-2">
                  {socials.map(({ key, url, Icon, label }) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="flex size-10 items-center justify-center rounded-full border bg-card transition-colors hover:bg-primary hover:text-primary-foreground"
                    >
                      <Icon className="size-4" />
                    </a>
                  ))}
                </div>
              </>
            ) : null}
          </Card>

          {/* Encart annonceurs */}
          <Card className="border-primary/25 bg-accent/40 p-6">
            <Megaphone className="size-7 text-primary" aria-hidden="true" />
            <p className="mt-3 font-editorial text-lg font-bold">Devenir annonceur</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Touchez une audience de décideurs et d'entrepreneurs engagés. Demandez notre kit média
              et nos tarifs.
            </p>
            <Button
              className="mt-4 rounded-full"
              onClick={() => navigate('/announcers')}
              aria-label="Accéder à l'espace annonceurs"
            >
              Espace annonceurs
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
