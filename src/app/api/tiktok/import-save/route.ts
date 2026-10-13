import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/config/firebase-admin';
import { recordImportUsage } from '@/lib/server/import-usage';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { TikTokImportError, saveTikTokDraft } from '@/lib/server/tiktok-import';

/**
 * Enregistre en modération ("recipesRequest") une recette importée de TikTok,
 * après relecture par l'utilisateur. La miniature est copiée dans le stockage du site.
 *
 * Requiert un ID token Firebase (header Authorization: Bearer <token>).
 * Corps : { draft: ImportDraft }
 */
export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 });
  }

  let uid: string;
  try {
    ({ uid } = await getFirebaseAdminAuth().verifyIdToken(token));
  } catch {
    return NextResponse.json({ success: false, error: 'Session invalide, veuillez vous reconnecter' }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({ action: 'tiktok-import-save', identifier: uid, limit: 30, windowSeconds: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: "Trop d'imports. Veuillez réessayer plus tard." },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  const body = await request.json().catch(() => ({}));

  try {
    const result = await saveTikTokDraft(uid, body?.draft);
    await recordImportUsage(uid, { imports: 1 });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof TikTokImportError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erreur enregistrement import TikTok :', error);
    return NextResponse.json({ success: false, error: "Erreur lors de l'enregistrement de la recette." }, { status: 500 });
  }
}
