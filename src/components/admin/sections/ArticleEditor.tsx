'use client';

// ═══════════════════════════════════════════════════════════════
// ARTICLE EDITOR — Le bijou du CMS : éditeur de blocs riche,
// panneau de réglages (statut, une, SEO), versions, aperçu.
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import { useMagazineStore, navigate } from '@/lib/store';
import { adminApi } from '@/lib/api';
import type { ArticleStatus, ArticleVersion, Category, ContentBlock, MediaItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MediaPicker } from '../ui/MediaPicker';
import { Field } from '../ui/Field';
import {
  STATUS_META, slugify, extractYouTubeId, youtubeThumb, countBlockWords,
  formatNumber, formatDate, isAuthError, toLocalInput,
} from '../ui/helpers';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, ArrowUp, ArrowDown, Copy, Trash2, Plus, Save, UploadCloud,
  Eye, History, ImagePlus, X, Quote, Heading2, List as ListIcon,
  Type, Image as ImageIcon, Youtube, SquareDashed, Sparkles, Loader2,
  Undo2, Bold, Italic, Underline, Strikethrough, Highlighter, Link2,
  ListOrdered, Languages, RefreshCw,
} from 'lucide-react';
import { wrapSelection, insertLink, renderInline } from '@/components/front/mag/richText';
import { blocksToFluent, fluentToBlocks, fluentWordCount } from '@/lib/admin/fluentContent';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ═══════════════════════════════════════════════════════════════
// FLUENT EDITOR — UNE SEULE zone de contenu pour tout l'article.
// Titres, citations, listes, images, vidéos, encadrés, séparateurs
// et tous les styles s'écrivent au même endroit avec des marqueurs
// simples insérés par la barre d'outils (aucune gestion de blocs).
// ═══════════════════════════════════════════════════════════════
function FluentEditor({ value, onChange, onPickImage, blocksCount, words }: {
  value: string;
  onChange: (v: string) => void;
  onPickImage: () => void;
  blocksCount: number;
  words: number;
}) {
  const taRef = React.useRef<HTMLTextAreaElement>(null);

  /** Encadre la sélection avec un marqueur et restitue le focus. */
  const wrap = (before: string, after = before, placeholder = 'texte') => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  /** Insère du texte au curseur (retours à la ligne propres). */
  const insert = (snippet: string) => {
    const ta = taRef.current;
    const pos = ta ? ta.selectionEnd : value.length;
    const prefix = value.slice(0, pos);
    const glue = prefix === '' || prefix.endsWith('\n\n') || snippet.startsWith('\n')
      ? (prefix.endsWith('\n') || prefix === '' ? '' : '\n')
      : '\n\n';
    onChange(value.slice(0, pos) + glue + snippet + value.slice(pos));
    requestAnimationFrame(() => ta?.focus());
  };

  const addLink = () => {
    const url = window.prompt('Adresse du lien (https://…)');
    if (!url) return;
    wrap('[', '](' + url + ')', 'texte du lien');
  };

  const addVideo = () => {
    const url = window.prompt('Lien ou ID de la vidéo YouTube :');
    if (!url) return;
    insert('{{video}} ' + url);
  };

  const TOOLBAR: { icon: React.ReactNode; label: string; action: () => void }[] = [
    { icon: <Heading2 className="h-4 w-4" />, label: 'Titre de section (##)', action: () => insert('## ') },
    { icon: <Type className="h-4 w-4" />, label: 'Sous-titre (###)', action: () => insert('### ') },
    { icon: <Bold className="h-4 w-4" />, label: 'Gras', action: () => wrap('**') },
    { icon: <Italic className="h-4 w-4" />, label: 'Italique', action: () => wrap('*') },
    { icon: <Underline className="h-4 w-4" />, label: 'Souligné', action: () => wrap('__') },
    { icon: <Highlighter className="h-4 w-4" />, label: 'Surligné', action: () => wrap('==') },
    { icon: <Strikethrough className="h-4 w-4" />, label: 'Barré', action: () => wrap('~~') },
    { icon: <Link2 className="h-4 w-4" />, label: 'Lien', action: addLink },
    { icon: <Quote className="h-4 w-4" />, label: 'Citation (>)', action: () => insert('> ') },
    { icon: <ListIcon className="h-4 w-4" />, label: 'Liste à puces (-)', action: () => insert('- ') },
    { icon: <ListOrdered className="h-4 w-4" />, label: 'Liste numérotée (1.)', action: () => insert('1. ') },
    { icon: <ImageIcon className="h-4 w-4" />, label: 'Insérer une image (médiathèque)', action: onPickImage },
    { icon: <Youtube className="h-4 w-4" />, label: 'Intégrer une vidéo YouTube', action: addVideo },
    { icon: <Sparkles className="h-4 w-4" />, label: 'Encadré à retenir (!!!)', action: () => insert('!!! À retenir :: ') },
    { icon: <SquareDashed className="h-4 w-4" />, label: 'Séparateur (---)', action: () => insert('---') },
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-card shadow-sm focus-within:ring-1 focus-within:ring-primary/40">
      {/* Barre d'outils riche */}
      <div className="custom-scrollbar flex flex-wrap items-center gap-0.5 overflow-x-auto rounded-t-xl border-b border-border/60 bg-muted/40 px-2 py-1.5">
        {TOOLBAR.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.label}
            aria-label={tool.label}
            onClick={tool.action}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            {tool.icon}
          </button>
        ))}
        <span className="ml-auto shrink-0 pl-2 text-[10px] font-medium tabular-nums text-muted-foreground">
          {words} mot{words > 1 ? 's' : ''} · {blocksCount} élément{blocksCount > 1 ? 's' : ''}
        </span>
      </div>

      {/* LA zone unique de rédaction */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Rédigez tout l’article ici, sans gérer de blocs.

Un simple paragraphe : sélectionnez du texte puis utilisez la barre (gras, italique, souligné, surligné, barré, lien).
## Un intertitre · ### Un sous-titre
> Une citation marquante
- une puce · 1. une liste numérotée
![légende](image) · vidéo YouTube · !!! À retenir :: message clé · --- séparateur.`}
        aria-label="Contenu de l'article"
        spellCheck
        className="block-editor-textarea custom-scrollbar min-h-[440px] w-full resize-y px-4 py-4 font-editorial text-[15px] leading-[1.9] outline-none"
      />

      {/* Aide-mémoire dépliable */}
      <details className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none font-medium">Aide-mémoire des marqueurs</summary>
        <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
          <li><code className="rounded bg-muted px-1">## Titre</code> intertitre · <code className="rounded bg-muted px-1">### Sous-titre</code></li>
          <li><code className="rounded bg-muted px-1">**gras**</code> <code className="rounded bg-muted px-1">*italique*</code> <code className="rounded bg-muted px-1">__souligné__</code> <code className="rounded bg-muted px-1">==surligné==</code> <code className="rounded bg-muted px-1">~~barré~~</code></li>
          <li><code className="rounded bg-muted px-1">[texte](url)</code> lien · <code className="rounded bg-muted px-1">&gt; citation</code> (+ <code className="rounded bg-muted px-1">&gt; @ Auteur</code>)</li>
          <li><code className="rounded bg-muted px-1">- puce</code> / <code className="rounded bg-muted px-1">1. numéroté</code> · <code className="rounded bg-muted px-1">---</code> séparateur</li>
          <li><code className="rounded bg-muted px-1">![légende](url-image)</code> image — via le bouton image</li>
          <li><code className="rounded bg-muted px-1">{'{{video}}'} lien-YouTube</code> vidéo intégrée</li>
        </ul>
      </details>
    </div>
  );
}

// ─── Utilitaires locaux ────────────────────────────────────────
function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newBlock(type: ContentBlock['type']): ContentBlock {
  switch (type) {
    case 'paragraph': return { id: uid(), type, text: '' };
    case 'heading': return { id: uid(), type, level: 2, text: '' };
    case 'quote': return { id: uid(), type, text: '', author: '' };
    case 'image': return { id: uid(), type, url: '', alt: '', caption: '' };
    case 'video': return { id: uid(), type, youtubeId: '', title: '' };
    case 'list': return { id: uid(), type, items: [''], ordered: false };
    case 'callout': return { id: uid(), type, title: 'À retenir', text: '' };
    case 'divider': return { id: uid(), type };
    default: return { id: uid(), type: 'paragraph', text: '' };
  }
}

const BLOCK_LABELS: Record<ContentBlock['type'], string> = {
  paragraph: 'Paragraphe',
  heading: 'Titre',
  quote: 'Citation',
  image: 'Image',
  video: 'Vidéo YouTube',
  list: 'Liste',
  callout: 'Encadré « À retenir »',
  divider: 'Séparateur',
};

/** Textarea à hauteur automatique pour l'édition inline des blocs. */
function AutoTextarea({ value, onChange, placeholder, ariaLabel, className, textareaRef }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = React.useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? localRef;
  React.useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
  }, [value, ref]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      rows={1}
      className={cn('block-editor-textarea', className)}
    />
  );
}

// ─── Barre d'outils de mise en forme (gras, italique, liens…) ──
// Balisage inséré : **gras** *italique* __souligné__ ==surligné~~
// ~~barré~~ [texte](url) — rendu par BlocksRenderer côté site public.
function RichToolbar({ target }: { target: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null> }) {
  const btn = (
    label: string,
    Icon: typeof Bold,
    action: () => void,
    title: string,
  ) => (
    <button
      key={label}
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()} // conserve la sélection
      onClick={() => {
        const el = target.current;
        if (el) action();
      }}
      className="flex size-6.5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Mise en forme du texte">
      {btn('bold', Bold, () => target.current && wrapSelection(target.current, '**', '**', 'gras'), 'Gras (**texte**)')}
      {btn('italic', Italic, () => target.current && wrapSelection(target.current, '*', '*', 'italique'), 'Italique (*texte*)')}
      {btn('underline', Underline, () => target.current && wrapSelection(target.current, '__', '__', 'souligné'), 'Souligné (__texte__)')}
      {btn('highlight', Highlighter, () => target.current && wrapSelection(target.current, '==', '==', 'surligné'), 'Surligné (==texte==)')}
      {btn('strike', Strikethrough, () => target.current && wrapSelection(target.current, '~~', '~~', 'barré'), 'Barré (~~texte~~)')}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
      {btn('link', Link2, () => target.current && insertLink(target.current), 'Insérer un lien')}
    </div>
  );
}

/** Textarea riche : barre de mise en forme + zone de texte. */
function RichTextarea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/40 px-1.5 py-1">
        <RichToolbar target={ref} />
        <span className="text-[10px] text-muted-foreground/70">**gras** · *italique* · __souligné__ · ==surligné== · ~~barré~~ · lien</span>
      </div>
      <AutoTextarea {...props} textareaRef={ref} />
    </div>
  );
}

// ─── Rendu d'un bloc (aperçu fidèle au front) ──────────────────
function BlockPreview({ block, isFirst }: { block: ContentBlock; isFirst: boolean }) {
  switch (block.type) {
    case 'paragraph':
      return <p className={cn(isFirst && '[&::first-letter]:float-left [&::first-letter]:font-editorial [&::first-letter]:text-[3rem] [&::first-letter]:leading-[0.85] [&::first-letter]:pr-2 [&::first-letter]:pt-1 [&::first-letter]:font-bold [&::first-letter]:text-primary')}>{renderInline(block.text)}</p>;
    case 'heading':
      return block.level === 2
        ? <h2 className="mt-8 font-editorial text-2xl font-bold">{renderInline(block.text)}</h2>
        : <h3 className="mt-6 font-editorial text-xl font-semibold">{renderInline(block.text)}</h3>;
    case 'quote':
      return (
        <blockquote className="my-6 border-l-4 border-primary pl-5">
          <p className="font-editorial text-xl italic leading-relaxed">« {block.text} »</p>
          {block.author ? <footer className="mt-2 text-sm font-medium text-muted-foreground">— {block.author}</footer> : null}
        </blockquote>
      );
    case 'image':
      return (
        <figure className="my-6">
          { }
          <img src={block.url} alt={block.alt ?? ''} className="w-full rounded-lg object-cover" />
          {block.caption ? <figcaption className="mt-2 text-center text-xs text-muted-foreground">{block.caption}</figcaption> : null}
        </figure>
      );
    case 'video':
      return (
        <figure className="my-6 overflow-hidden rounded-lg">
          <div className="aspect-video w-full">
            <iframe
              src={`https://www.youtube.com/embed/${block.youtubeId}`}
              title={block.title ?? 'Vidéo YouTube'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          {block.title ? <figcaption className="mt-2 text-center text-xs text-muted-foreground">{block.title}</figcaption> : null}
        </figure>
      );
    case 'list':
      return block.ordered ? (
        <ol className="my-4 list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-primary">
          {block.items.filter((it) => it.trim()).map((it, i) => <li key={i}>{it}</li>)}
        </ol>
      ) : (
        <ul className="my-4 list-disc space-y-1.5 pl-6 marker:text-primary">
          {block.items.filter((it) => it.trim()).map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      );
    case 'callout':
      return (
        <aside className="my-6 rounded-lg border border-primary/40 bg-primary/10 p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {block.title || 'À retenir'}
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed">{block.text}</p>
        </aside>
      );
    case 'divider':
      return <hr className="my-8 border-dashed border-border" />;
    default:
      return null;
  }
}

