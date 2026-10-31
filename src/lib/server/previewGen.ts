// ═══════════════════════════════════════════════════════════════
// PREVIEW GENERATOR — génère automatiquement les images HD des N
// premières pages d'un numéro depuis son PDF (Drive ou ailleurs) :
//   1. Téléchargement du PDF (Drive → lien direct)
//   2. Upload vers Cloudinary en ressource IMAGE (dossier previews)
//   3. Rasterisation à la demande par Cloudinary : pg_{n} → JPEG HD
//   4. Écriture des URLs dans MagazineIssue.previewImages
// Le flipbook public affiche alors les VRAIES pages, sans jamais
// exposer le PDF complet (aucune fuite réseau).
// ═══════════════════════════════════════════════════════════════
import { db } from '@/lib/db';
import { cloudinaryConfigured, CLOUDINARY_FOLDER } from './cloudinary';
import { fetchFileBytes } from './drive';

const PREVIEW_FOLDER = `${CLOUDINARY_FOLDER}/previews`;

/** URL Cloudinary de la page N du PDF uploadé (JPEG HD à la volée). */
export function pageUrl(publicId: string, page: number, width = 1200): string {
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/f_jpg,q_auto:good,w_${width},pg_${page}/${publicId}.jpg`;
}

export interface RegenResult {
  ok: boolean;
  pages: string[];
  publicId?: string;
  bytes?: number;
  error?: string;
}

/**
 * Régénère les pages d'aperçu d'un numéro depuis son PDF.
 * Retourne les URLs générées ; ne modifie pas previewPages.
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
  const { buffer, bytes } = await fetchFileBytes(issue.pdfUrl);

  // 2. Uploader en ressource IMAGE (Cloudinary rasterise les PDF
  //    dans ce mode ; resource_type « raw » ne le permet pas).
  const { v2: cloudinary } = await import('cloudinary');
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  const uploaded = await new Promise<{ secure_url: string; public_id: string; pages?: number }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: PREVIEW_FOLDER,
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (error, res) => (error || !res ? reject(new Error(error?.message || 'Upload Cloudinary échoué')) : resolve(res)),
      );
      stream.end(buffer);
    },
  );

  // 3. URLs des N premières pages (pg_1..N) — Cloudinary génère le
  //    JPEG à la demande ; le PDF complet n'est jamais servi public.
  const count = issue.previewPages;
  const pages = Array.from({ length: count }, (_, i) => pageUrl(uploaded.public_id, i + 1));

  // 4. Persister
  await db.magazineIssue.update({
    where: { id: issueId },
    data: { previewImages: JSON.stringify(pages) },
  });

  return { ok: true, pages, publicId: uploaded.public_id, bytes };
}
