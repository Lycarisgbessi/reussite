'use client';

// ═══════════════════════════════════════════════════════════════
// CHAT WIDGET — assistant de lecture (bouton flottant rouge sang).
// Monté dans FrontOffice ; décalé au-dessus des barres basses.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, MessageCircleQuestion, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { useBottomOffset } from '@/lib/bottomLayers';
import { cn } from '@/lib/utils';

interface Msg {
  role: 'user' | 'bot';
  text: string;
  articles?: { title: string; slug: string; category: string; readingTime: number }[];
}

export function ChatWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'bot',
      text: "Bonjour 👋 Je suis l'assistant de lecture de Réussite Magazine. Décrivez un sujet et je vous trouve les articles correspondants.",
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const offset = useBottomOffset('player');

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const send = async (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const data = (await res.json()) as { reply?: string; articles?: Msg['articles'] };
      setMessages((m) => [...m, { role: 'bot', text: data.reply ?? '…', articles: data.articles }]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: t('form.error') }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Bouton flottant */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('chat.aria')}
        style={{ bottom: `${88 + offset}px` }}
        className="fixed right-3 z-40 flex size-13 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30 transition-transform hover:scale-105 md:right-5"
      >
        {open ? <X className="size-6" /> : <MessageCircleQuestion className="size-6" />}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{ bottom: `${156 + offset}px` }}
            className="fixed right-3 z-40 flex h-[420px] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl md:right-5"
            role="dialog"
            aria-label={t('chat.aria')}
          >
            {/* Entête */}
            <div className="flex items-center gap-2.5 bg-primary px-4 py-3 text-white">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15">
                <Bot className="size-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">Assistant Réussite</p>
                <p className="text-[11px] text-white/75">{t('chat.subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('ads.close')}
                className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/15"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Messages */}
            <div ref={listRef} className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
                      m.role === 'user'
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-secondary text-foreground',
                    )}
                  >
                    {m.text}
                    {m.articles && m.articles.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {m.articles.map((a) => (
                          <li key={a.slug}>
                            <a
                              href={`#/article/${a.slug}`}
                              className="block rounded-lg border bg-card px-3 py-2 text-xs transition-colors hover:border-primary/50 hover:text-primary"
                            >
                              <span className="font-semibold">{a.title}</span>
                              <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                                {a.category} · {a.readingTime} min
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ))}
              {busy ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> …
                </div>
              ) : null}
            </div>

            {/* Suggestions + saisie */}
            <div className="border-t p-2.5">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {['Levée de fonds', 'Interview', 'Intelligence artificielle', 'Export'].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => send(sug)}
                    className="rounded-full border border-dashed px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                  >
                    {sug}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('chat.placeholder')}
                  aria-label={t('chat.placeholder')}
                  className="h-10 flex-1 rounded-full border bg-transparent px-4 text-sm outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
                <Button type="submit" size="icon" className="size-10 shrink-0 rounded-full" disabled={busy} aria-label={t('chat.send')}>
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
