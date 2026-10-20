'use client';

// ═══════════════════════════════════════════════════════════════
// TRANSLATIONS DIALOG — composant RÉUTILISABLE de gestion des
// traductions (EN/ES/AR/ZH) pour toute entité : article, podcast,
// vidéo, catégorie, flash info. Charge les traductions existantes,
// permet de corriger chaque champ, de re-traduire automatiquement.
// Une traduction corrigée (auto=false) n'est plus écrasée.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { adminApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { isAuthError } from './helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Field } from './Field';
import { Languages, Loader2, RefreshCw, Save } from 'lucide-react';

const LOCALES: { code: string; label: string }[] = [
  { code: 'en', label: 'Anglais' },
  { code: 'es', label: 'Espagnol' },
  { code: 'ar', label: 'Arabe' },
  { code: 'zh', label: 'Chinois' },
];

export interface TranslationField {
  key: string;
  label: string;
  multiline?: boolean;
}

export function TranslationsDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityLabel,
  fields,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entityType: 'article' | 'flashInfo' | 'podcast' | 'video' | 'category';
  entityId: string | null;
  entityLabel?: string;
  fields: TranslationField[];
}) {
  const { toast } = useToast();
  const [data, setData] = React.useState<Record<string, Record<string, string>>>({});
  const [auto, setAuto] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(false);
  const [savingLocale, setSavingLocale] = React.useState<string | null>(null);
  const [retranslating, setRetranslating] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const { translations } = await adminApi.translations(entityType, entityId);
      const next: Record<string, Record<string, string>> = {};
      const autoMap: Record<string, boolean> = {};
      for (const t of translations) {
        next[t.locale] = {};
        for (const f of fields) {
          next[t.locale][f.key] = String((t.data as Record<string, unknown>)[f.key] ?? '');
        }
        autoMap[t.locale] = t.auto;
      }
      setData(next);
      setAuto(autoMap);
    } catch (e) {
      if (isAuthError(e)) return;
      toast({ variant: 'destructive', title: 'Erreur', description: 'Traductions indisponibles.' });
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, fields]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const saveLocale = async (locale: string) => {
    if (!entityId) return;
    setSavingLocale(locale);
    try {
      const payload: Record<string, string> = {};
      for (const f of fields) {
        const v = data[locale]?.[f.key] ?? '';
        if (v.trim()) payload[f.key] = v;
      }
      await adminApi.saveTranslation({ entityType, entityId, locale, data: payload });
      setAuto((prev) => ({ ...prev, [locale]: false }));
      toast({ title: 'Traduction enregistrée', description: `Version ${locale.toUpperCase()} corrigée (non écrasée par l’automatique).` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Enregistrement impossible.' });
    } finally {
      setSavingLocale(null);
    }
  };

  const retranslate = async () => {
    if (!entityId) return;
    setRetranslating(true);
    try {
      await adminApi.retranslate({ entityType, entityId });
      await load();
      toast({ title: 'Re-traduction lancée', description: 'Traductions automatiques régénérées.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Re-traduction impossible.' });
    } finally {
      setRetranslating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-editorial flex items-center gap-2">
            <Languages className="size-4 text-primary" /> Traductions{entityLabel ? ` — ${entityLabel}` : ''}
          </DialogTitle>
          <DialogDescription>
            Générées automatiquement à la publication. Corrigez-les ici : une traduction corrigée
            n’est plus jamais écrasée par l’automatique.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <>
            <Tabs defaultValue="en">
              <TabsList className="w-full">
                {LOCALES.map((l) => (
                  <TabsTrigger key={l.code} value={l.code} className="flex-1">
                    {l.label}
                    {auto[l.code] === false ? ' ✎' : ''}
                  </TabsTrigger>
                ))}
              </TabsList>
              {LOCALES.map((l) => (
                <TabsContent key={l.code} value={l.code} className="space-y-3 pt-3">
                  <p className="text-xs text-muted-foreground">
                    {data[l.code]
                      ? auto[l.code]
                        ? 'Traduction automatique — modifiable.'
                        : 'Traduction corrigée manuellement.'
                      : 'Pas encore de traduction — publiez l’élément ou cliquez sur « Re-traduire ».'}
                  </p>
                  {fields.map((f) =>
                    f.multiline ? (
                      <Field key={f.key} label={f.label}>
                        <Textarea
                          value={data[l.code]?.[f.key] ?? ''}
                          onChange={(e) =>
                            setData((prev) => ({
                              ...prev,
                              [l.code]: { ...(prev[l.code] ?? {}), [f.key]: e.target.value },
                            }))
                          }
                          className="min-h-16 text-sm"
                          aria-label={`${f.label} (${l.label})`}
                        />
                      </Field>
                    ) : (
                      <Field key={f.key} label={f.label}>
                        <Input
                          value={data[l.code]?.[f.key] ?? ''}
                          onChange={(e) =>
                            setData((prev) => ({
                              ...prev,
                              [l.code]: { ...(prev[l.code] ?? {}), [f.key]: e.target.value },
                            }))
                          }
                          className="h-9"
                          aria-label={`${f.label} (${l.label})`}
                        />
                      </Field>
                    ),
                  )}
                  <div className="flex justify-end">
                    <Button size="sm" disabled={savingLocale === l.code || !data[l.code]} onClick={() => saveLocale(l.code)}>
                      {savingLocale === l.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Enregistrer cette correction
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={retranslate} disabled={retranslating}>
                {retranslating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Re-traduire (auto)
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
