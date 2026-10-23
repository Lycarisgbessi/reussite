'use client';

// ═══════════════════════════════════════════════════════════════
// MAGAZINE ADMIN — Boutique : numéros en vente (couverture, prix,
// aperçu des pages via médiathèque), formules d'abonnement,
// commandes avec validation des paiements.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field } from '../ui/Field';
import { MediaPicker } from '../ui/MediaPicker';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen, Pencil, Plus, Trash2, Loader2, ShoppingBag, PackageCheck,
  CreditCard, Ban, Eye, EyeOff,
} from 'lucide-react';
import { isAuthError, formatDate } from '../ui/helpers';

const fmtGnf = (n: number) => `${(n ?? 0).toLocaleString('fr-FR')} GNF`;

import type { AdminIssue as IssueRow, AdminPlan as PlanRow, AdminOrder as OrderRow } from '@/lib/shopTypes';

const EMPTY_ISSUE = {
  title: '', issueNumber: 1, description: '', coverUrl: '', previewImages: [] as string[],
  priceCfa: 10000, priceEur: 1, pdfUrl: '', previewPages: 5, featured: false, published: true,
};
const EMPTY_PLAN = {
  name: '', description: '', durationMonths: 12, issuesCount: 4,
  priceCfa: 100000, priceEur: 10, perks: [] as string[], active: true,
};

