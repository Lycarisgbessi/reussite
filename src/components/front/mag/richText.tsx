// ═══════════════════════════════════════════════════════════════
// RICH TEXT INLINE — balisage léger type Markdown dans les blocs :
//   **gras**  *italique*  __souligné__  ==surligné==  ~~barré~~
//   [texte](https://…)
// Parsing sécurisé → React nodes (aucun HTML brut injecté).
// ═══════════════════════════════════════════════════════════════
import React from 'react';

// Ordre important : les marqueurs les plus longs d'abord.
const TOKEN_RE =
  /(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)|(__([^_]+)__)|(==([^=]+)==)|(~~([^~]+)~~)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+|#[^\s)]*)\))/g;

/** URL sûre pour un lien (http/https/hash uniquement). */
function safeHref(url: string): string {
  const trimmed = url.trim();
  if (/^(https?:\/\/|#)/i.test(trimmed)) return trimmed;
  return '#';
}

/** Convertit un texte balisé en React nodes. */
export function renderInline(text: string): React.ReactNode {
  if (!text) return null;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const [full, , bold, , italic, , underline, , highlight, , strike, , linkText, linkUrl] = m;
    if (bold) {
      nodes.push(<strong key={key++}>{bold}</strong>);
    } else if (italic) {
      nodes.push(<em key={key++}>{italic}</em>);
    } else if (underline) {
      nodes.push(<u key={key++}>{underline}</u>);
    } else if (highlight) {
      nodes.push(
        <mark key={key++} className="rounded-sm bg-primary/20 px-0.5 text-inherit">
          {highlight}
        </mark>,
      );
    } else if (strike) {
      nodes.push(<s key={key++} className="text-muted-foreground">{strike}</s>);
    } else if (linkText && linkUrl !== undefined) {
      const href = safeHref(linkUrl);
      nodes.push(
        <a
          key={key++}
          href={href}
          {...(href.startsWith('http')
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
          className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
        >
          {linkText}
        </a>,
      );
    }
    // full non décomposé (ne devrait pas arriver) : ajouté tel quel.
    else nodes.push(full);
    last = m.index + full.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ═══════════════════════════════════════════════════════════════
// ÉDITEUR — manipulation de la sélection d'un <textarea>
// ═══════════════════════════════════════════════════════════════

/**
 * Entoure la sélection courante du textarea par les marqueurs donnés.
 * Déclenche l'événement input pour que React prenne la modification
 * en compte (textarea contrôlé).
 */
type EditableElement = HTMLTextAreaElement | HTMLInputElement;

export function wrapSelection(
  textarea: EditableElement,
  before: string,
  after: string,
  placeholder = 'texte',
): void {
  const s = textarea.selectionStart ?? 0;
  const e = textarea.selectionEnd ?? 0;
  const { value } = textarea;
  const selected = value.slice(s, e) || placeholder;
  const already =
    value.slice(s - before.length, s) === before && value.slice(e, e + after.length) === after;
  let nextValue: string;
  let selStart: number;
  let selEnd: number;
  if (already) {
    // Toggle off : retire les marqueurs existants.
    nextValue = value.slice(0, s - before.length) + selected + value.slice(e + after.length);
    selStart = s - before.length;
    selEnd = selStart + selected.length;
  } else {
    nextValue = value.slice(0, s) + before + selected + after + value.slice(e);
    selStart = s + before.length;
    selEnd = selStart + selected.length;
  }
  const proto = textarea instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement : window.HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
  setter?.call(textarea, nextValue);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
  textarea.setSelectionRange(selStart as number, selEnd as number);
}

/** Convertit les lignes sélectionnées en éléments de liste (ou les retire). */
export function toggleListLines(
  textarea: EditableElement,
  prefix: string,
): void {
  const s = textarea.selectionStart ?? 0;
  const e = textarea.selectionEnd ?? 0;
  const { value } = textarea;
  const lineStart = value.lastIndexOf('\n', s - 1) + 1;
  let lineEnd = value.indexOf('\n', e);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const allHave = lines.every((l) => l.trimStart().startsWith(prefix));
  const nextLines = lines.map((l) => {
    if (allHave) return l.replace(prefix, '');
    const indent = l.match(/^\s*/)?.[0] ?? '';
    return indent + prefix + l.trimStart();
  });
  const nextBlock = nextLines.join('\n');
  const nextValue = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);
  const proto = textarea instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement : window.HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
  setter?.call(textarea, nextValue);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
  textarea.setSelectionRange(lineStart, lineStart + nextBlock.length);
}

/** Insère un lien sur la sélection via prompt (simple et fiable). */
export function insertLink(textarea: EditableElement): void {
  const s = textarea.selectionStart ?? 0;
  const e = textarea.selectionEnd ?? 0;
  const { value } = textarea;
  const selected = value.slice(s, e);
  const label = selected || (window.prompt('Texte du lien :', '') ?? '');
  if (!label) return;
  let url = window.prompt('URL du lien (https://… ou #/article/slug) :', 'https://');
  if (!url) return;
  if (!/^(https?:\/\/|#)/i.test(url)) url = `https://${url}`;
  const insertion = `[${label}](${url})`;
  const nextValue = value.slice(0, s) + insertion + value.slice(e);
  const proto = textarea instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement : window.HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set;
  setter?.call(textarea, nextValue);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.focus();
  textarea.setSelectionRange((s ?? 0) + insertion.length, (s ?? 0) + insertion.length);
}
