'use client';

// ═══════════════════════════════════════════════════════════════
// NEWSLETTER POPUP — déclencheurs TIME / SCROLL / EXIT,
// fréquence SESSION / DAY / WEEK / ALWAYS (config du bootstrap).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { Loader2, Mail, Send } from 'lucide-react';
import { useMagazineStore } from '@/lib/store';
import { publicApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DrawCheck } from './mag/DrawCheck';
import { isValidEmail } from './mag/helpers';
import type { NewsletterPopupConfig } from '@/lib/types';

const LAST_KEY = 'bh_popup_last';

function shouldShowAccordingToFrequency(freq: NewsletterPopupConfig['frequency']): boolean {
  const last = localStorage.getItem(LAST_KEY);
  if (freq === 'ALWAYS') return true;
  if (!last) return true;
  if (freq === 'SESSION') return sessionStorage.getItem(LAST_KEY) !== '1';
  const lastTime = new Date(last).getTime();
  if (Number.isNaN(lastTime)) return true;
  const elapsed = Date.now() - lastTime;
  if (freq === 'DAY') {
    const now = new Date();
    const lastDate = new Date(last);
    return now.toDateString() !== lastDate.toDateString();
  }
  if (freq === 'WEEK') return elapsed > 7 * 24 * 3600 * 1000;
  return true;
}

export function NewsletterPopup() {
  const bootstrap = useMagazineStore((s) => s.bootstrap);
  const { toast } = useToast();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const shownRef = useRef(false);

  const popup: NewsletterPopupConfig | undefined = bootstrap?.popup;
  const enabled = Boolean(popup?.enabled);

  useEffect(() => {
    if (!enabled || !popup || shownRef.current) return;
    if (!shouldShowAccordingToFrequency(popup.frequency)) return;

    const show = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      localStorage.setItem(LAST_KEY, new Date().toISOString());
      if (popup.frequency === 'SESSION') sessionStorage.setItem(LAST_KEY, '1');
      setOpen(true);
    };

    if (popup.trigger === 'TIME') {
      const t = setTimeout(show, Math.max(1, popup.delaySeconds || 8) * 1000);
      return () => clearTimeout(t);
    }
    if (popup.trigger === 'SCROLL') {
      const threshold = Math.min(95, Math.max(5, popup.scrollPercent || 40));
      const onScroll = () => {
        const total = document.documentElement.scrollHeight - window.innerHeight;
        const pct = total > 0 ? (window.scrollY / total) * 100 : 0;
        if (pct >= threshold) {
          show();
          window.removeEventListener('scroll', onScroll);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }
    // EXIT — sortie de page (souris au-dessus du viewport)
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) show();
    };
    document.addEventListener('mouseout', onMouseOut);
    return () => document.removeEventListener('mouseout', onMouseOut);
  }, [enabled, popup]);

  if (!enabled || !popup) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      toast({ title: t('form.invalidEmail'), variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await publicApi.subscribeNewsletter({ email: email.trim(), source: 'popup' });
      setSuccess(true);
      toast({ title: t('newsletter.welcomeTitle'), description: t('newsletter.confirmDesc') });
      setTimeout(() => setOpen(false), 2200);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('newsletter.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('newsletter.dialogDesc')}</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2">
          {/* Panneau visuel */}
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary/80 to-accent sm:block">
            <div
              className="absolute -left-8 -top-8 size-40 rounded-full bg-white/10"
              aria-hidden="true"
            />
            <div
              className="absolute bottom-6 right-4 size-24 rounded-full bg-white/10"
              aria-hidden="true"
            />
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-primary-foreground">
              <Mail className="size-14" aria-hidden="true" />
              <p className="font-editorial text-2xl font-bold leading-snug">
                Business
                <br />
                Horizon
              </p>
              <p className="text-center text-xs uppercase tracking-[0.2em] opacity-80">
                {t('newsletter.tagline')}
              </p>
            </div>
          </div>

          {/* Formulaire */}
          <div className="flex flex-col justify-center p-6 sm:p-8">
            {success ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <DrawCheck className="size-14" />
                <p className="font-editorial text-lg font-bold">{t('newsletter.successTitle')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('newsletter.successDesc')}
                </p>
              </div>
            ) : (
              <>
                <h3 className="font-editorial text-xl font-bold leading-snug">
                  {popup.title || "Recevez l'essentiel chaque semaine"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {popup.text ||
                    "Analyses, interviews et décryptages business, directement dans votre boîte mail."}
                </p>
                <form onSubmit={submit} className="mt-5 space-y-3">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('form.emailPlaceholder')}
                    aria-label={t('article.emailLabel')}
                    className="h-11"
                  />
                  <Button type="submit" disabled={busy} className="cta-pulse h-11 w-full rounded-full font-semibold">
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    {t('home.subscribeCta')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="w-full rounded-full py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t('newsletter.noThanks')}
                  </button>
                </form>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {t('newsletter.footnote')}
                </p>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
