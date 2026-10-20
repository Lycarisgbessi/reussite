'use client';

// ═══════════════════════════════════════════════════════════════
// COOKIE BANNER — consentement RGPD (accepter / refuser),
// mémorisé dans localStorage (bh_cookie_consent).
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Cookie } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

const KEY = 'bh_cookie_consent';

export function CookieBanner() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(KEY);
  });

  if (!visible) return null;

  const decide = (value: 'accepted' | 'refused') => {
    localStorage.setItem(KEY, value);
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur"
      role="dialog"
      aria-label={t('cookie.consentAria')}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-start gap-3">
          <Cookie className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {t('cookie.text')}{' '}
            <a href="#/page/politique-confidentialite" className="text-primary underline underline-offset-2">
              {t('cookie.privacyLink')}
            </a>
            .
          </p>
        </div>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <Button
            variant="outline"
            className="min-h-[44px] flex-1 rounded-full sm:flex-none"
            onClick={() => decide('refused')}
          >
            {t('cookie.refuse')}
          </Button>
          <Button
            className="min-h-[44px] flex-1 rounded-full px-6 sm:flex-none"
            onClick={() => decide('accepted')}
          >
            {t('cookie.acceptAll')}
          </Button>
        </div>
      </div>
    </div>
  );
}
