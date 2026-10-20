'use client';

// ═══════════════════════════════════════════════════════════════
// NEWSLETTER PAGE — inscription complète : email, nom, centres
// d'intérêt (rubriques racines), confirmation animée, note RGPD.
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Check, Loader2, Mail } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DrawCheck } from '../mag/DrawCheck';
import { isValidEmail } from '../mag/helpers';

export function NewsletterPage() {
  const { t } = useI18n();
  useDocumentTitle(t('newsletterPage.title'));
  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const settings = bootstrap?.settings;
  const { toast } = useToast();
  const roots = (bootstrap?.categories || []).filter((c) => !c.parentId);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const toggleInterest = (name: string) => {
    setInterests((prev) => (prev.includes(name) ? prev.filter((i) => i !== name) : [...prev, name]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast({ title: t('form.invalidEmail'), variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await publicApi.subscribeNewsletter({
        email: email.trim(),
        name: name.trim() || undefined,
        interests: interests.join(', ') || undefined,
        source: 'page',
      });
      setDone(true);
      toast({ title: t('newsletterPage.welcomeTitle'), description: t('newsletterPage.welcomeDesc') });
    } catch (err) {
      toast({
        title: t('form.error'),
        description: err instanceof Error ? err.message : t('form.retryLater'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/85 to-accent p-8 text-primary-foreground sm:p-12">
        <div className="absolute -right-10 -top-10 size-44 rounded-full bg-white/10" aria-hidden="true" />
        <div className="absolute -bottom-14 left-1/3 size-40 rounded-full bg-white/10" aria-hidden="true" />
        <div className="relative">
          <p className="eyebrow opacity-90">{t('footer.newsletter')}</p>
          <h1 className="mt-2 font-editorial text-3xl font-bold leading-tight sm:text-4xl">
            {settings?.newsletterHeroTitle || t('newsletterPage.heroTitleFallback')}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed opacity-90 sm:text-base">
            {settings?.newsletterHeroText || t('newsletterPage.heroTextFallback')}
          </p>
          <div className="mt-5 flex items-center gap-2 text-sm opacity-90">
            <Mail className="size-4" aria-hidden="true" />
            {t('newsletterPage.readers')}
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <Card className="mt-8 p-6 sm:p-8">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <DrawCheck className="size-16" />
            <p className="font-editorial text-2xl font-bold">Inscription confirmée !</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Merci {name.trim() || ''} ! Vous recevrez notre prochaine édition très bientôt.
              Pensez à ajouter notre adresse à vos contacts pour ne rien manquer.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="nl-email">Adresse email *</Label>
                <Input
                  id="nl-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="h-11"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nl-name">Votre nom</Label>
                <Input
                  id="nl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Prénom Nom (optionnel)"
                  className="h-11"
                />
              </div>
            </div>

            {roots.length > 0 ? (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">Vos centres d'intérêt</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {roots.map((cat) => (
                    <label
                      key={cat.id}
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-secondary has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <Checkbox
                        checked={interests.includes(cat.name)}
                        onCheckedChange={() => toggleInterest(cat.name)}
                        aria-label={`Centres d'intérêt : ${cat.name}`}
                      />
                      {interests.includes(cat.name) ? (
                        <Check className="size-4 text-primary" aria-hidden="true" />
                      ) : null}
                      <span className={interests.includes(cat.name) ? 'font-medium' : ''}>{cat.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div>
              <Button type="submit" disabled={busy} className="cta-pulse h-12 rounded-full px-10 font-semibold">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                Je m'abonne
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              En vous inscrivant, vous acceptez de recevoir notre newsletter et notre{' '}
              <a href="#/page/politique-confidentialite" className="text-primary underline underline-offset-2">
                politique de confidentialité
              </a>{' '}
              (RGPD). Vous pourrez vous désinscrire à tout moment via le lien présent dans chaque
              email. Vos données ne sont jamais cédées à des tiers.
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
