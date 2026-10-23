// ═══════════════════════════════════════════════════════════════
// POST /api/admin/upload-pdf — import d'un numéro PDF vers
// Cloudinary (resource_type « raw », zéro stockage serveur).
// multipart/form-data : file (application/pdf)
// Renvoie { url } — à renseigner dans MagazineIssue.pdfUrl.
// ═══════════════════════════════════════════════════════════════
import type { NextRequest } from 'next/server';
import { logAudit, requireAuth } from '@/lib/server/auth';
import { handleRouteError, HttpError, jsonError, ok } from '@/lib/server/utils';
import { cloudinaryConfigured, uploadRawBuffer } from '@/lib/server/cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 50 * 1024 * 1024; // 50 Mo

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!cloudinaryConfigured()) {
      return jsonError(503, 'Cloudinary non configuré : renseignez CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET dans le fichier .env.');
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new HttpError(400, 'Aucun fichier reçu (champ « file »).');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new HttpError(400, 'Seuls les fichiers PDF sont acceptés.');
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(400, 'Fichier trop volumineux (50 Mo maximum).');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadRawBuffer(buffer, file.name || 'numero.pdf');
    logAudit(user.id, user.name, 'SHOP_PDF_UPLOAD', `PDF « ${uploaded.filename} » importé (${uploaded.bytes} octets)`);

    return ok({ url: uploaded.url, bytes: uploaded.bytes });
  } catch (err) {
    return handleRouteError(err);
  }
}
