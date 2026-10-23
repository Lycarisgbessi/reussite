'use client';

// ═══════════════════════════════════════════════════════════════
// BOUTIQUE — process de vente complet :
//  1. Catalogue des numéros (grille de couvertures) + formules
//  2. Détail d'un numéro : aperçu des pages, description, prix
//  3. Tunnel d'achat : achat unitaire OU abonnement → coordonnées
//     → paiement (Mobile Money / virement / carte) → confirmation
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck, BookOpen, Calendar, Check, ChevronLeft, ChevronRight, CreditCard,
  Landmark, Loader2, Mail, Package, ShoppingBag, Smartphone, Sparkles, X,
} from 'lucide-react';
import { publicApi } from '@/lib/api';
import { navigate } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SmartImage } from '../mag/SmartImage';
import { cn } from '@/lib/utils';

export interface ShopIssue {
  id: string;
  slug: string;
  title: string;
  issueNumber: number;
  description: string;
  coverUrl: string;
  priceCfa: number;
  priceEur: number;
  featured: boolean;
  releaseDate: string;
  previewImages?: string[];
}

export interface ShopPlan {
  id: string;
  name: string;
  description: string;
  durationMonths: number;
  issuesCount: number;
  priceCfa: number;
  priceEur: number;
  perks: string[];
}

const fmtGnf = (n: number) => `${n.toLocaleString('fr-FR')} GNF`;
const fmtUsd = (n: number) => `${n} $`;