// ─── Composant principal ───────────────────────────────────────
export function ArticleEditor({ articleId }: { articleId?: string }) {
  const { toast } = useToast();
  const adminUser = useMagazineStore((s) => s.adminUser);
  const clearAdminSession = useMagazineStore((s) => s.clearAdminSession);
  const canChooseAuthor = adminUser?.role === 'ADMIN' || adminUser?.role === 'EDITOR_IN_CHIEF';

  const [loading, setLoading] = React.useState(Boolean(articleId));
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [currentId, setCurrentId] = React.useState<string | undefined>(articleId);

  // Champs principaux
  const [title, setTitle] = React.useState('');
  const [subtitle, setSubtitle] = React.useState('');
  const [excerpt, setExcerpt] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [coverImage, setCoverImage] = React.useState('');
  const [coverCredit, setCoverCredit] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [authorId, setAuthorId] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [content, setContent] = React.useState<ContentBlock[]>([newBlock('paragraph')]);
  // Éditeur fluide : texte unique représentant tout le contenu
  const [fluent, setFluent] = React.useState('');
  const wordCount = React.useMemo(() => fluentWordCount(fluent), [fluent]);

  // Réglages
  const [status, setStatus] = React.useState<ArticleStatus>('DRAFT');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [featured, setFeatured] = React.useState(false);
  const [featuredOrder, setFeaturedOrder] = React.useState(0);
  const [trending, setTrending] = React.useState(false);
  const [readingTime, setReadingTime] = React.useState(4);
  const [readingTimeTouched, setReadingTimeTouched] = React.useState(false);
  const [seoTitle, setSeoTitle] = React.useState('');
  const [seoDescription, setSeoDescription] = React.useState('');

  // Référentiels
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [users, setUsers] = React.useState<{ id: string; name: string }[]>([]);
  const [suggestedTags, setSuggestedTags] = React.useState<string[]>([]);

  // Dialogs
  const [pickerTarget, setPickerTarget] = React.useState<'cover' | string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [versionsOpen, setVersionsOpen] = React.useState(false);
  const [versions, setVersions] = React.useState<ArticleVersion[] | null>(null);
  const [restoreVersionId, setRestoreVersionId] = React.useState<string | null>(null);
  const [restoring, setRestoring] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);

  // Éléments de liste : suivi de l'input actif pour la barre riche
  const listInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const listActiveInput = React.useRef<HTMLInputElement | null>(null);

  // Traductions (EN/ES/AR/ZH)
  const [translationsOpen, setTranslationsOpen] = React.useState(false);
  const [translations, setTranslations] = React.useState<Record<string, { auto: boolean; title: string; subtitle: string }>>({});
  const [translationsLoading, setTranslationsLoading] = React.useState(false);
  const [translationSavingLocale, setTranslationSavingLocale] = React.useState<string | null>(null);
  const [retranslating, setRetranslating] = React.useState(false);
  const TRANSLATE_LOCALES: { code: string; label: string }[] = [
    { code: 'en', label: 'Anglais' },
    { code: 'es', label: 'Espagnol' },
    { code: 'ar', label: 'Arabe' },
    { code: 'zh', label: 'Chinois' },
  ];

  const loadTranslations = async () => {
    if (!currentId) {
      toast({ title: 'Aucune traduction', description: 'Enregistrez d’abord l’article pour générer ses traductions.' });
      return;
    }
    setTranslationsOpen(true);
    setTranslationsLoading(true);
    try {
      const { translations: rows } = await adminApi.translations('article', currentId);
      const map: Record<string, { auto: boolean; title: string; subtitle: string }> = {};
      for (const r of rows) {
        map[r.locale] = {
          auto: r.auto,
          title: String((r.data as { title?: unknown }).title ?? ''),
          subtitle: String((r.data as { subtitle?: unknown }).subtitle ?? ''),
        };
      }
      setTranslations(map);
    } catch (e) {
      handleError(e, 'Traductions indisponibles.');
    } finally {
      setTranslationsLoading(false);
    }
  };

  const saveTranslationLocale = async (locale: string) => {
    if (!currentId) return;
    const entry = translations[locale] ?? { auto: true, title: '', subtitle: '' };
    setTranslationSavingLocale(locale);
    try {
      // data minimale : on préserve le contenu traduit existant, on ne sauvegarde
      // que title/subtitle éditables ici.
      await adminApi.saveTranslation({
        entityType: 'article',
        entityId: currentId,
        locale,
        data: { title: entry.title, subtitle: entry.subtitle },
      });
      toast({ title: 'Traduction enregistrée', description: `Version ${locale.toUpperCase()} mise à jour (manuelle, non écrasée par l’automatique).` });
    } catch (e) {
      handleError(e, 'Enregistrement impossible.');
    } finally {
      setTranslationSavingLocale(null);
    }
  };

  const retranslateAll = async () => {
    if (!currentId) return;
    setRetranslating(true);
    try {
      await adminApi.retranslate({ entityType: 'article', entityId: currentId });
      await loadTranslations();
      toast({ title: 'Re-traduction lancée', description: 'Les traductions automatiques ont été régénérées (les corrections manuelles sont conservées si elles existent).' });
    } catch (e) {
      handleError(e, 'Re-traduction impossible.');
    } finally {
      setRetranslating(false);
    }
  };

  const autoReadingTime = React.useCallback(() => {
    const words = countBlockWords(content);
    return Math.max(1, Math.round(words / 200));
  }, [content]);

  // Catégories aplaties pour le Select (parents + enfants indentés)
  const flatCategories = React.useMemo(() => {
    const out: { id: string; label: string }[] = [];
    const walk = (cats: Category[], depth: number) => {
      for (const c of cats) {
        out.push({ id: c.id, label: `${'— '.repeat(depth)}${c.name}` });
        if (c.children?.length) walk(c.children, depth + 1);
      }
    };
    walk(categories, 0);
    return out;
  }, [categories]);

  // Chargement initial
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const tasks: Promise<void>[] = [
        adminApi.categories().then((r) => { if (mounted) setCategories(r.categories); }),
        adminApi.tags().then((r) => { if (mounted) setSuggestedTags(r.tags); }),
        canChooseAuthor
          ? adminApi.users().then((r) => { if (mounted) setUsers(r.users.map((u) => ({ id: u.id, name: u.name }))); })
          : Promise.resolve(),
      ];
      if (articleId) {
        tasks.push(
          adminApi.article(articleId).then(({ article }) => {
            if (!mounted) return;
            setTitle(article.title);
            setSubtitle(article.subtitle);
      setExcerpt(article.excerpt || '');
            setExcerpt(article.excerpt || '');
            setSlug(article.slug);
            setSlugTouched(true);
            setCoverImage(article.coverImage);
            setCoverCredit(article.coverCredit);
            setCategoryId(article.category?.id ?? '');
            setAuthorId(article.author?.id ?? '');
            setTags(article.tags ?? []);
            setContent(article.content?.length ? article.content : [newBlock('paragraph')]);
      setFluent(blocksToFluent(article.content?.length ? article.content : []));
            setFluent(blocksToFluent(article.content?.length ? article.content : []));
            setStatus(article.status);
            setScheduledAt(toLocalInput(article.scheduledAt));
            setFeatured(article.featured);
            setFeaturedOrder(article.featuredOrder);
            setTrending(article.trending);
            setReadingTime(article.readingTime || 4);
            setReadingTimeTouched(true);
            setSeoTitle(article.seoTitle);
            setSeoDescription(article.seoDescription);
            setCurrentId(article.id);
          }).catch((e) => {
            toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : 'Article introuvable.' });
          }),
        );
      } else if (adminUser) {
        setAuthorId(adminUser.id);
      }
      await Promise.allSettled(tasks);
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
     
  }, [articleId]);

  // Auto-calcul du temps de lecture
  React.useEffect(() => {
    if (!readingTimeTouched) setReadingTime(autoReadingTime());
  }, [autoReadingTime, readingTimeTouched]);

  const handleError = (e: unknown, fallback: string) => {
    if (isAuthError(e)) { clearAdminSession(); navigate('/'); return; }
    toast({ variant: 'destructive', title: 'Erreur', description: e instanceof Error ? e.message : fallback });
  };

  // ─── Slug automatique ─────────────────────────────────────────
  const handleTitleChange = (v: string) => {
    setTitle(v);
    setDirty(true);
    if (!slugTouched) setSlug(slugify(v));
  };

  // ─── Gestion des tags ─────────────────────────────────────────
  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t || tags.includes(t)) { setTagInput(''); return; }
    setTags([...tags, t]);
    setTagInput('');
    setDirty(true);
  };
  const removeTag = (t: string) => { setTags(tags.filter((x) => x !== t)); setDirty(true); };

  // ─── Gestion des blocs ────────────────────────────────────────
  const patchBlock = <T extends ContentBlock['type']>(id: string, type: T, patch: Partial<Extract<ContentBlock, { type: T }>>) => {
    setContent((prev) => prev.map((b) => (b.id === id && b.type === type ? ({ ...b, ...patch } as ContentBlock) : b)));
    setDirty(true);
  };
  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= content.length) return;
    const next = [...content];
    [next[index], next[target]] = [next[target], next[index]];
    setContent(next);
    setDirty(true);
  };
  const duplicateBlock = (index: number) => {
    const clone: ContentBlock = { ...structuredClone(content[index]), id: uid() };
    const next = [...content];
    next.splice(index + 1, 0, clone);
    setContent(next);
    setDirty(true);
  };
  const removeBlock = (id: string) => {
    setContent(content.filter((b) => b.id !== id));
    setDirty(true);
  };
  const addBlock = (type: ContentBlock['type']) => {
    setContent([...content, newBlock(type)]);
    setDirty(true);
  };

  // ─── Sélection de média ───────────────────────────────────────
  const handleMediaSelect = (m: MediaItem | { url: string; filename: string }) => {
    if (pickerTarget === 'cover') {
      setCoverImage(m.url);
      if (!coverCredit && 'credit' in m && m.credit) setCoverCredit(m.credit);
    } else if (pickerTarget === 'fluent-image') {
      const alt = ('alt' in m && m.alt) || m.filename || 'image';
      const glue = fluent === '' || fluent.endsWith('\n') ? '' : '\n\n';
      setFluent(fluent + glue + '![' + alt + '](' + m.url + ')');
      setDirty(true);
    } else if (pickerTarget) {
      patchBlock(pickerTarget, 'image', { url: m.url, alt: ('alt' in m && m.alt) || m.filename });
    }
    setPickerTarget(null);
    setDirty(true);
  };

  // ─── Sauvegarde ───────────────────────────────────────────────
  const save = async (overrideStatus?: ArticleStatus): Promise<boolean> => {
    const effectiveStatus = overrideStatus ?? status;
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Titre requis', description: 'Renseignez un titre avant d’enregistrer.' });
      return false;
    }
    if (!categoryId) {
      toast({ variant: 'destructive', title: 'Catégorie requise', description: 'Choisissez une catégorie dans le panneau de réglages.' });
      return false;
    }
    if (effectiveStatus === 'SCHEDULED' && !scheduledAt) {
      toast({ variant: 'destructive', title: 'Planification incomplète', description: 'Indiquez la date et l’heure de publication.' });
      return false;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug || slugify(title),
        subtitle,
        excerpt,
        content: content.map((b) => (b.type === 'paragraph' && !b.text.trim()) ? { ...b, text: '' } : b),
        coverImage,
        coverCredit,
        status: effectiveStatus,
        categoryId,
        authorId: authorId || undefined,
        featured,
        featuredOrder,
        trending,
        readingTime,
        seoTitle,
        seoDescription,
        scheduledAt: effectiveStatus === 'SCHEDULED' && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        tags,
      };
      if (currentId) {
        await adminApi.updateArticle(currentId, payload);
        if (effectiveStatus !== status) setStatus(effectiveStatus);
        setDirty(false);
        toast({ title: 'Article enregistré', description: effectiveStatus === 'PUBLISHED' ? 'L’article est en ligne.' : `Statut : ${STATUS_META[effectiveStatus].label}.` });
        return true;
      }
      const { article } = await adminApi.createArticle(payload);
      setCurrentId(article.id);
      setStatus(effectiveStatus);
      setSlug(article.slug);
      setSlugTouched(true);
      navigate(`#/admin/editor/${article.id}`);
      setDirty(false);
      toast({ title: 'Article créé', description: 'Le brouillon a été enregistré, vous pouvez continuer à l’éditer.' });
      return true;
    } catch (e) {
      handleError(e, 'Enregistrement impossible.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    const ok = await save('PUBLISHED');
    setPublishing(false);
    if (ok) navigate('#/admin/articles');
  };

  // ─── Versions ─────────────────────────────────────────────────
  const loadVersions = async () => {
    if (!currentId) {
      toast({ title: 'Aucune version', description: 'Les versions apparaissent après le premier enregistrement.' });
      return;
    }
    setVersionsOpen(true);
    setVersions(null);
    try {
      const { versions: list } = await adminApi.articleVersions(currentId);
      setVersions(list);
    } catch (e) {
      handleError(e, 'Versions indisponibles.');
      setVersions([]);
    }
  };

  const doRestore = async () => {
    if (!currentId || !restoreVersionId) return;
    setRestoring(true);
    try {
      const { article } = await adminApi.restoreVersion(currentId, restoreVersionId);
      setTitle(article.title);
      setSubtitle(article.subtitle);
      setExcerpt(article.excerpt || '');
      setContent(article.content?.length ? article.content : [newBlock('paragraph')]);
      setVersionsOpen(false);
      setRestoreVersionId(null);
      setDirty(false);
      toast({ title: 'Version restaurée', description: 'Le contenu de l’article a été restauré.' });
    } catch (e) {
      handleError(e, 'Restauration impossible.');
    } finally {
      setRestoring(false);
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const statusMeta = STATUS_META[status];
  const availableSuggestions = suggestedTags.filter((t) => !tags.includes(t)).slice(0, 8);

  return (
    <div className="space-y-5">
      {/* ─── Barre supérieure de l'éditeur ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('#/admin/articles')}>
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
        <Badge variant="outline" className={statusMeta.className}>{statusMeta.label}</Badge>
        {dirty ? <span className="text-xs text-muted-foreground">● Modifications non enregistrées</span> : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" /> Aperçu
          </Button>
          <Button variant="outline" size="sm" onClick={loadVersions}>
            <History className="h-4 w-4" /> Versions
          </Button>
          <Button variant="outline" size="sm" onClick={loadTranslations}>
            <Languages className="h-4 w-4" /> Traductions
          </Button>
          <Button size="sm" onClick={() => save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
          {status !== 'PUBLISHED' ? (
            <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={handlePublish} disabled={saving || publishing}>
              <UploadCloud className="h-4 w-4" /> Publier
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ═══ Colonne contenu ═══ */}
        <div className="min-w-0 space-y-5">
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Titre de l’article…"
            aria-label="Titre de l’article"
            className="w-full bg-transparent font-editorial text-3xl font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/40 md:text-4xl"
          />
          <input
            value={subtitle}
            onChange={(e) => { setSubtitle(e.target.value); setDirty(true); }}
            placeholder="Sous-titre…"
            aria-label="Sous-titre de l’article"
            className="w-full bg-transparent text-lg leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/40"
          />
          <div className="rounded-xl border border-border/70 bg-card p-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Chapeau / résumé rapide</p>
            <Textarea
              value={excerpt}
              onChange={(e) => { setExcerpt(e.target.value); setDirty(true); }}
              placeholder="Résumé en 2-3 phrases, affiché en tête d’article et repris dans les partages (distinct du sous-titre)."
              aria-label="Chapeau de l’article"
              className="min-h-16 border-none bg-transparent text-sm leading-relaxed focus-visible:ring-0"
            />
          </div>

          {/* Image de couverture */}
          <div className="rounded-xl border border-border/70 bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-medium">Image de couverture</p>
              {coverImage ? (
                <Button variant="ghost" size="sm" onClick={() => { setCoverImage(''); setDirty(true); }} className="h-7 text-xs text-destructive">
                  <X className="h-3.5 w-3.5" /> Retirer
                </Button>
              ) : null}
            </div>
            {coverImage ? (
               
              <img src={coverImage} alt="Couverture de l’article" className="aspect-video w-full rounded-lg object-cover" />
            ) : (
              <button
                type="button"
                onClick={() => setPickerTarget('cover')}
                className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm">Choisir une image dans la médiathèque</span>
              </button>
            )}
            <Input
              value={coverCredit}
              onChange={(e) => { setCoverCredit(e.target.value); setDirty(true); }}
              placeholder="Crédit photo (ex : Photo : Jean Dupont / Unsplash)"
              className="mt-2 text-xs"
              aria-label="Crédit photo"
            />
          </div>

          {/* Slug + catégorie + auteur + tags */}
          <div className="grid gap-4 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-2">
            <Field label="Slug (URL)" hint="Identifiant unique dans l’URL : #/article/mon-slug. Généré depuis le titre." className="sm:col-span-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">#/article/</span>
                <Input
                  value={slug}
                  onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); setDirty(true); }}
                  placeholder="mon-article"
                  className="h-8 font-mono text-xs"
                  aria-label="Slug de l’article"
                />
              </div>
            </Field>
            <Field label="Catégorie" required>
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setDirty(true); }}>
                <SelectTrigger aria-label="Catégorie de l’article"><SelectValue placeholder="Choisir une catégorie" /></SelectTrigger>
                <SelectContent>
                  {flatCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {canChooseAuthor ? (
              <Field label="Auteur" hint="Rédacteur attribué à cet article.">
                <Select value={authorId} onValueChange={(v) => { setAuthorId(v); setDirty(true); }}>
                  <SelectTrigger aria-label="Auteur de l’article"><SelectValue placeholder="Choisir un auteur" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <input type="hidden" value={authorId} aria-hidden="true" />
            )}
            <Field label="Tags" hint="Appuyez sur Entrée pour ajouter un tag." className="sm:col-span-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                }}
                placeholder="Ajouter un tag puis Entrée…"
                aria-label="Ajouter un tag"
              />
              {tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge key={t} variant="outline" className="gap-1 bg-accent">
                      {t}
                      <button type="button" onClick={() => removeTag(t)} aria-label={`Retirer le tag ${t}`} className="ml-0.5 rounded-full hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
              {availableSuggestions.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Suggestions :</span>
                  {availableSuggestions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTag(t)}
                      className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              ) : null}
            </Field>
          </div>

          {/* ═══ Éditeur de contenu FLUIDE — un seul bloc ═══ */}
          <FluentEditor
            value={fluent}
            onChange={(v) => { setFluent(v); setContent(fluentToBlocks(v)); setDirty(true); }}
            onPickImage={() => setPickerTarget('fluent-image')}
            blocksCount={content.length}
            words={wordCount}
          />
        </div>

        {/* ═══ Panneau réglages ═══ */}
        <aside className="space-y-4 lg:sticky lg:top-20">
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Publication</p>
            <Field label="Statut">
              <Select value={status} onValueChange={(v) => { setStatus(v as ArticleStatus); setDirty(true); }}>
                <SelectTrigger aria-label="Statut de l’article"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_META) as ArticleStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {status === 'SCHEDULED' ? (
              <Field label="Date et heure de publication" hint="L’article sera publié automatiquement à cette date.">
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => { setScheduledAt(e.target.value); setDirty(true); }}
                  aria-label="Date et heure de publication planifiée"
                />
              </Field>
            ) : null}
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium">À la une</p>
                <p className="text-[11px] text-muted-foreground">Affiché dans le carrousel d’accueil</p>
              </div>
              <Switch checked={featured} onCheckedChange={(v) => { setFeatured(v); setDirty(true); }} aria-label="Article à la une" />
            </div>
            {featured ? (
              <Field label="Ordre à la une" hint="1 = position principale du carrousel.">
                <Input
                  type="number" min={0}
                  value={featuredOrder}
                  onChange={(e) => { setFeaturedOrder(Number(e.target.value)); setDirty(true); }}
                  className="h-8"
                  aria-label="Ordre à la une"
                />
              </Field>
            ) : null}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium">Populaire</p>
                <p className="text-[11px] text-muted-foreground">Marqué « trending » sur le site</p>
              </div>
              <Switch checked={trending} onCheckedChange={(v) => { setTrending(v); setDirty(true); }} aria-label="Article populaire" />
            </div>
            <Separator />
            <Field
              label="Temps de lecture (min)"
              hint="Calculé automatiquement (200 mots/min). Modifiable."
              counter={!readingTimeTouched ? <span className="text-primary">auto</span> : undefined}
            >
              <div className="flex gap-2">
                <Input
                  type="number" min={1} max={120}
                  value={readingTime}
                  onChange={(e) => { setReadingTime(Number(e.target.value)); setReadingTimeTouched(true); setDirty(true); }}
                  className="h-8"
                  aria-label="Temps de lecture en minutes"
                />
                <Button variant="outline" size="sm" className="h-8 px-2.5" onClick={() => { setReadingTime(autoReadingTime()); setReadingTimeTouched(false); setDirty(true); }} title="Recalculer automatiquement">
                  <Sparkles className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Field>
          </div>

          {/* SEO */}
          <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Référencement (SEO)</p>
            <Field label="Titre SEO" counter={<span className={cn(seoTitle.length > 60 && 'text-destructive')}>{seoTitle.length}/60</span>}>
              <Input
                value={seoTitle}
                onChange={(e) => { setSeoTitle(e.target.value); setDirty(true); }}
                placeholder={title || 'Titre optimisé pour Google…'}
                className="h-8"
                aria-label="Titre SEO"
              />
            </Field>
            <Field label="Méta description" counter={<span className={cn(seoDescription.length > 160 && 'text-destructive')}>{seoDescription.length}/160</span>}>
              <Textarea
                value={seoDescription}
                onChange={(e) => { setSeoDescription(e.target.value); setDirty(true); }}
                placeholder="Résumé attractif affiché dans les résultats de recherche…"
                className="min-h-20 text-sm"
                aria-label="Méta description"
              />
            </Field>
            {/* Aperçu snippet Google */}
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Aperçu moteur de recherche</p>
              <p className="truncate text-xs text-muted-foreground">reussitemagazine.com › article › {slug || 'mon-article'}</p>
              <p className="truncate text-sm font-medium text-primary">{seoTitle || title || 'Titre de votre article'}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {seoDescription || subtitle || 'La méta description apparaîtra ici. Rédigez un résumé de 150 à 160 caractères incitant au clic.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card p-4">
            <p className="text-[11px] text-muted-foreground">
              {content.length} bloc(s) — {formatNumber(countBlockWords(content))} mots.
              {currentId ? ' Chaque enregistrement crée une version restaurable.' : ' Nouvel article : enregistrez-le pour créer des versions.'}
            </p>
          </div>
        </aside>
      </div>

      {/* ─── MediaPicker ─── */}
      <MediaPicker
        open={pickerTarget !== null}
        onOpenChange={(o) => { if (!o) setPickerTarget(null); }}
        onSelect={handleMediaSelect}
        title={pickerTarget === 'cover' ? 'Choisir l’image de couverture' : 'Choisir une image pour le bloc'}
      />

      {/* ─── Dialog Aperçu ─── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-editorial">Aperçu de l’article</DialogTitle>
            <DialogDescription>Rendu fidèle à l’affichage sur le site public.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[68vh] pr-4">
            {coverImage ? (
               
              <img src={coverImage} alt="" className="mb-4 aspect-video w-full rounded-lg object-cover" />
            ) : null}
            {coverCredit ? <p className="mb-3 text-xs text-muted-foreground">{coverCredit}</p> : null}
            <h1 className="font-editorial text-3xl font-bold leading-tight">{title || 'Titre de l’article'}</h1>
            {subtitle ? <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p> : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {readingTime} min de lecture · {tags.join(' · ')}
            </p>
            <Separator className="my-4" />
            <div className="article-body">
              {content.map((b, i) => <BlockPreview key={b.id} block={b} isFirst={i === 0 && b.type === 'paragraph'} />)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Versions ─── */}
      <Dialog open={versionsOpen} onOpenChange={setVersionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-editorial">Versions de l’article</DialogTitle>
            <DialogDescription>Chaque enregistrement crée un point de restauration.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-80 pr-2">
            {versions === null ? (
              <div className="space-y-2 py-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : versions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucune version enregistrée pour le moment.</p>
            ) : (
              <ul className="space-y-2 py-1">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{v.title || 'Sans titre'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(v.createdAt, true)} — par {v.savedBy || 'inconnu'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setRestoreVersionId(v.id)}>
                      <Undo2 className="h-3.5 w-3.5" /> Restaurer
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVersionsOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Traductions ─── */}
      <Dialog open={translationsOpen} onOpenChange={setTranslationsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-editorial">Traductions de l’article</DialogTitle>
            <DialogDescription>
              Générées automatiquement (DeepL) à la publication. Corrigez-les ici : une
              traduction corrigée n’est plus jamais écrasée par l’automatique.
            </DialogDescription>
          </DialogHeader>
          {translationsLoading ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <Tabs defaultValue="en">
                <TabsList className="w-full">
                  {TRANSLATE_LOCALES.map((l) => (
                    <TabsTrigger key={l.code} value={l.code} className="flex-1">
                      {l.label}
                      {translations[l.code] && !translations[l.code].auto ? ' ✎' : ''}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {TRANSLATE_LOCALES.map((l) => {
                  const entry = translations[l.code];
                  return (
                    <TabsContent key={l.code} value={l.code} className="space-y-3 pt-3">
                      {entry ? (
                        <p className="text-xs text-muted-foreground">
                          {entry.auto ? 'Traduction automatique' : 'Traduction corrigée manuellement'} · le titre, le sous-titre et le contenu sont traduits.
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Pas encore de traduction — publiez l’article ou cliquez sur « Re-traduire ».
                        </p>
                      )}
                      <Field label="Titre traduit">
                        <Input
                          value={entry?.title ?? ''}
                          onChange={(e) =>
                            setTranslations((prev) => ({
                              ...prev,
                              [l.code]: { auto: prev[l.code]?.auto ?? true, title: e.target.value, subtitle: prev[l.code]?.subtitle ?? '' },
                            }))
                          }
                          placeholder={title || 'Titre…'}
                          className="h-9"
                          aria-label={`Titre traduit (${l.label})`}
                        />
                      </Field>
                      <Field label="Sous-titre traduit">
                        <Textarea
                          value={entry?.subtitle ?? ''}
                          onChange={(e) =>
                            setTranslations((prev) => ({
                              ...prev,
                              [l.code]: { auto: prev[l.code]?.auto ?? true, title: prev[l.code]?.title ?? '', subtitle: e.target.value },
                            }))
                          }
                          placeholder={subtitle || 'Sous-titre…'}
                          className="min-h-16 text-sm"
                          aria-label={`Sous-titre traduit (${l.label})`}
                        />
                      </Field>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={translationSavingLocale === l.code || !entry}
                          onClick={() => saveTranslationLocale(l.code)}
                        >
                          {translationSavingLocale === l.code ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Enregistrer cette correction
                        </Button>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={retranslateAll} disabled={retranslating}>
                  {retranslating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Re-traduire (auto)
                </Button>
                <Button variant="outline" onClick={() => setTranslationsOpen(false)}>Fermer</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Confirmation restauration ─── */}
      <ConfirmDialog
        open={restoreVersionId !== null}
        onOpenChange={(o) => { if (!o) setRestoreVersionId(null); }}
        title="Restaurer cette version ?"
        description="Le contenu actuel sera remplacé par la version sélectionnée. Pensez à enregistrer après restauration."
        confirmLabel="Restaurer"
        destructive={false}
        loading={restoring}
        onConfirm={doRestore}
      />

      {saving || publishing ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…
        </div>
      ) : null}
    </div>
  );
}