export function MagazineAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [issues, setIssues] = React.useState<IssueRow[] | null>(null);
  const [plans, setPlans] = React.useState<PlanRow[]>([]);
  const [orders, setOrders] = React.useState<OrderRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  // Numéro : dialog
  const [issueDialog, setIssueDialog] = React.useState(false);
  const [editingIssue, setEditingIssue] = React.useState<IssueRow | null>(null);
  const [issueForm, setIssueForm] = React.useState({ ...EMPTY_ISSUE });
  const [deleteIssue, setDeleteIssue] = React.useState<IssueRow | null>(null);
  const [coverPickerOpen, setCoverPickerOpen] = React.useState(false);
  const [uploadingPdf, setUploadingPdf] = React.useState(false);
  const [uploadingCover, setUploadingCover] = React.useState(false);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  // Formule : dialog
  const [planDialog, setPlanDialog] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<PlanRow | null>(null);
  const [planForm, setPlanForm] = React.useState({ ...EMPTY_PLAN });
  const [perkInput, setPerkInput] = React.useState('');
  const [deletePlan, setDeletePlan] = React.useState<PlanRow | null>(null);

  const handleErr = (e: unknown, fallback: string) => {
    if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
    toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : fallback });
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [i, p, o] = await Promise.all([
        adminApi.shopIssues(),
        adminApi.shopPlans(),
        adminApi.shopOrders().catch(() => ({ orders: [] as OrderRow[] })),
      ]);
      setIssues(i.issues);
      setPlans(p.plans);
      setOrders(o.orders);
    } catch (e) {
      handleErr(e, 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  // ─── Numéros ───────────────────────────────────────────────────
  const openIssueCreate = () => { setEditingIssue(null); setIssueForm({ ...EMPTY_ISSUE }); setIssueDialog(true); };
  const openIssueEdit = (i: IssueRow) => {
    setEditingIssue(i);
    setIssueForm({
      title: i.title, issueNumber: i.issueNumber, description: i.description, coverUrl: i.coverUrl,
      previewImages: [...i.previewImages], priceCfa: i.priceCfa, priceEur: i.priceEur,
      pdfUrl: i.pdfUrl, previewPages: i.previewPages ?? 5, featured: i.featured, published: i.published,
    });
    setIssueDialog(true);
  };

  const submitIssue = async () => {
    if (!issueForm.title.trim()) {
      toast({ variant: 'destructive', title: 'Titre requis' });
      return;
    }
    setBusy(true);
    try {
      const payload = { ...issueForm, title: issueForm.title.trim() };
      if (editingIssue) await adminApi.shopUpdateIssue(editingIssue.id, payload);
      else await adminApi.shopCreateIssue(payload);
      toast({ title: editingIssue ? 'Numéro modifié' : 'Numéro créé', description: issueForm.title });
      setIssueDialog(false);
      load();
    } catch (e) {
      handleErr(e, 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  const toggleIssuePublished = async (i: IssueRow, published: boolean) => {
    setIssues((prev) => prev?.map((x) => (x.id === i.id ? { ...x, published } : x)) ?? prev);
    try {
      await adminApi.shopUpdateIssue(i.id, { published });
    } catch (e) {
      handleErr(e, 'Mise à jour impossible.');
      load();
    }
  };

  const doDeleteIssue = async () => {
    if (!deleteIssue) return;
    setBusy(true);
    try {
      await adminApi.shopDeleteIssue(deleteIssue.id);
      toast({ title: 'Numéro supprimé' });
      setDeleteIssue(null);
      load();
    } catch (e) {
      handleErr(e, 'Suppression impossible.');
      setDeleteIssue(null);
    } finally {
      setBusy(false);
    }
  };

  // ─── Formules ──────────────────────────────────────────────────
  const openPlanCreate = () => { setEditingPlan(null); setPlanForm({ ...EMPTY_PLAN }); setPlanDialog(true); };
  const openPlanEdit = (p: PlanRow) => {
    setEditingPlan(p);
    setPlanForm({
      name: p.name, description: p.description, durationMonths: p.durationMonths,
      issuesCount: p.issuesCount, priceCfa: p.priceCfa, priceEur: p.priceEur,
      perks: [...p.perks], active: p.active,
    });
    setPlanDialog(true);
  };

  const submitPlan = async () => {
    if (!planForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Nom requis' });
      return;
    }
    setBusy(true);
    try {
      if (editingPlan) await adminApi.shopUpdatePlan(editingPlan.id, planForm);
      else await adminApi.shopCreatePlan(planForm);
      toast({ title: editingPlan ? 'Formule modifiée' : 'Formule créée' });
      setPlanDialog(false);
      load();
    } catch (e) {
      handleErr(e, 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  };

  // ─── Commandes ─────────────────────────────────────────────────
  const setOrderStatus = async (o: OrderRow, status: 'PAID' | 'CANCELLED') => {
    setOrders((prev) => prev?.map((x) => (x.id === o.id ? { ...x, status } : x)) ?? prev);
    try {
      await adminApi.shopOrderStatus(o.id, status);
      toast({
        title: status === 'PAID' ? 'Paiement validé' : 'Commande annulée',
        description: `${o.orderNumber} — pensez à envoyer le numéro à ${o.buyerEmail}`,
      });
    } catch (e) {
      handleErr(e, 'Mise à jour impossible.');
      load();
    }
  };

  const pendingCount = orders?.filter((o) => o.status === 'PENDING').length ?? 0;
  const paidCount = orders?.filter((o) => o.status === 'PAID').length ?? 0;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="issues" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="issues" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Numéros</TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5"><PackageCheck className="h-3.5 w-3.5" /> Abonnements</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5" /> Commandes
              {pendingCount > 0 ? (
                <Badge className="ml-1 h-4 bg-primary px-1.5 text-[10px] text-white">{pendingCount}</Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={openPlanCreate}><Plus className="h-4 w-4" /> Formule</Button>
            <Button size="sm" onClick={openIssueCreate}><Plus className="h-4 w-4" /> Nouveau numéro</Button>
          </div>
        </div>

        {/* ═══ NUMÉROS ═══ */}
        <TabsContent value="issues" className="mt-0">
          {loading || issues === null ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
            </div>
          ) : issues.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 font-editorial text-lg font-bold">Aucun numéro en vente</p>
              <p className="mt-1 text-sm text-muted-foreground">Créez votre premier numéro : couverture, prix, aperçu des pages.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {issues.map((i) => (
                <div key={i.id} className="flex gap-3 rounded-xl border bg-card p-3">
                  {i.coverUrl ? (
                    <img src={i.coverUrl} alt="" className="h-32 w-22 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div className="flex h-32 w-22 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                      <BookOpen className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-primary">N° {i.issueNumber} · {i.paidOrders} vente(s)</p>
                    <p className="line-clamp-2 font-editorial text-sm font-bold">{i.title}</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{fmtGnf(i.priceCfa)} / {i.priceEur} €</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {i.pdfUrl ? 'PDF ✓' : 'PDF manquant'} · aperçu {i.previewPages ?? 0} page(s)
                    </p>
                    <div className="mt-auto flex items-center gap-1 pt-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openIssueEdit(i)} aria-label="Modifier">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleIssuePublished(i, !i.published)} aria-label={i.published ? 'Dépublier' : 'Publier'}>
                        {i.published ? <Eye className="h-3.5 w-3.5 text-emerald-600" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteIssue(i)} aria-label="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ FORMULES ═══ */}
        <TabsContent value="plans" className="mt-0">
          {plans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <PackageCheck className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 font-editorial text-lg font-bold">Aucune formule d'abonnement</p>
              <p className="mt-1 text-sm text-muted-foreground">Créez au moins une formule pour activer les abonnements.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((p) => (
                <div key={p.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-editorial text-base font-bold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.issuesCount} numéro(s) · {p.durationMonths} mois</p>
                    </div>
                    <p className="shrink-0 font-bold text-primary">{fmtGnf(p.priceCfa)}</p>
                  </div>
                  {p.perks.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {p.perks.map((perk) => <li key={perk} className="text-xs text-muted-foreground">• {perk}</li>)}
                    </ul>
                  ) : null}
                  <div className="mt-3 flex items-center gap-1">
                    <Badge variant={p.active ? 'default' : 'outline'} className={p.active ? 'bg-emerald-600' : ''}>
                      {p.active ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="ml-auto flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPlanEdit(p)} aria-label="Modifier">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletePlan(p)} aria-label="Supprimer">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══ COMMANDES ═══ */}
        <TabsContent value="orders" className="mt-0">
          {orders === null || loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 font-editorial text-lg font-bold">Aucune commande pour le moment</p>
              <p className="mt-1 text-sm text-muted-foreground">Les commandes des visiteurs apparaîtront ici ({paidCount} validée(s) au total).</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-primary">{o.orderNumber}</span>
                      <Badge variant="outline" className="text-[10px]">{o.type === 'SINGLE' ? 'Numéro' : 'Abonnement'}</Badge>
                      {o.status === 'PENDING' ? <Badge className="bg-amber-500 text-[10px] text-white">À valider</Badge> : null}
                      {o.status === 'PAID' ? <Badge className="bg-emerald-600 text-[10px] text-white">Payée</Badge> : null}
                      {o.status === 'CANCELLED' ? <Badge variant="destructive" className="text-[10px]">Annulée</Badge> : null}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold">{o.item}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.buyerName} · {o.buyerEmail}{o.buyerPhone ? ` · ${o.buyerPhone}` : ''} — {o.currency === 'EUR' ? `${o.amountEur} €` : fmtGnf(o.amountCfa)}
                      {' '}· {formatDate(o.createdAt, true)}
                    </p>
                    {o.paymentRef ? <p className="text-xs text-muted-foreground">Réf. paiement : {o.paymentRef}</p> : null}
                  </div>
                  {o.status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setOrderStatus(o, 'PAID')}>
                        <PackageCheck className="h-3.5 w-3.5" /> Valider
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setOrderStatus(o, 'CANCELLED')}>
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Dialog Numéro ─── */}
      <Dialog open={issueDialog} onOpenChange={setIssueDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-editorial">{editingIssue ? 'Modifier le numéro' : 'Nouveau numéro en vente'}</DialogTitle>
            <DialogDescription>Couverture, PDF du numéro, prix et sommaire. L'aperçu boutique se génère automatiquement depuis le PDF.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Titre du numéro" required className="sm:col-span-2">
                <Input value={issueForm.title} onChange={(e) => setIssueForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex. Réussite — N°12 : Cap sur l'avenir" />
              </Field>
              <Field label="N° de parution">
                <Input type="number" min={1} value={issueForm.issueNumber} onChange={(e) => setIssueForm((f) => ({ ...f, issueNumber: Number(e.target.value) || 1 }))} />
              </Field>
              <Field label="Prix en francs guinéens (GNF)">
                <Input type="number" min={0} value={issueForm.priceCfa} onChange={(e) => setIssueForm((f) => ({ ...f, priceCfa: Number(e.target.value) || 0 }))} />
              </Field>
              <Field label="Prix en dollars ($ USD)">
                <Input type="number" min={0} value={issueForm.priceEur} onChange={(e) => setIssueForm((f) => ({ ...f, priceEur: Number(e.target.value) || 0 }))} />
              </Field>
              <Field label="PDF du numéro (livré après paiement)" hint="Fichier PDF importé vers Cloudinary (50 Mo max). L'acheteur le reçoit dès validation du paiement.">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                          toast({ variant: 'destructive', title: 'Format invalide', description: 'Seuls les fichiers PDF sont acceptés.' });
                          return;
                        }
                        setUploadingPdf(true);
                        adminApi.uploadPdf(file)
                          .then((r) => {
                            setIssueForm((f) => ({ ...f, pdfUrl: r.url }));
                            toast({ title: 'PDF importé', description: `${Math.max(1, Math.round((r.bytes / 1024 / 1024) * 10) / 10)} Mo — prêt à être livré aux acheteurs.` });
                          })
                          .catch((err) => handleErr(err, 'Import impossible.'))
                          .finally(() => setUploadingPdf(false));
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={uploadingPdf} onClick={() => pdfInputRef.current?.click()}>
                      {uploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                      {issueForm.pdfUrl ? 'Remplacer le PDF' : 'Importer le PDF'}
                    </Button>
                    {issueForm.pdfUrl ? (
                      <>
                        <span className="text-xs font-medium text-emerald-600">PDF attaché ✓</span>
                        <a href={issueForm.pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline underline-offset-2">
                          Vérifier le fichier
                        </a>
                      </>
                    ) : null}
                  </div>
                  <Input value={issueForm.pdfUrl} onChange={(e) => setIssueForm((f) => ({ ...f, pdfUrl: e.target.value }))} placeholder="https://… (ou utilisez le bouton d'import ci-dessus)" />
                </div>
              </Field>
              <Field label="Pages d'aperçu gratuites (générées depuis le PDF)" hint="Aucune image à importer : la boutique affiche elle-même les X premières pages du PDF. Ex. 5 = pages 1 à 5 visibles, le reste réservé aux acheteurs. 0 = aucun aperçu.">
                <Input type="number" min={0} max={50} value={issueForm.previewPages}
                  onChange={(e) => setIssueForm((f) => ({ ...f, previewPages: Math.min(50, Math.max(0, Number(e.target.value) || 0)) }))} />
              </Field>
            </div>

            <Field label="Couverture" hint="Importez la une : elle alimente automatiquement le carrousel du header du site.">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  {issueForm.coverUrl ? (
                    <img src={issueForm.coverUrl} alt="" className="h-24 w-16 rounded-md border object-cover" />
                  ) : (
                    <div className="flex h-24 w-16 items-center justify-center rounded-md border border-dashed text-muted-foreground"><BookOpen className="h-5 w-5" /></div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (!file.type.startsWith('image/')) {
                          toast({ variant: 'destructive', title: 'Format invalide', description: 'Seules les images sont acceptées.' });
                          return;
                        }
                        setUploadingCover(true);
                        adminApi.uploadMedia(file, { alt: `Couverture — ${issueForm.title || 'numéro'}` })
                          .then(({ media }) => {
                            setIssueForm((f) => ({ ...f, coverUrl: media.url }));
                            toast({ title: 'Couverture importée', description: 'Elle apparaîtra dans le carrousel du header après enregistrement.' });
                          })
                          .catch((err) => handleErr(err, 'Import impossible.'))
                          .finally(() => setUploadingCover(false));
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" disabled={uploadingCover} onClick={() => coverInputRef.current?.click()}>
                      {uploadingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {issueForm.coverUrl ? 'Remplacer l\u2019image' : 'Importer depuis mon ordinateur'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCoverPickerOpen(true)}>
                      Ou choisir dans la médiathèque
                    </Button>
                  </div>
                </div>
              </div>
            </Field>

            <Field label="Sommaire / description">
              <Textarea value={issueForm.description} onChange={(e) => setIssueForm((f) => ({ ...f, description: e.target.value }))} className="min-h-28 text-sm" placeholder="Les grands dossier de ce numéro…" />
            </Field>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={issueForm.featured} onCheckedChange={(v) => setIssueForm((f) => ({ ...f, featured: v }))} aria-label="À la une boutique" />
                À la une de la boutique
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={issueForm.published} onCheckedChange={(v) => setIssueForm((f) => ({ ...f, published: v }))} aria-label="En vente" />
                En vente
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialog(false)}>Annuler</Button>
            <Button onClick={submitIssue} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Formule ─── */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-editorial">{editingPlan ? 'Modifier la formule' : 'Nouvelle formule d’abonnement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Nom" required>
              <Input value={planForm.name} onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex. Abonnement Annuel" />
            </Field>
            <Field label="Description">
              <Input value={planForm.description} onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ex. 4 numéros par an, livrés par email" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre de numéros">
                <Input type="number" min={1} value={planForm.issuesCount} onChange={(e) => setPlanForm((f) => ({ ...f, issuesCount: Number(e.target.value) || 1 }))} />
              </Field>
              <Field label="Durée (mois)">
                <Input type="number" min={1} value={planForm.durationMonths} onChange={(e) => setPlanForm((f) => ({ ...f, durationMonths: Number(e.target.value) || 1 }))} />
              </Field>
              <Field label="Prix en francs guinéens (GNF)">
                <Input type="number" min={0} value={planForm.priceCfa} onChange={(e) => setPlanForm((f) => ({ ...f, priceCfa: Number(e.target.value) || 0 }))} />
              </Field>
              <Field label="Prix en dollars ($ USD)">
                <Input type="number" min={0} value={planForm.priceEur} onChange={(e) => setPlanForm((f) => ({ ...f, priceEur: Number(e.target.value) || 0 }))} />
              </Field>
            </div>
            <Field label="Avantages inclus" hint="Appuyez sur Entrée pour ajouter.">
              <Input
                value={perkInput}
                onChange={(e) => setPerkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const v = perkInput.trim();
                    if (v && !planForm.perks.includes(v)) setPlanForm((f) => ({ ...f, perks: [...f.perks, v] }));
                    setPerkInput('');
                  }
                }}
                placeholder="Ex. Accès aux archives numériques"
              />
              {planForm.perks.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {planForm.perks.map((perk) => (
                    <Badge key={perk} variant="outline" className="gap-1 bg-accent">
                      {perk}
                      <button type="button" onClick={() => setPlanForm((f) => ({ ...f, perks: f.perks.filter((x) => x !== perk) }))} aria-label={`Retirer ${perk}`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={planForm.active} onCheckedChange={(v) => setPlanForm((f) => ({ ...f, active: v }))} aria-label="Active" />
              Formule active (visible en boutique)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(false)}>Annuler</Button>
            <Button onClick={submitPlan} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pickers */}
      <MediaPicker
        open={coverPickerOpen}
        onOpenChange={setCoverPickerOpen}
        onSelect={(m) => { setIssueForm((f) => ({ ...f, coverUrl: m.url })); setCoverPickerOpen(false); }}
        title="Couverture du numéro"
      />
      

      {/* Confirmations */}
      <ConfirmDialog
        open={deleteIssue !== null}
        onOpenChange={(o) => { if (!o) setDeleteIssue(null); }}
        title="Supprimer ce numéro ?"
        description={`« ${deleteIssue?.title} » sera retiré de la boutique. Les commandes déjà passées sont conservées.`}
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={doDeleteIssue}
      />
      <ConfirmDialog
        open={deletePlan !== null}
        onOpenChange={(o) => { if (!o) setDeletePlan(null); }}
        title="Supprimer cette formule ?"
        description={`« ${deletePlan?.name} » ne sera plus proposée en abonnement.`}
        confirmLabel="Supprimer"
        loading={busy}
        onConfirm={async () => {
          if (!deletePlan) return;
          setBusy(true);
          try {
            await adminApi.shopDeletePlan(deletePlan.id);
            toast({ title: 'Formule supprimée' });
            setDeletePlan(null);
            load();
          } catch (e) {
            handleErr(e, 'Suppression impossible.');
            setDeletePlan(null);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}
