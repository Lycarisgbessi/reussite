'use client';

// ═══════════════════════════════════════════════════════════════
// SHARE BUTTONS — Facebook, X, LinkedIn, WhatsApp, Email,
// copier le lien. Intent URLs + micro-animation au clic.
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Facebook, Linkedin, Link2, Mail, MessageCircle, Twitter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ShareButtonsProps {
  title?: string;
  className?: string;
}

export function ShareButtons({ title = '', className }: ShareButtonsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const encUrl = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const items = [
    {
      key: 'facebook',
      label: 'Partager sur Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
      Icon: Facebook,
    },
    {
      key: 'x',
      label: 'Partager sur X',
      href: `https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}`,
      Icon: Twitter,
    },
    {
      key: 'linkedin',
      label: 'Partager sur LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
      Icon: Linkedin,
    },
    {
      key: 'whatsapp',
      label: 'Partager sur WhatsApp',
      href: `https://wa.me/?text=${encTitle}%20${encUrl}`,
      Icon: MessageCircle,
    },
    {
      key: 'email',
      label: 'Partager par email',
      href: `mailto:?subject=${encTitle}&body=${encUrl}`,
      Icon: Mail,
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: 'Lien copié dans le presse-papiers' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Impossible de copier le lien', variant: 'destructive' });
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} aria-label="Partager cet article">
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
        aria-label="Copier le lien de l'article"
        whileTap={{ scale: 0.82 }}
        className="flex size-10 items-center justify-center rounded-full border bg-card text-foreground transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
      >
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      </motion.button>
    </div>
  );
}
