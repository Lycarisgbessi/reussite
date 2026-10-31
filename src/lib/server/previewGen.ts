// ═══════════════════════════════════════════════════════════════
// PREVIEW GENERATOR — génère automatiquement les images HD des N
// premières pages d'un numéro depuis son PDF (Drive ou ailleurs) :
//   1. Téléchargement du PDF (Drive → lien direct)
//   2. Rendu des N premières pages en Node (pdf.js + canvas natif)
//   3. Upload de chaque page vers Cloudinary (JPEG ~200-500 Ko)
//   4. Écriture des URLs dans MagazineIssue.previewImages
//   BONUS : la PAGE 1 devient automatiquement la couverture du
//   numéro (coverUrl) — alimente la carte boutique ET le carrousel
//   du header, sans aucun import manuel.
// Le flipbook public affiche alors les VRAIES pages ; le PDF complet
// n'est jamais exposé (aucune fuite réseau).
// ═══════════════════════════════════════════════════════════════
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { cloudinaryConfigured, uploadImageBuffer } from './cloudinary';
import { fetchFileBytes } from './drive';

export interface RegenResult {
  ok: boolean;
  pages: string[];
  coverUrl?: string;
  error?: string;
}

/** Rend la page en JPEG HD via pdf.js + canvas natif. */
async function renderPage(
  pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs'),
  doc: import('pdfjs-dist/types/src/display/api').PDFDocumentProxy,
  pageNumber: number,
  targetWidth: number,
): Promise<Buffer> {
  const { createCanvas } = await import('@napi-rs/canvas');
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = targetWidth / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  // Fond blanc (pages transparentes → JPEG propre)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({
    // @ts-expect-error compat contexte canvas natif vs DOM
    canvasContext: ctx,
    viewport,
  }).promise;
  page.cleanup();
  return canvas.toBuffer('image/jpeg', 85);
}

/**
 * Régénère les pages d'aperçu d'un numéro depuis son PDF.
 * Ne modifie pas previewPages ; échoue proprement avec un message clair.
 */
export async function regenerateIssuePreview(issueId: string): Promise<RegenResult> {
  const issue = await db.magazineIssue.findUnique({ where: { id: issueId } });
  if (!issue) return { ok: false, pages: [], error: 'Numéro introuvable.' };
  if (!issue.pdfUrl) return { ok: false, pages: [], error: 'Aucun PDF renseigné pour ce numéro.' };
  if (issue.previewPages <= 0) return { ok: false, pages: [], error: 'Le nombre de pages d’aperçu est à 0.' };
  if (!cloudinaryConfigured()) {
    return { ok: false, pages: [], error: 'Cloudinary non configuré (clés manquantes).' };
  }

  // 1. Télécharger le PDF
  const { buffer } = await fetchFileBytes(issue.pdfUrl);

  // 2. Ouvrir avec pdf.js (build Node « legacy »). En Node, pdf.js
  //    utilise un « fake worker » importé par chemin absolu au
  //    runtime : on pointe workerSrc vers les fichiers du package
  //    (inclus dans le bundle standalone via outputFileTracingIncludes).
  const path = await import('node:path');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.join(
    process.cwd(),
    'node_modules',
    'pdfjs-dist',
    'legacy',
    'build',
    'pdf.worker.mjs',
  );
  pdfjs.GlobalWorkerOptions.workerSrc = workerPath;
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  const count = Math.min(issue.previewPages, doc.numPages);
  if (count < 1) {
    await doc.destroy();
    return { ok: false, pages: [], error: 'PDF illisible (0 page).' };
  }

  // 3. Rendre et uploader chaque page
  const pages: string[] = [];
  try {
    for (let n = 1; n <= count; n++) {
      const jpeg = await renderPage(pdfjs, doc, n, 1200);
      const uploaded = await uploadImageBuffer(jpeg, `page-${n}.jpg`);
      pages.push(uploaded.url);
    }
  } finally {
    await doc.destroy();
  }

  // 4. Persister — la page 1 devient la couverture (sauf si la
  //    couverture existante a été verrouillée manuellement via
  //    l'attribut « coverLocked » du formulaire admin).
  const data: Prisma.MagazineIssueUpdateInput = { previewImages: JSON.stringify(pages) };
  let coverUrl: string | undefined;
  if (pages.length > 0 && !issue.coverLocked) {
    coverUrl = pages[0];
    data.coverUrl = coverUrl;
  }
  await db.magazineIssue.update({ where: { id: issueId }, data });

  return { ok: true, pages, coverUrl };
}
