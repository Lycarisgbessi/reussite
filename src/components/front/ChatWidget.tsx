'use client';

// ═══════════════════════════════════════════════════════════════
// CHAT WIDGET — assistant CONVERSATIONNEL (bouton flottant rouge).
// Menu dédié 🧭 : l'utilisateur choisit une intention sans taper
// (recommandations, prix, contact, abonnement, podcasts…).
// Réponses rapides suggérées après chaque message du bot, indicateur
// « écrit… », liens d'articles cliquables. Monté dans FrontOffice.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Compass, Loader2, MessageCircleQuestion, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { useBottomOffset } from '@/lib/bottomLayers';
import { cn } from '@/lib/utils';

interface Msg {
  role: 'user' | 'bot';
  text: string;
  articles?: { title: string; slug: string; category: string; readingTime: number }[];
  quickReplies?: string[];
}

/** Menu principal du chatbot — navigation guidée. */
const MENU_ITEMS: { label: string; query: string; emoji: string; desc: string }[] = [
  { label: 'Recommandations', query: 'Recommande-moi un article', emoji: '📖', desc: 'Trouver un article à lire' },
  { label: 'Prix & abonnement', query: 'Combien coûte le magazine ?', emoji: '🛒', desc: 'Numérique, papier, formules' },
  { label: 'Aperçu gratuit', query: 'Aperçu gratuit ?', emoji: '👁️', desc: 'Feuilleter les premières pages' },
  { label: 'Livraison', query: 'Comment se passe la livraison ?', emoji: '📦', desc: 'Version papier à domicile' },
  { label: 'Contact', query: 'Comment vous contacter ?', emoji: '📞', desc: 'Joindre la rédaction' },
  { label: 'Rubriques', query: 'Quelles sont vos rubriques ?', emoji: '🗂️', desc: 'Explorer les thèmes' },
  { label: 'Podcasts', query: 'Podcasts', emoji: '🎧', desc: 'Nos derniers épisodes' },
  { label: 'Aide', query: 'Comment ça marche ?', emoji: '💡', desc: 'Ce que je sais faire' },
];

export function ChatWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'bot',
      text: "Bonjour 👋 Je suis l'assistant de Réussite Magazine. Posez-moi vos questions (prix, abonnement, contact…) ou laissez-vous guider par le menu 🧭 — je recommande aussi des articles à lire !",
      quickReplies: ['Recommande-moi un article', 'Prix du magazine', 'Contact'],
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const offset = useBottomOffset('player');

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, menuOpen]);

  const send = async (raw?: string) => {
    const q = (raw ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setMenuOpen(false);
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const data = (await res.json()) as { reply?: string; articles?: Msg['articles']; quickReplies?: string[] };
      // Petite respiration « humaine » pour la réponse
      await new Promise((r) => setTimeout(r, 350));
      setMessages((m) => [
        ...m,
        { role: 'bot', text: data.reply ?? '…', articles: data.articles, quickReplies: data.quickReplies },
      ]);
    } catch {
      setMessages((m) => [...m, { role: 'bot', text: t('form.error') }]);
    } finally {
      setBusy(false);
    }
  };

  // Dernières réponses rapides à proposer (celles du dernier message bot)
  const lastQuickReplies = [...messages].reverse().find((m) => m.role === 'bot')?.quickReplies ?? [];

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
            className="fixed right-3 z-40 flex h-[460px] w-[calc(100vw-1.5rem)] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl md:right-5"
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
                <p className="flex items-center gap-1.5 text-[11px] text-white/75">
                  <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  En ligne · répond en quelques secondes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu de l'assistant"
                aria-pressed={menuOpen}
                className={cn(
                  'flex size-7 items-center justify-center rounded-full transition-colors',
                  menuOpen ? 'bg-white/25' : 'hover:bg-white/15',
                )}
              >
                <Compass className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('ads.close')}
                className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-white/15"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* ── MENU DÉDIÉ (volet guidé) ── */}
            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b bg-secondary/60"
                >
                  <div className="p-2.5">
                    <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Menu — que puis-je faire pour vous ?
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {MENU_ITEMS.map(({ label, query, emoji, desc }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => send(query)}
                          className="group flex flex-col items-start rounded-xl border bg-card px-2.5 py-2 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                        >
                          <span className="text-sm">{emoji}</span>
                          <span className="text-[12px] font-bold leading-tight group-hover:text-primary">{label}</span>
                          <span className="text-[10px] leading-tight text-muted-foreground">{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

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
                <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-3" aria-label="L'assistant écrit">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="size-1.5 rounded-full bg-muted-foreground/60"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.7, repeat: Infinity, delay: d * 0.15 }}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {/* Réponses rapides suggérées + saisie */}
            <div className="border-t p-2.5">
              {lastQuickReplies.length > 0 && !busy ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {lastQuickReplies.slice(0, 4).map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => send(sug)}
                      className="rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/10"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              ) : null}
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
