// ═══════════════════════════════════════════════════════════════
// POST /api/admin/upload — import d'une image vers Cloudinary.
// multipart/form-data : file (image), alt? , caption?, credit?, tags?
// Crée l'entrée Media (métadonnées) et renvoie l'URL Cloudinary.
// DELETE intégré géré par /api/admin/media/:id (voir route admin).
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logAudit, requireAuth } from '@/lib/server/auth';
import { handleRouteError, HttpError, jsonError, ok, serializeMedia } from '@/lib/server/utils';
import { cloudinaryConfigured, uploadImageBuffer, destroyImage } from '@/lib/server/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 15 * 1024 * 1024; // 15 Mo
const ALLOWED = /^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/i;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!cloudinaryConfigured()) {
      return jsonError(503, 'Cloudinary non configuré : renseignez CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET dans le fichier .env.');
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(400, 'Aucun fichier reçu (champ « file »).');
    if (!ALLOWED.test(file.type)) {
      throw new HttpError(400, `Type non supporté (${file.type || 'inconnu'}). Formats acceptés : PNG, JPEG, WebP, GIF, AVIF, SVG.`);
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(400, 'Fichier trop volumineux (15 Mo maximum).');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadImageBuffer(buffer, file.name);

    const media = await db.media.create({
      data: {
        url: uploaded.url,
        publicId: uploaded.publicId,
        filename: file.name || uploaded.filename,
        alt: String(form.get('alt') ?? ''),
        caption: String(form.get('caption') ?? ''),
        credit: String(form.get('credit') ?? ''),
        tags: String(form.get('tags') ?? ''),
        type: file.type === 'image/gif' ? 'image/gif' : 'image',
      },
    });
    logAudit(user.id, user.name, 'MEDIA_UPLOAD', `Image « ${media.filename} » importée vers Cloudinary (${uploaded.bytes} octets)`);

    return ok({ media: serializeMedia(media) });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** DELETE /api/admin/upload?publicId=… — suppression côté Cloudinary. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const publicId = req.nextUrl.searchParams.get('publicId');
    if (!publicId) throw new HttpError(400, 'Paramètre publicId manquant.');
    const destroyed = await destroyImage(publicId);
    logAudit(user.id, user.name, 'MEDIA_DESTROY', `Image Cloudinary « ${publicId} » ${destroyed ? 'supprimée' : 'introuvable'}`);
    return ok({ ok: destroyed });
  } catch (err) {
    return handleRouteError(err);
  }
}
