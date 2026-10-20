// ═══════════════════════════════════════════════════════════════
// CLOUDINARY — upload d'images de la médiathèque.
// Les fichiers sont transférés vers Cloudinary : RIEN n'est stocké
// sur le serveur (seules les métadonnées sont en base).
// Variables : CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY /
//             CLOUDINARY_API_SECRET
// ═══════════════════════════════════════════════════════════════
import { v2 as cloudinary } from 'cloudinary';

const FOLDER = 'reussite-magazine';

export function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

function configure() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export interface UploadResult {
  url: string;
  publicId: string;
  filename: string;
  bytes: number;
  format: string;
  resourceType: string;
}

/** Upload en buffer (formdata File) vers le dossier du magazine. */
export async function uploadImageBuffer(
  buffer: Buffer,
  filename: string,
): Promise<UploadResult> {
  const cloud = configure();
  const result = await new Promise<UploadResult>((resolve, reject) => {
    const stream = cloud.uploader.upload_stream(
      {
        folder: FOLDER,
        resource_type: 'image',
        // Nom de fichier lisible dans l'URL (le publicId reste unique).
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, uploaded) => {
        if (error || !uploaded) {
          reject(new Error(error?.message || 'Upload Cloudinary échoué'));
          return;
        }
        resolve({
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          filename,
          bytes: uploaded.bytes,
          format: uploaded.format,
          resourceType: uploaded.resource_type,
        });
      },
    );
    stream.end(buffer);
  });
  return result;
}

/** Supprime une image Cloudinary à partir de son publicId (silencieux). */
export async function destroyImage(publicId: string): Promise<boolean> {
  try {
    const cloud = configure();
    const res = await cloud.uploader.destroy(publicId);
    return res.result === 'ok';
  } catch {
    return false;
  }
}

export const CLOUDINARY_FOLDER = FOLDER;