export function ShopPage({ focusIssueId }: { focusIssueId?: string }) {
  useDocumentTitle('Boutique — Numéros & Abonnements');
  const [issues, setIssues] = useState<ShopIssue[] | null>(null);
  const [plans, setPlans] = useState<ShopPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    publicApi
      .shop()
      .then((res) => {
        if (cancelled) return;
        setIssues(res.issues);
        setPlans(res.plans);
        publicApi.track('PAGE_VIEW', '/boutique');
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [checkout, setCheckout] = useState<{ type: 'SINGLE' | 'SUBSCRIPTION'; issue?: ShopIssue; plan?: ShopPlan } | null>(null);

  // Ouvre directement le détail d'un numéro si focusIssueId (depuis l'extérieur)
  const [preview, setPreview] = useState<ShopIssue | null>(null);
  useEffect(() => {
    if (focusIssueId && issues) {
      const found = issues.find((i) => i.id === focusIssueId || i.slug === focusIssueId);
      if (found) setPreview(found);
    }
  }, [focusIssueId, issues]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {/* ── En-tête boutique ── */}
      <header className="mb-10 text-center">
        <p className="eyebrow text-primary">Boutique officielle</p>
        <h1 className="font-editorial text-3xl font-bold sm:text-4xl">Le magazine, chez vous</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Achetez le numéro de votre choix ou abonnez-vous pour recevoir chaque trimestre
          les analyses, interviews et dossiers de Réussite Magazine — en version numérique,
          partout dans le monde.
        </p>
      </header>

      {error ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{error}</p>
      ) : issues === null ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton-shimmer aspect-[3/4] rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* ── Catalogue des numéros ── */}
          <section aria-label="Numéros disponibles">
            <div className="mb-5 flex items-end justify-between">
              <h2 className="font-editorial text-2xl font-bold">Les numéros</h2>
              <span className="text-xs text-muted-foreground">{issues.length} numéro(s) disponible(s)</span>
            </div>
            {issues.length === 0 ? (
              <div className="rounded-xl border border-dashed py-16 text-center">
                <BookOpen className="mx-auto size-10 text-muted-foreground/40" aria-hidden="true" />
                <p className="mt-3 font-editorial text-xl font-bold">Le catalogue arrive</p>
                <p className="mt-2 text-sm text-muted-foreground">Les premiers numéros seront bientôt en vente.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {issues.map((issue) => (
                  <motion.article
                    key={issue.id}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="article-card group flex flex-col overflow-hidden rounded-xl border bg-card"
                  >
                    <button type="button" onClick={() => setPreview(issue)} className="relative block aspect-[3/4] overflow-hidden" aria-label={`Aperçu du ${issue.title}`}>
                      <SmartImage
                        src={issue.coverUrl}
                        alt={issue.title}
                        className="card-image h-full w-full object-cover"
                        fallbackLabel="Réussite"
                      />
                      {issue.featured ? (
                        <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                          <Sparkles className="mr-1 inline size-3" aria-hidden="true" />
                          À la une
                        </span>
                      ) : null}
                      <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                        N° {issue.issueNumber}
                      </span>
                    </button>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-2 font-editorial text-base font-bold leading-snug">{issue.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(issue.releaseDate).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                      </p>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-lg font-bold text-primary">{fmtGnf(issue.priceCfa)}</span>
                        <span className="text-xs text-muted-foreground">/ {fmtUsd(issue.priceEur)}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="flex-1 rounded-full" onClick={() => setCheckout({ type: 'SINGLE', issue })}>
                          <ShoppingBag className="size-4" /> Acheter
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setPreview(issue)}>
                          Aperçu
                        </Button>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </section>

          {/* ── Abonnements ── */}
          {plans.length > 0 ? (
            <section aria-label="Abonnements" className="mt-16">
              <div className="mb-6 text-center">
                <p className="eyebrow text-primary">Simple, économique</p>
                <h2 className="font-editorial text-2xl font-bold">S'abonner à Réussite</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  Chaque numéro livré directement par email, dès sa parution, avec les archives numériques.
                </p>
              </div>
              <div className={cn('grid gap-6 md:grid-cols-2 lg:grid-cols-3', plans.length === 1 && 'mx-auto max-w-md')}>
                {plans.map((plan, idx) => (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className={cn(
                      'relative flex flex-col rounded-2xl border-2 p-6',
                      idx === 1 ? 'border-primary shadow-xl shadow-primary/15' : 'border-border',
                    )}
                  >
                    {idx === 1 ? (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                        Le plus choisi
                      </span>
                    ) : null}
                    <h3 className="font-editorial text-xl font-bold">{plan.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                    <p className="mt-4">
                      <span className="text-3xl font-bold text-primary">{fmtGnf(plan.priceCfa)}</span>
                      <span className="ml-2 text-sm text-muted-foreground">/ {fmtUsd(plan.priceEur)}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.issuesCount} numéro(s) sur {plan.durationMonths} mois
                    </p>
                    <ul className="mt-4 flex-1 space-y-2.5">
                      <li className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        Tous les numéros livrés par email
                      </li>
                      {plan.perks.map((perk) => (
                        <li key={perk} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={cn('mt-5 rounded-full', idx === 1 && 'bg-primary')}
                      variant={idx === 1 ? 'default' : 'outline'}
                      onClick={() => setCheckout({ type: 'SUBSCRIPTION', plan })}
                    >
                      Choisir cette formule
                    </Button>
                  </motion.div>
                ))}
              </div>
            </section>
          ) : null}

          {/* ── Garanties ── */}
          <div className="mt-16 grid gap-4 rounded-2xl border bg-card p-6 sm:grid-cols-3">
            {[
              { Icon: BadgeCheck, title: 'Paiement sécurisé', text: 'Mobile Money, virement ou carte — validé par la rédaction.' },
              { Icon: Mail, title: 'Livraison immédiate', text: 'Le numéro numérique (PDF) arrive par email dès validation.' },
              { Icon: Calendar, title: 'Sans engagement', text: 'Abonnement suspendable à tout moment, sans frais.' },
            ].map(({ Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Détail / aperçu d'un numéro ── */}
      <IssuePreviewDialog
        issue={preview}
        onClose={() => setPreview(null)}
        onBuy={(issue) => {
          setPreview(null);
          setCheckout({ type: 'SINGLE', issue });
        }}
      />

      {/* ── Tunnel d'achat ── */}
      <CheckoutDialog
        checkout={checkout}
        onClose={() => setCheckout(null)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DIALOG — aperçu d'un numéro (pages échantillon)
// ═══════════════════════════════════════════════════════════════
function IssuePreviewDialog({ issue, onClose, onBuy }: {
  issue: ShopIssue | null;
  onClose: () => void;
  onBuy: (issue: ShopIssue) => void;
}) {
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<ShopIssue | null>(null);

  useEffect(() => {
    setDetail(null);
    setPage(0);
    if (!issue) return;
    let cancelled = false;
    publicApi
      .shopIssue(issue.id)
      .then((res) => {
        if (!cancelled) setDetail(res.issue);
      })
      .catch(() => {
        if (!cancelled) setDetail(issue);
      });
    return () => {
      cancelled = true;
    };
  }, [issue]);

  if (!issue) return null;
  const previews = detail?.previewImages ?? [];
  const current = previews[page];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-label={`Aperçu — ${issue.title}`}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">N° {issue.issueNumber}</p>
              <h3 className="font-editorial text-lg font-bold leading-tight">{issue.title}</h3>
            </div>
            <button type="button" onClick={onClose} aria-label="Fermer" className="flex size-9 items-center justify-center rounded-full hover:bg-secondary">
              <X className="size-5" />
            </button>
          </div>

          <div className="grid gap-6 p-5 md:grid-cols-[240px_1fr]">
            {/* Couverture */}
            <div>
              <div className="overflow-hidden rounded-xl border shadow-lg">
                <SmartImage src={issue.coverUrl} alt={issue.title} className="aspect-[3/4] w-full object-cover" fallbackLabel="Réussite" />
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xl font-bold text-primary">{fmtGnf(issue.priceCfa)}</p>
                <p className="text-xs text-muted-foreground">soit {fmtUsd(issue.priceEur)} — version numérique (PDF)</p>
                <Button className="w-full rounded-full" onClick={() => onBuy(issue)}>
                  <ShoppingBag className="size-4" /> Acheter ce numéro
                </Button>
              </div>
            </div>

            {/* Aperçu + description */}
            <div>
              {detail === null ? (
                <div className="skeleton-shimmer h-72 rounded-xl" />
              ) : previews.length > 0 ? (
                <div>
                  <div className="relative overflow-hidden rounded-xl border bg-black/5">
                    {current ? (
                      <img src={current} alt={`Page ${page + 1}`} className="max-h-[26rem] w-full object-contain" />
                    ) : (
                      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">Aperçu indisponible</div>
                    )}
                    {previews.length > 1 ? (
                      <>
                        <button type="button" onClick={() => setPage((p) => (p - 1 + previews.length) % previews.length)} aria-label="Page précédente"
                          className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white">
                          <ChevronLeft className="size-5" />
                        </button>
                        <button type="button" onClick={() => setPage((p) => (p + 1) % previews.length)} aria-label="Page suivante"
                          className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white">
                          <ChevronRight className="size-5" />
                        </button>
                        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[11px] text-white">
                          {page + 1} / {previews.length} · aperçu gratuit
                        </span>
                      </>
                    ) : null}
                  </div>
                  {previews.length > 1 ? (
                    <div className="custom-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
                      {previews.map((img, i) => (
                        <button key={i} type="button" onClick={() => setPage(i)} aria-label={`Aller à la page ${i + 1}`}
                          className={cn('h-16 w-12 shrink-0 overflow-hidden rounded border-2', i === page ? 'border-primary' : 'border-transparent opacity-60 hover:opacity-100')}>
                          <img src={img} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  Aperçu pages non disponible pour ce numéro
                </div>
              )}

              <h4 className="mt-5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Dans ce numéro</h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {issue.description || 'Sommaire détaillé à venir.'}
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════
// DIALOG — tunnel d'achat en 3 étapes
// ═══════════════════════════════════════════════════════════════
type Checkout = { type: 'SINGLE' | 'SUBSCRIPTION'; issue?: ShopIssue; plan?: ShopPlan } | null;

const PAYMENT_METHODS = [
  { key: 'MOBILE_MONEY', label: 'Mobile Money', Icon: Smartphone, hint: 'Orange Money, MTN MoMo' },
  { key: 'BANK_TRANSFER', label: 'Virement bancaire', Icon: Landmark, hint: 'IBAN communiqué par email' },
  { key: 'CARD', label: 'Carte bancaire', Icon: CreditCard, hint: 'Lien sécurisé envoyé par email' },
] as const;

function CheckoutDialog({ checkout, onClose }: { checkout: Checkout; onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({ buyerName: '', buyerEmail: '', buyerPhone: '', currency: 'XOF', paymentMethod: 'MOBILE_MONEY', paymentRef: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ orderNumber: string; amountCfa: number; amountEur: number; currency: string; instructions?: { mobileMoney?: { network: string; number: string }[]; steps: string[] } } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setStep(1);
    setResult(null);
    setFormError(null);
  }, [checkout]);

  if (!checkout) return null;
  const isSingle = checkout.type === 'SINGLE';
  const label = isSingle ? checkout.issue?.title : checkout.plan?.name;
  const amountCfa = isSingle ? checkout.issue!.priceCfa : checkout.plan!.priceCfa;
  const amountEur = isSingle ? checkout.issue!.priceEur : checkout.plan!.priceEur;
  const amount = form.currency === 'EUR' ? fmtUsd(amountEur) : fmtGnf(amountCfa);

  const submit = async () => {
    setBusy(true);
    setFormError(null);
    try {
      const res = await publicApi.createOrder({
        type: checkout.type,
        issueId: isSingle ? checkout.issue!.id : undefined,
        planId: !isSingle ? checkout.plan!.id : undefined,
        buyerName: form.buyerName.trim(),
        buyerEmail: form.buyerEmail.trim(),
        buyerPhone: form.buyerPhone.trim(),
        currency: form.currency,
        paymentMethod: form.paymentMethod,
        paymentRef: form.paymentRef.trim(),
        note: form.note.trim(),
      });
      setResult(res.order ? { ...res.order, instructions: res.instructions } : null);
      setStep(3);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Commande impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={onClose}
        role="dialog"
        aria-label="Commande"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progression */}
          <div className="flex items-center gap-2 border-b px-5 py-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex flex-1 items-center gap-2">
                <span className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  step >= n ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground',
                )}>
                  {step > n ? <Check className="size-3.5" /> : n}
                </span>
                {n < 3 ? <span className={cn('h-0.5 flex-1 rounded', step > n ? 'bg-primary' : 'bg-secondary')} /> : null}
              </div>
            ))}
            <button type="button" onClick={onClose} aria-label="Fermer" className="ml-2 flex size-8 items-center justify-center rounded-full hover:bg-secondary">
              <X className="size-4" />
            </button>
          </div>

          <div className="p-5">
            {/* Étape 1 — récapitulatif */}
            {step === 1 ? (
              <div>
                <h3 className="font-editorial text-lg font-bold">Votre commande</h3>
                <div className="mt-4 flex items-center gap-4 rounded-xl border bg-secondary/40 p-3">
                  {isSingle && checkout.issue?.coverUrl ? (
                    <img src={checkout.issue.coverUrl} alt="" className="h-20 w-14 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-20 w-14 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Package className="size-7" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {isSingle ? `Numéro N° ${checkout.issue?.issueNumber}` : 'Abonnement'}
                    </p>
                    <p className="line-clamp-2 font-editorial text-[15px] font-bold">{label}</p>
                    {!isSingle ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {checkout.plan?.issuesCount} numéro(s) · {checkout.plan?.durationMonths} mois
                      </p>
                    ) : null}
                  </div>
                </div>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Devise</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    { key: 'XOF', label: `Francs guinéens — ${amountCfa}` },
                    { key: 'EUR', label: `Dollars ($ USD) — ${fmtUsd(amountEur)}` },
                  ].map((c) => (
                    <button key={c.key} type="button" onClick={() => setForm((f) => ({ ...f, currency: c.key }))}
                      className={cn('rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition-all',
                        form.currency === c.key ? 'border-primary text-primary' : 'border-border hover:border-primary/40')}>
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl bg-primary/10 px-4 py-3">
                  <span className="text-sm font-medium">Total à payer</span>
                  <span className="text-xl font-bold text-primary">{amount}</span>
                </div>

                <Button className="mt-5 w-full rounded-full" onClick={() => setStep(2)}>
                  Continuer <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : null}

            {/* Étape 2 — coordonnées + paiement */}
            {step === 2 ? (
              <div className="space-y-4">
                <h3 className="font-editorial text-lg font-bold">Vos coordonnées & paiement</h3>
                <div className="grid gap-3">
                  <Input value={form.buyerName} onChange={(e) => setForm((f) => ({ ...f, buyerName: e.target.value }))} placeholder="Nom complet *" aria-label="Nom complet" className="h-11" />
                  <Input type="email" value={form.buyerEmail} onChange={(e) => setForm((f) => ({ ...f, buyerEmail: e.target.value }))} placeholder="Email (réception du numéro) *" aria-label="Email" className="h-11" />
                  <Input type="tel" value={form.buyerPhone} onChange={(e) => setForm((f) => ({ ...f, buyerPhone: e.target.value }))} placeholder="Téléphone (Mobile Money)" aria-label="Téléphone" className="h-11" />
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Moyen de paiement</p>
                  <div className="space-y-2">
                    {PAYMENT_METHODS.map(({ key, label: l, Icon, hint }) => (
                      <button key={key} type="button" onClick={() => setForm((f) => ({ ...f, paymentMethod: key }))}
                        className={cn('flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-all',
                          form.paymentMethod === key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                        <Icon className={cn('size-5', form.paymentMethod === key ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">{l}</span>
                          <span className="block text-xs text-muted-foreground">{hint}</span>
                        </span>
                        {form.paymentMethod === key ? <Check className="size-4 text-primary" /> : null}
                      </button>
                    ))}
                  </div>
                </div>

                <Input value={form.paymentRef} onChange={(e) => setForm((f) => ({ ...f, paymentRef: e.target.value }))}
                  placeholder="Référence de la transaction (si déjà payé)" aria-label="Référence paiement" className="h-11" />
                <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Précisions (adresse de livraison digitale, questions…)" className="min-h-16 text-sm" aria-label="Note" />

                {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-full" onClick={() => setStep(1)}>
                    <ChevronLeft className="size-4" /> Retour
                  </Button>
                  <Button className="flex-[2] rounded-full" onClick={submit} disabled={busy || !form.buyerName.trim() || !form.buyerEmail.trim()}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
                    Valider la commande — {amount}
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Étape 3 — confirmation */}
            {step === 3 && result ? (
              <div className="text-center">
                <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                  <Check className="size-8" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-editorial text-xl font-bold">Commande enregistrée !</h3>
                <p className="mt-1 text-sm text-muted-foreground">Référence à conserver :</p>
                <p className="mt-2 inline-block rounded-lg bg-secondary px-4 py-2 font-mono text-lg font-bold tracking-wider text-primary">
                  {result.orderNumber}
                </p>

                <div className="mt-5 space-y-3 rounded-xl border bg-secondary/40 p-4 text-left">
                  <p className="text-sm font-bold">Finalisez le paiement — {result.currency === 'EUR' ? fmtUsd(result.amountEur) : fmtGnf(result.amountCfa)}</p>
                  {result.instructions?.mobileMoney?.map((m) => (
                    <p key={m.network} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{m.network}</span>
                      <span className="font-bold">{m.number}</span>
                    </p>
                  ))}
                  <ol className="mt-2 list-inside list-decimal space-y-1 text-xs leading-relaxed text-muted-foreground">
                    {result.instructions?.steps.map((st, i) => <li key={i}>{st}</li>)}
                  </ol>
                </div>

                <Button variant="outline" className="mt-5 w-full rounded-full" onClick={onClose}>
                  Terminer
                </Button>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Un problème ? Écrivez à la rédaction depuis la page Contact avec votre référence.
                </p>
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
