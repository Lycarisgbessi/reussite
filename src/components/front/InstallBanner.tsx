'use client';

// ═══════════════════════════════════════════════════════════════
// INSTALL BANNER — incitation au téléchargement (PWA) :
// bannière élégante et non intrusive (dismissable, revient après
// 7 jours), déclenche le prompt natif d'installation et propose
// l'activation des notifications push.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellRing, Check, Download, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { isPushEnabled, registerServiceWorker, subscribeToPush } from '@/lib/push';
import { cn } from '@/lib/utils';
import { useBottomLayers, useBottomOffset } from '@/lib/bottomLayers';

const DISMISS_KEY = 'bh_install_dismissed_until';
const COOLDOWN_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

export function InstallBanner() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isDismissed()) return;
    void registerServiceWorker();
    void isPushEnabled().then(setPushOn);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // Petite temporisation : ne pas agresser dès l'arrivée.
      setTimeout(() => setVisible(true), 6000);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // iOS Safari : pas de beforeinstallprompt — on montre quand même
    // la bannière avec les instructions manuelles après 12 s.
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const timer = isIos
      ? setTimeout(() => setVisible(true), 12000)
      : undefined;
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if (timer) clearTimeout(timer);
    };
  }, []);

  const dismiss = (days = COOLDOWN_DAYS) => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + days * 86400_000));
    } catch {
      // localStorage indisponible : simple fermeture pour la session
    }
    setVisible(false);
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
        setVisible(false);
      } else {
        dismiss(2); // refus → revient dans 2 jours
      }
    }
  };

  const enablePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    try {
      await subscribeToPush();
      setPushOn(true);
      setPushMsg(t('pwa.pushOn'));
    } catch (e) {
      setPushMsg(e instanceof Error ? e.message : t('form.error'));
    } finally {
      setPushBusy(false);
    }
  };

  const bottomOffset = useBottomOffset('install');
  const setInstallVisible = useBottomLayers((st) => st.setInstallVisible);
  useEffect(() => { setInstallVisible(visible && !installed); return () => setInstallVisible(false); }, [visible, installed, setInstallVisible]);

  if (installed || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 90, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        style={{ bottom: `${bottomOffset}px` }}
        className="fixed inset-x-0 z-40 px-3 pb-3 md:inset-x-auto md:bottom-4 md:left-4 md:w-96 md:px-0 md:pb-0"
        role="dialog"
        aria-label={t('pwa.bannerAria')}
      >
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card/97 p-4 shadow-2xl backdrop-blur-md">
          <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-primary/10" aria-hidden="true" />
          <button
            type="button"
            onClick={() => dismiss()}
            aria-label={t('ads.close')}
            className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Smartphone className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 pr-6">
              <p className="text-sm font-bold leading-snug">{t('pwa.title')}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('pwa.text')}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {deferred ? (
              <Button size="sm" className="rounded-full" onClick={install}>
                <Download className="size-4" /> {t('pwa.install')}
              </Button>
            ) : (
              <span className="rounded-full border border-dashed px-3 py-1.5 text-[11px] text-muted-foreground">
                {t('pwa.iosHint')}
              </span>
            )}
            <Button
              size="sm"
              variant={pushOn ? 'outline' : 'secondary'}
              className={cn('rounded-full', pushOn && 'gap-1.5')}
              onClick={enablePush}
              disabled={pushBusy || pushOn}
            >
              {pushBusy ? (
                <BellRing className="size-4 animate-pulse" aria-hidden="true" />
              ) : pushOn ? (
                <Check className="size-4 text-emerald-600" aria-hidden="true" />
              ) : (
                <Bell className="size-4" aria-hidden="true" />
              )}
              {pushOn ? t('pwa.pushOnShort') : t('pwa.pushActivate')}
            </Button>
          </div>
          {pushMsg ? <p className="mt-2 text-[11px] text-muted-foreground">{pushMsg}</p> : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
