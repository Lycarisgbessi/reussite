// ═══════════════════════════════════════════════════════════════
// FLUENT CONTENT — éditeur de contenu EN UN SEUL BLOC.
// Sérialise les ContentBlock du magazine en texte fluide avec des
// marqueurs simples, et reconstruit les blocs à l'enregistrement.
// Le stockage (JSON de blocs) et le rendu public restent inchangés :
// seul le confort de rédaction change.
//
// Marqueurs (un seul endroit pour tout) :
//   ## Titre            → intertitre (h2)
//   ### Sous-titre      → sous-titre (h3)
//   > citation          → citation
//   > @ Auteur          → auteur de la citation précédente
//   - élément           → liste à puces
//   1. élément          → liste numérotée
//   ![alt|légende](url) → image (autant qu'on veut)
//   {{video}} URL_ou_ID → vidéo YouTube intégrée
//   !!! Titre :: Texte  → encadré (callout)
//   ---                 → séparateur
//   (texte libre)       → paragraphe
// Styles en ligne : **gras** *italique* __souligné__ ==surligné== ~~barré~~ [lien](url)
// ═══════════════════════════════════════════════════════════════
import type { ContentBlock } from '@/lib/types';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** ContentBlock[] → texte fluide de l'éditeur. */
export function blocksToFluent(blocks: ContentBlock[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    switch (b.type) {
      case 'heading':
        out.push(`${b.level === 2 ? '##' : '###'} ${b.text}`);
        break;
      case 'quote':
        out.push(`> ${b.text}`);
        if (b.author) out.push(`> @ ${b.author}`);
        break;
      case 'image': {
        const alt = [b.alt ?? '', b.caption ?? ''].filter(Boolean).join('|');
        out.push(`![${alt}](${b.url})`);
        break;
      }
      case 'video':
        out.push(`{{video}} ${b.youtubeId}${b.title ? ` | ${b.title}` : ''}`);
        break;
      case 'list': {
        const marker = b.ordered ? (n: number) => `${n}. ` : () => '- ';
        b.items.filter((x) => x.trim()).forEach((item, n) => out.push(marker(n + 1) + item));
        break;
      }
      case 'callout':
        out.push(`!!! ${b.title ?? ''} :: ${b.text}`);
        break;
      case 'divider':
        out.push('---');
        break;
      default:
        out.push(b.text || '');
    }
    i += 1;
  }
  return out.join('\n\n');
}

/** Extrait un ID YouTube d'une URL ou d'un ID brut. */
function ytId(raw: string): string {
  const v = raw.trim();
  const m = v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return (m ? m[1] : v).replace(/[^A-Za-z0-9_-]/g, '');
}

/** Texte fluide → ContentBlock[] (tolérant, jamais d'exception). */
export function fluentToBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  // Regrouper les lignes par « paragraphe logique » (séparées par lignes vides)
  const groups = text.replace(/\r\n/g, '\n').split(/\n{2,}/);

  for (const group of groups) {
    const lines = group.split('\n').map((l) => l.replace(/\s+$/, ''));
    // 1) Consecutive lists
    if (lines.every((l) => /^\s*[-•]\s+/.test(l)) && lines.length > 0) {
      blocks.push({ id: uid(), type: 'list', ordered: false, items: lines.map((l) => l.replace(/^\s*[-•]\s+/, '')) });
      continue;
    }
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
      blocks.push({ id: uid(), type: 'list', ordered: true, items: lines.map((l) => l.replace(/^\s*\d+[.)]\s+/, '')) });
      continue;
    }

    for (const line of lines) {
      const l = line.trim();
      if (!l) continue;

      if (l === '---' || l === '***' || l === '___') {
        blocks.push({ id: uid(), type: 'divider' });
        continue;
      }
      // Titres
      const h = l.match(/^(#{2,4})\s+(.*)$/);
      if (h) {
        blocks.push({ id: uid(), type: 'heading', level: h[1].length === 2 ? 2 : 3, text: h[2] });
        continue;
      }
      // Vidéo
      const v = l.match(/^\{\{video\}\}\s*(.+)$/i) || l.match(/^\[video\]\((.+)\)$/i);
      if (v) {
        const parts = v[1].split('|');
        blocks.push({ id: uid(), type: 'video', youtubeId: ytId(parts[0]), title: parts[1]?.trim() || undefined });
        continue;
      }
      // Image ![alt|caption](url)
      const img = l.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (img) {
        const [altPart, caption] = img[1].split('|');
        blocks.push({ id: uid(), type: 'image', url: img[2].trim(), alt: altPart?.trim() || undefined, caption: caption?.trim() || undefined });
        continue;
      }
      // Citation
      if (l.startsWith('> @ ')) {
        const lastQuote = [...blocks].reverse().find((b) => b.type === 'quote');
        if (lastQuote && lastQuote.type === 'quote') lastQuote.author = l.slice(4).trim();
        continue;
      }
      if (l.startsWith('>')) {
        blocks.push({ id: uid(), type: 'quote', text: l.replace(/^>\s?/, '') });
        continue;
      }
      // Encadré !!! Titre :: Texte
      const call = l.match(/^!!!\s*(.*?)\s*::\s*(.*)$/);
      if (call) {
        blocks.push({ id: uid(), type: 'callout', title: call[1] || undefined, text: call[2] });
        continue;
      }
      // Ligne seule dans un groupe multi-lignes non-liste → paragraphe par ligne
      blocks.push({ id: uid(), type: 'paragraph', text: l });
    }
  }

  if (blocks.length === 0) blocks.push({ id: uid(), type: 'paragraph', text: '' });
  return blocks;
}

/** Compte de mots approximatif du texte fluide. */
export function fluentWordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[a-zà-ÿ0-9]/i.test(w)).length;
}
