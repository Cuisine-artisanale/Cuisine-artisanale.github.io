import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/config/firebase-admin';
import { recordImportUsage } from '@/lib/server/import-usage';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { recordTraffic } from '@/lib/server/traffic-stats';
import { isTrafficSource } from '@/lib/analytics/traffic';
import { TikTokImportError, analyzeTikTokVideo } from '@/lib/server/tiktok-import';

/**
 * Analyse une vidéo TikTok et renvoie un brouillon de recette à faire relire par l'utilisateur.
 * Rien n'est enregistré : l'enregistrement dans le carnet passe par /api/tiktok/import-save.
 *
 * Requiert un ID token Firebase (header Authorization: Bearer <token>).
 * Corps : { videoUrl: string, supplementalText?: string, source?: canal de première visite }
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

  // 20 analyses par heure et par utilisateur : chaque analyse appelle un service d'IA payant
  const rateLimit = await checkRateLimit({ action: 'tiktok-import-url', identifier: uid, limit: 20, windowSeconds: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: "Trop d'imports. Veuillez réessayer plus tard." },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  const body = await request.json().catch(() => ({}));
  const videoUrl = typeof body?.videoUrl === 'string' ? body.videoUrl : '';
  const supplementalText = typeof body?.supplementalText === 'string' ? body.supplementalText : '';

  try {
    const { aiError, ...draft } = await analyzeTikTokVideo(videoUrl, supplementalText);
    await Promise.all([
      recordImportUsage(uid, { analyses: 1 }),
      recordTraffic({ type: 'event', event: 'import_analyzed', source: isTrafficSource(body?.source) ? body.source : 'direct' }),
    ]);
    return NextResponse.json({
      success: true,
      draft,
      ...((process.env.NODE_ENV !== 'production' || process.env.AI_DEBUG === 'true') && { aiError }),
    });
  } catch (error) {
    if (error instanceof TikTokImportError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erreur analyse TikTok :', error);
    return NextResponse.json({ success: false, error: "Erreur lors de l'analyse de la vidéo TikTok." }, { status: 500 });
  }
}
