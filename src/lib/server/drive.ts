// ═══════════════════════════════════════════════════════════════
// DRIVE — conversion d'un lien de partage en URL de téléchargement
// direct (mutualisé entre preview, download et génération d'aperçu).
// ═══════════════════════════════════════════════════════════════

/** Convertit un lien de partage Drive (ou autre) en URL de téléchargement direct. */
export function directFileUrl(url: string): string {
  try {
    // https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
    if (fileMatch) return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
    // https://drive.google.com/open?id=FILE_ID
    const openMatch = url.match(/drive\.google\.com\/open\?id=([^&#]+)/);
    if (openMatch) return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
    return url;
  } catch {
    return url;
  }
}

/** Récupère les octets d'un fichier (Drive → direct, redirections suivies). */
export async function fetchFileBytes(url: string): Promise<{ buffer: Buffer; bytes: number }> {
  const upstream = await fetch(directFileUrl(url), {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ReussiteMagazine/1.0)' },
  });
  if (!upstream.ok) {
    throw new Error(`Téléchargement impossible (HTTP ${upstream.status}) — vérifiez que le partage est public.`);
  }
  const buffer = Buffer.from(await upstream.arrayBuffer());
  // Page HTML = interstitiel Drive, pas un PDF
  const isHtml = buffer.length > 20
    && (buffer[0] === 0x3c /* '<' */ || buffer.subarray(0, 200).toString('utf8').includes('<!DOCTYPE'));
  if (isHtml) {
    throw new Error('Le fichier partagé renvoie une page HTML (confirmation Drive) — le partage doit être « Toute personne disposant du lien ». Les fichiers trop volumineux peuvent nécessiter un hébergement direct.');
  }
  return { buffer, bytes: buffer.length };
}
