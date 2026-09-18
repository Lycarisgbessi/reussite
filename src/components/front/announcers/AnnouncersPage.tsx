'use client';

// ═══════════════════════════════════════════════════════════════
// ANNOUNCERS PAGE — espace annonceurs (B2B) : arguments chiffrés,
// formats publicitaires (tableau), formulaire contact prérempli
// « Demande kit média ».
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  BarChart3,
  Eye,
  Loader2,
  Mail,
  Megaphone,
  MousePointerClick,
  Send,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { isValidEmail } from '../mag/helpers';

const STATS = [
  { Icon: Users, value: '120 000+', label: 'Lecteurs mensuels' },
  { Icon: Eye, value: '450 000', label: 'Pages vues / mois' },
  { Icon: TrendingUp, value: '4 min 32', label: 'Temps de lecture moyen' },
  { Icon: Mail, value: '15 000', label: 'Abonnés newsletter' },
];

const FORMATS = [
  { placement: 'Bannière Header', format: '970×90 / 728×90', desc: 'Pleine largeur, sous le menu principal. Visibilité maximale.' },
  { placement: 'Sidebar Top', format: '300×250 / 300×600', desc: 'Haut de colonne latérale, présent sur tous les articles.' },
  { placement: 'Sidebar Sticky', format: '300×600', desc: 'Reste visible pendant toute la lecture (sticky au scroll).' },
  { placement: 'In-Article', format: '336×280', desc: 'Intégré au cœur du contenu, après le 2e paragraphe.' },
  { placement: 'Native / Sponsorisé', format: 'Carte éditoriale', desc: 'Contenu sponsorisé intégré aux grilles d’articles, identifié « Sponsorisé ».' },
  { placement: 'Footer Banner', format: '970×90', desc: 'Bannière avant le pied de page, fin de session de lecture.' },
  { placement: 'Sticky Mobile', format: '320×50', desc: 'Bannière fixe en bas d’écran sur mobile.' },
  { placement: 'Interstitiel', format: 'Plein écran', desc: 'Pop-up à l’entrée du site, fréquence limitée (1/session).' },
];

const ADVANTAGES = [
  {
    Icon: Target,
    title: 'Audience qualifiée',
    desc: 'Dirigeants, investisseurs et entrepreneurs en quête de solutions B2B premium.',
  },
  {
    Icon: MousePointerClick,
    title: 'Formats adaptés',
    desc: 'Display, natif, sponsorship : des créations respectueuses de l’expérience de lecture.',
  },
  {
    Icon: BarChart3,
    title: 'Reporting transparent',
    desc: 'Impressions, clics et CTR suivis en temps réel, avec bilan de campagne en fin de diffusion.',
  },
];

export function AnnouncersPage() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [busy, setBusy] = useState(false);

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
        subject: 'Demande kit média',
        message: `Société : ${form.company.trim() || '—'}\n\n${form.message.trim()}`,
      });
      toast({ title: 'Demande envoyée !', description: 'Notre équipe publicitaire vous recontacte sous 24 h ouvrées.' });
      setForm({ name: '', email: '', company: '', message: '' });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible d’envoyer la demande.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-4">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary/85 to-accent text-primary-foreground">
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute -bottom-20 left-1/4 size-52 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="eyebrow flex items-center gap-2 opacity-90">
            <Megaphone className="size-4" aria-hidden="true" />
            Espace annonceurs
          </p>
          <h1 className="mt-3 max-w-2xl font-editorial text-3xl font-bold leading-tight sm:text-5xl">
            Donnez de la visibilité à votre marque auprès des décideurs
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed opacity-90 sm:text-base">
            Business Horizon réunit chaque mois une communauté d'entrepreneurs, d'investisseurs et
            de cadres dirigeants. Nous construisons avec vous des campagnes sur-mesure, au service
            de vos objectifs.
          </p>
          <Button
            variant="secondary"
            className="cta-pulse mt-7 h-12 rounded-full px-8 font-semibold text-primary"
            onClick={() => document.getElementById('announcers-form')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Demander le kit média
          </Button>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="mx-auto max-w-6xl px-4 py-12" aria-label="Chiffres clés">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map(({ Icon, value, label }) => (
            <Card key={label} className="flex flex-col items-center gap-1 p-6 text-center">
              <Icon className="size-6 text-primary" aria-hidden="true" />
              <p className="font-editorial text-2xl font-bold sm:text-3xl">{value}</p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Formats publicitaires */}
      <section className="mx-auto max-w-6xl px-4 pb-12" aria-label="Formats publicitaires">
        <p className="eyebrow text-primary">Inventaire</p>
        <h2 className="mt-1 font-editorial text-2xl font-bold sm:text-3xl">Nos formats publicitaires</h2>
        <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Emplacement</TableHead>
                <TableHead className="min-w-[140px]">Format</TableHead>
                <TableHead className="min-w-[280px]">Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FORMATS.map((f) => (
                <TableRow key={f.placement}>
                  <TableCell className="font-semibold">{f.placement}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{f.format}</TableCell>
                  <TableCell className="text-muted-foreground">{f.desc}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Arguments */}
      <section className="border-y bg-secondary/40" aria-label="Pourquoi nous choisir">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-3">
          {ADVANTAGES.map(({ Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-editorial text-lg font-bold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Formulaire */}
      <section id="announcers-form" className="mx-auto max-w-3xl px-4 py-12" aria-label="Formulaire de contact annonceurs">
        <Card className="p-6 sm:p-8">
          <p className="eyebrow text-primary">Contact commercial</p>
          <h2 className="mt-1 font-editorial text-2xl font-bold">Demandez le kit média</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tarifs, audiences détaillées et disponibilités : recevez notre documentation complète.
          </p>
          <form onSubmit={submit} className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="adv-name">Nom complet *</Label>
              <Input
                id="adv-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Votre nom"
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="adv-email">Email professionnel *</Label>
              <Input
                id="adv-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="vous@societe.com"
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="adv-company">Société</Label>
              <Input
                id="adv-company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Nom de votre entreprise"
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="adv-message">Votre projet *</Label>
              <Textarea
                id="adv-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Objectifs, budget envisagé, période de campagne…"
                rows={5}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} className="min-h-[44px] rounded-full px-8">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Envoyer ma demande
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Sujet automatique : « Demande kit média ». Vos données restent confidentielles et ne
                servent qu'au traitement de votre demande.
              </p>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
