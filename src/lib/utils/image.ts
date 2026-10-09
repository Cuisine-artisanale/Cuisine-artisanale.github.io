/**
 * Images que Next/Vercel peut optimiser (redimensionnement + WebP).
 * Doit correspondre à images.remotePatterns dans next.config.ts.
 * Les autres sources (ex. miniatures TikTok) restent affichées telles quelles.
 */
const OPTIMIZABLE_HOSTS = ['firebasestorage.googleapis.com'];

export function isOptimizableImage(src: string | undefined | null): boolean {
  if (!src) return false;
  try {
    const { protocol, hostname } = new URL(src);
    return protocol === 'https:' && OPTIMIZABLE_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Réduit une photo avant envoi vers Firebase Storage (côté navigateur) :
 * 1600 px max sur le plus grand côté, JPEG qualité 0.85.
 * Une photo de téléphone (3-8 Mo) passe généralement sous 400 Ko.
 * En cas d'échec (format non lisible, GIF animé…), le fichier d'origine est renvoyé.
 */
export async function compressImage(file: File, maxSize = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
