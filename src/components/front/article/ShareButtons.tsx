'use client';

// ═══════════════════════════════════════════════════════════════
// SHARE BUTTONS — Facebook, X, LinkedIn, WhatsApp, Email,
// copier le lien. Intent URLs + micro-animation au clic.
// MODE ANIMÉ (par défaut) : vague périodique + pulsation pour
// attirer l'œil et inciter au partage — désactivable dans
// Réglages → « Boutons de partage animés ».
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Facebook, Linkedin, Link2, Mail, MessageCircle, Twitter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { useMagazineStore } from '@/lib/store';

interface ShareButtonsProps {
  title?: string;
  className?: string;
}

export function ShareButtons({ title = '', className }: ShareButtonsProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  // Animation activée par défaut, coupable depuis le dashboard
  const animated = settings?.shareButtonsAnimated !== false;
  const [copied, setCopied] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const encUrl = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const items = [
    {
      key: 'facebook',
      label: t('share.facebook'),
      href: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
      Icon: Facebook,
    },
    {
      key: 'x',
      label: t('share.x'),
      href: `https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}`,
      Icon: Twitter,
    },
    {
      key: 'linkedin',
      label: t('share.linkedin'),
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
      Icon: Linkedin,
    },
    {
      key: 'whatsapp',
      label: t('share.whatsapp'),
      href: `https://wa.me/?text=${encTitle}%20${encUrl}`,
      Icon: MessageCircle,
    },
    {
      key: 'email',
      label: t('share.email'),
      href: `mailto:?subject=${encTitle}&body=${encUrl}`,
      Icon: Mail,
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: t('share.copied') });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t('share.copyError'), variant: 'destructive' });
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} aria-label={t('share.aria')}>
      {items.map(({ key, label, href, Icon }) => (
        <motion.a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          whileTap={{ scale: 0.82 }}
          className="flex size-10 items-center justify-center rounded-full border bg-card text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          <Icon className="size-4" />
        </motion.a>
      ))}
      <motion.button
        type="button"
        onClick={copy}
        aria-label={t('share.copy')}
        whileTap={{ scale: 0.82 }}
        whileHover={animated ? { y: -3, scale: 1.08 } : undefined}
        className={cn(
          'flex size-10 items-center justify-center rounded-full border bg-card text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground',
          animated && 'share-wave',
        )}
        style={animated ? { animationDelay: `${items.length * 160}ms` } : undefined}
      >
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      </motion.button>
    </div>
  );
}
