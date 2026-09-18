'use client';

// ═══════════════════════════════════════════════════════════════
// COMMENTS SECTION — commentaires approuvés + formulaire
// (modération a priori : le commentaire passe en PENDING).
// ═══════════════════════════════════════════════════════════════
import { useState } from 'react';
import { CornerDownRight, Loader2, MessageCircle, Send } from 'lucide-react';
import { publicApi } from '@/lib/api';
import { useMagazineStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PublicComment } from '@/lib/api';
import { frRelative, initials, isValidEmail } from '../mag/helpers';

interface CommentsSectionProps {
  articleId: string;
  comments: PublicComment[];
}

export function CommentsSection({ articleId, comments }: CommentsSectionProps) {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const { toast } = useToast();
  const [form, setForm] = useState({ authorName: '', authorEmail: '', content: '' });
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!settings?.commentsEnabled) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.authorName.trim() || !form.content.trim()) {
      toast({ title: 'Champs manquants', description: 'Renseignez votre nom et votre message.', variant: 'destructive' });
      return;
    }
    if (!isValidEmail(form.authorEmail)) {
      toast({ title: 'Adresse email invalide', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await publicApi.postComment({
        articleId,
        authorName: form.authorName.trim(),
        authorEmail: form.authorEmail.trim(),
        content: form.content.trim(),
      });
      setSubmitted(true);
      setForm({ authorName: '', authorEmail: '', content: '' });
      toast({ title: 'Merci !', description: 'Votre commentaire sera publié après modération.' });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible d’envoyer le commentaire.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12" aria-label="Commentaires">
      <h2 className="mb-6 flex items-center gap-2 font-editorial text-2xl font-bold">
        <MessageCircle className="size-5 text-primary" aria-hidden="true" />
        Commentaires
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
          {comments.length}
        </span>
      </h2>

      {/* Liste */}
      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Soyez le premier à réagir à cet article.
        </p>
      ) : (
        <ul className="space-y-5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar className="size-10 border">
                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                  {initials(c.authorName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-semibold">{c.authorName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{frRelative(c.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {c.content}
                </p>
                {c.reply ? (
                  <div className="mt-3 rounded-lg border-l-4 border-primary bg-secondary/60 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                      <CornerDownRight className="size-3.5" aria-hidden="true" />
                      Réponse de la rédaction
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{c.reply}</p>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Formulaire */}
      <Card className="mt-8 p-5 sm:p-6">
        <h3 className="font-editorial text-lg font-bold">Laisser un commentaire</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Votre adresse email ne sera pas publiée. Les commentaires sont modérés avant publication.
        </p>
        {submitted ? (
          <div className="mt-4 rounded-lg border border-primary/30 bg-accent/40 p-4 text-sm">
            <p className="font-semibold text-primary">Merci pour votre contribution !</p>
            <p className="mt-1 text-muted-foreground">
              Votre commentaire est en attente de modération. Il apparaîtra dès sa validation par la
              rédaction.
            </p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="mt-2 text-sm font-medium text-primary underline underline-offset-2"
            >
              Écrire un autre commentaire
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="comment-name">Nom *</Label>
              <Input
                id="comment-name"
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                placeholder="Votre nom"
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="comment-email">Email *</Label>
              <Input
                id="comment-email"
                type="email"
                value={form.authorEmail}
                onChange={(e) => setForm({ ...form, authorEmail: e.target.value })}
                placeholder="vous@exemple.com"
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="comment-content">Message *</Label>
              <Textarea
                id="comment-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Votre commentaire…"
                rows={4}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} className="min-h-[44px] rounded-full px-6">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Publier le commentaire
              </Button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}
