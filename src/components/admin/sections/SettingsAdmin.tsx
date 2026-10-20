'use client';

// ═══════════════════════════════════════════════════════════════
// SETTINGS ADMIN — Réglages du site : général, contact, réseaux
// sociaux, SEO, fonctionnalités (switchs), partenaires.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { SiteSettings } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { MediaPicker } from '../ui/MediaPicker';
import { Field } from '../ui/Field';
import { isAuthError } from '../ui/helpers';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Building2, Phone, MapPin, Clock, Share2, Search, SlidersHorizontal, Handshake, Facebook, Twitter, Linkedin, Youtube, MessageCircle, Bell, Send } from 'lucide-react';

const THEME_PRESETS = ['#d97706', '#16a34a', '#dc2626', '#ea580c', '#7c3aed', '#0d9488', '#52525b'];

/** Switch réutilisable pour l'onglet Fonctionnalités. */
function FeatureSwitch({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-accent/40">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

export function SettingsAdmin() {
  const { toast } = useToast();
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);

  const [settings, setSettings] = React.useState<SiteSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await adminApi.settings();
        if (mounted) setSettings(r.settings);
      } catch (e) {
        if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
        toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Réglages indisponibles.' });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
     
  }, []);

  const patch = (p: Partial<SiteSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...p } : prev));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { settings: saved } = await adminApi.saveSettings(settings);
      setSettings(saved);
      toast({ title: 'Réglages enregistrés', description: 'Les modifications sont visibles sur le site.' });
    } catch (e) {
      if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="general" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="general" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> Général</TabsTrigger>
          <TabsTrigger value="contact" className="gap-1.5"><Phone className="h-3.5 w-3.5" /> Contact</TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5"><Share2 className="h-3.5 w-3.5" /> Réseaux</TabsTrigger>
          <TabsTrigger value="seo" className="gap-1.5"><Search className="h-3.5 w-3.5" /> SEO</TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Fonctionnalités</TabsTrigger>
          <TabsTrigger value="partners" className="gap-1.5"><Handshake className="h-3.5 w-3.5" /> Partenaires</TabsTrigger>
          <TabsTrigger value="push" className="gap-1.5"><Bell className="h-3.5 w-3.5" /> Notifications</TabsTrigger>
        </TabsList>
        <Button size="sm" className="ml-auto" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Enregistrer
        </Button>
      </div>

      {/* ═══ GÉNÉRAL ═══ */}
      <TabsContent value="general" className="mt-0">
        <div className="max-w-2xl space-y-4 rounded-xl border border-border/70 bg-card p-5">
          <Field label="Nom du site">
            <Input value={settings.siteName} onChange={(e) => patch({ siteName: e.target.value })} />
          </Field>
          <Field label="Slogan / tagline" hint="Affiché sous le logo dans l’en-tête du site.">
            <Input value={settings.tagline} onChange={(e) => patch({ tagline: e.target.value })} />
          </Field>
          <Field label="Texte du logo" hint="Version courte affichée sur mobile.">
            <Input value={settings.logoText} onChange={(e) => patch({ logoText: e.target.value })} />
          </Field>
          <Field label="À propos (pied de page)">
            <Textarea value={settings.footerAbout} onChange={(e) => patch({ footerAbout: e.target.value })} className="min-h-24 text-sm" placeholder="Présentation courte du magazine…" />
          </Field>
          <Field label="Couleur principale" hint="Personnalisez l’accent du site (ambre par défaut).">
            <div className="flex flex-wrap items-center gap-2">
              {THEME_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => patch({ themeColor: c })}
                  aria-label={`Couleur ${c}`}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                    settings.themeColor === c ? 'border-foreground shadow-md' : 'border-transparent',
                  )}
                  style={{ background: c }}
                />
              ))}
              <Input type="color" value={settings.themeColor} onChange={(e) => patch({ themeColor: e.target.value })} className="h-7 w-10 cursor-pointer p-0.5" aria-label="Couleur personnalisée" />
            </div>
          </Field>
        </div>
      </TabsContent>

      {/* ═══ CONTACT ═══ */}
      <TabsContent value="contact" className="mt-0">
        <div className="max-w-2xl space-y-4 rounded-xl border border-border/70 bg-card p-5">
          <p className="text-sm text-muted-foreground">
            Ces informations sont répercutées partout automatiquement : page contact, pied de page, e-mails.
          </p>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail de contact">
              <Input type="email" value={settings.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })} placeholder="contact@reussitemagazine.com" />
            </Field>
            <Field label="Téléphone">
              <Input value={settings.contactPhone} onChange={(e) => patch({ contactPhone: e.target.value })} placeholder="+33 1 23 45 67 89" />
            </Field>
          </div>
          <Field label="Adresse">
            <div className="relative">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Textarea value={settings.contactAddress} onChange={(e) => patch({ contactAddress: e.target.value })} className="min-h-16 pl-8 text-sm" placeholder="12 rue de la Bourse, 75002 Paris" />
            </div>
          </Field>
          <Field label="Horaires" hint="Ex : Lun-Ven 9h-18h">
            <div className="relative">
              <Clock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={settings.contactHours} onChange={(e) => patch({ contactHours: e.target.value })} className="pl-8" placeholder="Lun-Ven 9h-18h" />
            </div>
          </Field>
        </div>
      </TabsContent>

      {/* ═══ RÉSEAUX SOCIAUX ═══ */}
      <TabsContent value="social" className="mt-0">
        <div className="max-w-2xl space-y-4 rounded-xl border border-border/70 bg-card p-5">
          {([
            { key: 'facebook', label: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/reussitemagazine' },
            { key: 'twitter', label: 'Twitter / X', icon: Twitter, placeholder: 'https://x.com/reussitemagazine' },
            { key: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/company/reussite-magazine' },
            { key: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@reussitemagazine' },
            { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, placeholder: 'https://wa.me/33612345678' },
          ] as const).map(({ key, label, icon: Icon, placeholder }) => (
            <Field key={key} label={label} hint="Laissez vide pour masquer le lien.">
              <div className="relative">
                <Icon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={settings[key]}
                  onChange={(e) => patch({ [key]: e.target.value } as Partial<SiteSettings>)}
                  placeholder={placeholder}
                  className="pl-8"
                />
              </div>
            </Field>
          ))}
        </div>
      </TabsContent>

      {/* ═══ SEO ═══ */}
      <TabsContent value="seo" className="mt-0">
        <div className="max-w-2xl space-y-4 rounded-xl border border-border/70 bg-card p-5">
          <Field label="Titre SEO (accueil)" counter={<span className={cn(settings.seoTitle.length > 60 && 'text-destructive')}>{settings.seoTitle.length}/60</span>}>
            <Input value={settings.seoTitle} onChange={(e) => patch({ seoTitle: e.target.value })} />
          </Field>
          <Field label="Méta description" counter={<span className={cn(settings.seoDescription.length > 160 && 'text-destructive')}>{settings.seoDescription.length}/160</span>}>
            <Textarea value={settings.seoDescription} onChange={(e) => patch({ seoDescription: e.target.value })} className="min-h-24 text-sm" />
          </Field>
          <Field label="Image Open Graph" hint="Affichée lors des partages sur les réseaux sociaux (1200×630 recommandé).">
            <div className="flex items-center gap-3">
              {settings.ogImage ? (
                 
                <img src={settings.ogImage} alt="Image Open Graph" className="h-16 w-28 rounded-md border border-border/60 object-cover" />
              ) : (
                <div className="flex h-16 w-28 items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground">1200×630</div>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                {settings.ogImage ? 'Changer l’image' : 'Choisir une image'}
              </Button>
              {settings.ogImage ? (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => patch({ ogImage: '' })}>Retirer</Button>
              ) : null}
            </div>
          </Field>
        </div>
      </TabsContent>

      {/* ═══ FONCTIONNALITÉS ═══ */}
      <TabsContent value="features" className="mt-0">
        <div className="max-w-2xl space-y-4">
          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-5">
            <p className="text-sm font-semibold">Interactions &amp; contenu</p>
            <FeatureSwitch label="Commentaires" description="Autoriser les lecteurs à commenter les articles." checked={settings.commentsEnabled} onChange={(v) => patch({ commentsEnabled: v })} />
            <FeatureSwitch label="Mode sombre" description="Bascule clair/sombre pour les visiteurs." checked={settings.darkModeEnabled} onChange={(v) => patch({ darkModeEnabled: v })} />
            <FeatureSwitch label="Comptes lecteurs" description="Favoris et personnalisation pour les lecteurs." checked={settings.readerAccountsEnabled} onChange={(v) => patch({ readerAccountsEnabled: v })} />
            <FeatureSwitch label="Flash info" description="Bandeau défilant en haut du site." checked={settings.flashInfoEnabled} onChange={(v) => patch({ flashInfoEnabled: v })} />
            <FeatureSwitch label="Popup newsletter" description="Invite à l’inscription (réglages dans « Page d’accueil »)." checked={settings.newsletterPopupEnabled} onChange={(v) => patch({ newsletterPopupEnabled: v })} />
          </div>
          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-5">
            <p className="text-sm font-semibold">Publicité — zones affichées</p>
            <FeatureSwitch label="Bannière en-tête" checked={settings.adsHeaderEnabled} onChange={(v) => patch({ adsHeaderEnabled: v })} />
            <FeatureSwitch label="Colonne latérale" checked={settings.adsSidebarEnabled} onChange={(v) => patch({ adsSidebarEnabled: v })} />
            <FeatureSwitch label="Dans l’article" checked={settings.adsInArticleEnabled} onChange={(v) => patch({ adsInArticleEnabled: v })} />
            <FeatureSwitch label="Bannière pied de page" checked={settings.adsFooterEnabled} onChange={(v) => patch({ adsFooterEnabled: v })} />
            <FeatureSwitch label="Bandeau mobile collant" checked={settings.adsStickyMobileEnabled} onChange={(v) => patch({ adsStickyMobileEnabled: v })} />
            <FeatureSwitch label="Contenu sponsorisé (natif)" checked={settings.adsNativeEnabled} onChange={(v) => patch({ adsNativeEnabled: v })} />
            <FeatureSwitch label="Interstitiel" checked={settings.adsInterstitialEnabled} onChange={(v) => patch({ adsInterstitialEnabled: v })} />
          </div>
        </div>
      </TabsContent>

      {/* ═══ PARTENAIRES ═══ */}
      <TabsContent value="partners" className="mt-0">
        <div className="max-w-2xl space-y-4 rounded-xl border border-border/70 bg-card p-5">
          <Field label="Titre de la section">
            <Input value={settings.partnersTitle} onChange={(e) => patch({ partnersTitle: e.target.value })} placeholder="Ils nous font confiance" />
          </Field>
          <Field
            label="Logos partenaires"
            hint="Un partenaire par ligne : texte seul (« Acme Corp ») ou nom + URL d’image (« Acme Corp | https://…/logo.png »)."
          >
            <Textarea
              value={settings.partnersLogos}
              onChange={(e) => patch({ partnersLogos: e.target.value })}
              className="min-h-32 font-mono text-xs"
              placeholder={'Acme Corp | https://exemple.com/logo.png\nBanque Populaire\nTechFund'}
            />
          </Field>
          {settings.partnersLogos.trim() ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Aperçu ({settings.partnersLogos.split('\n').filter((l) => l.trim()).length} partenaire(s))</p>
              <div className="flex flex-wrap gap-2">
                {settings.partnersLogos.split('\n').filter((l) => l.trim()).map((line, i) => {
                  const [name, url] = line.split('|').map((s) => s.trim());
                  return (
                    <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs">
                      {url ? (
                         
                        <img src={url} alt="" className="h-4 w-10 object-contain" />
                      ) : null}
                      {name || url || '—'}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </TabsContent>

      <TabsContent value="push" className="mt-0">
        <PushPanel />
      </TabsContent>

      <MediaPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(m) => { patch({ ogImage: m.url }); setPickerOpen(false); }} title="Image Open Graph" />
    </Tabs>
  );
}

// ─── Onglet Notifications push ────────────────────────────────
function PushPanel() {
  const { toast } = useToast();
  const [form, setForm] = React.useState({ title: '', body: '', url: '' });
  const [busy, setBusy] = React.useState(false);

  const send = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast({ variant: 'destructive', title: 'Champs requis', description: 'Le titre et le message sont obligatoires.' });
      return;
    }
    setBusy(true);
    try {
      const r = await adminApi.sendPush({
        title: form.title.trim(),
        body: form.body.trim(),
        url: form.url.trim() || undefined,
      });
      toast({
        title: 'Notification envoyée',
        description: r.sent > 0
          ? `Diffusée à ${r.sent} abonné(s)${r.removed > 0 ? ` (${r.removed} abonnement(s) obsolète(s) purgé(s))` : ''}.`
          : 'Aucun abonné pour le moment — les visiteurs peuvent s’abonner depuis la bannière de l’application.',
      });
      setForm({ title: '', body: '', url: '' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'Envoi impossible',
        description:
          e instanceof Error && e.message.includes('503')
            ? 'Notifications non configurées : générez les clés VAPID (voir CONFIGURATION.md) puis redémarrez.'
            : e instanceof Error
              ? e.message
              : 'Réessayez plus tard.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <p className="text-sm font-semibold">Notifications push</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Chaque nouvelle publication (article, vidéo, podcast) est envoyée automatiquement aux
          abonnés. Utilisez ce formulaire pour diffuser un message manuel (annonce, événement…).
        </p>
      </div>
      <Field label="Titre">
        <Input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Réussite Magazine"
          aria-label="Titre de la notification"
        />
      </Field>
      <Field label="Message">
        <Textarea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="Le nouveau numéro est disponible !"
          className="min-h-20"
          aria-label="Message de la notification"
        />
      </Field>
      <Field label="URL d’ouverture (optionnel)" hint="Page ouverte lorsque l’abonné clique sur la notification.">
        <Input
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="/#/article/mon-article"
          aria-label="URL d’ouverture de la notification"
        />
      </Field>
      <Button onClick={send} disabled={busy} className="rounded-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Envoyer la notification
      </Button>
    </div>
  );
}
