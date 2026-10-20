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
import { initials, isValidEmail } from '../mag/helpers';
import { useI18n, useFormatDate } from '@/lib/i18n';

interface CommentsSectionProps {
  articleId: string;
  comments: PublicComment[];
}

export function CommentsSection({ articleId, comments }: CommentsSectionProps) {
  const settings = useMagazineStore((s) => s.bootstrap?.settings);
  const { toast } = useToast();
  const { t } = useI18n();
  const { relative } = useFormatDate();
  const [form, setForm] = useState({ authorName: '', authorEmail: '', content: '' });
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!settings?.commentsEnabled) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.authorName.trim() || !form.content.trim()) {
      toast({ title: t('comments.missingFields'), description: t('comments.missingFieldsDesc'), variant: 'destructive' });
      return;
    }
    if (!isValidEmail(form.authorEmail)) {
      toast({ title: t('form.invalidEmail'), variant: 'destructive' });
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
      toast({ title: t('comments.thanksToastTitle'), description: t('comments.thanksToastDesc') });
    } catch (err) {
      toast({
        title: t('form.error'),
        description: err instanceof Error ? err.message : t('comments.sendError'),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12" aria-label={t('comments.title')}>
      <h2 className="mb-6 flex items-center gap-2 font-editorial text-2xl font-bold">
        <MessageCircle className="size-5 text-primary" aria-hidden="true" />
        {t('comments.title')}
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">
          {comments.length}
        </span>
      </h2>

      {/* Liste */}
      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t('comments.empty')}
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
                  <span className="ml-2 text-xs text-muted-foreground">{relative(c.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {c.content}
                </p>
                {c.reply ? (
                  <div className="mt-3 rounded-lg border-l-4 border-primary bg-secondary/60 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                      <CornerDownRight className="size-3.5" aria-hidden="true" />
                      {t('comments.reply')}
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
        <h3 className="font-editorial text-lg font-bold">{t('comments.formTitle')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('comments.moderationNote')}</p>
        {submitted ? (
          <div className="mt-4 rounded-lg border border-primary/30 bg-accent/40 p-4 text-sm">
            <p className="font-semibold text-primary">{t('comments.thanksTitle')}</p>
            <p className="mt-1 text-muted-foreground">{t('comments.thanksDesc')}</p>
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="mt-2 text-sm font-medium text-primary underline underline-offset-2"
            >
              {t('comments.writeAnother')}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="comment-name">{t('comments.name')} *</Label>
              <Input
                id="comment-name"
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                placeholder={t('comments.namePlaceholder')}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="comment-email">{t('comments.email')} *</Label>
              <Input
                id="comment-email"
                type="email"
                value={form.authorEmail}
                onChange={(e) => setForm({ ...form, authorEmail: e.target.value })}
                placeholder={t('comments.emailPlaceholder')}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="comment-content">{t('comments.message')} *</Label>
              <Textarea
                id="comment-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder={t('comments.messagePlaceholder')}
                rows={4}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} className="min-h-[44px] rounded-full px-6">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {t('comments.submit')}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}
