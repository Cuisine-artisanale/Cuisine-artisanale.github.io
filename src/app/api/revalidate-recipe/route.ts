import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { RECIPE_LISTS_TAG } from '@/lib/server/listings';
import { getFirebaseAdminAuth } from '@/lib/config/firebase-admin';
import { checkRateLimit } from '@/lib/server/rate-limit';

/** Slug ou id de recette : lettres, chiffres, tirets et underscores uniquement. */
const SEGMENT_REGEX = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * Invalide le cache de la fiche d'une recette (page /recettes/[slug], en cache 10 min),
 * après un like, un avis, une modification ou une suppression. Avec `lists`, invalide aussi
 * les listes de recettes (/recettes, pages régions) : après une publication ou une suppression.
 *
 * Requiert un ID token Firebase (header Authorization: Bearer <token>).
 * Corps : { slugs: string[], lists?: boolean } — le slug de la recette et/ou son id (les deux URL existent).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    return NextResponse.json({ success: false, error: 'Authentification requise' }, { status: 401 });
  }

  let uid: string;
  try {
    ({ uid } = await getFirebaseAdminAuth().verifyIdToken(idToken));
  } catch {
    return NextResponse.json({ success: false, error: 'Session invalide' }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({ action: 'revalidate-recipe', identifier: uid, limit: 120, windowSeconds: 3600 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: 'Trop de demandes' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  const body = await request.json().catch(() => ({}));
  const slugs: string[] = Array.isArray(body?.slugs)
    ? body.slugs.filter((s: unknown): s is string => typeof s === 'string' && SEGMENT_REGEX.test(s)).slice(0, 4)
    : [];

  if (slugs.length === 0) {
    return NextResponse.json({ success: false, error: 'Recette manquante' }, { status: 400 });
  }

  for (const slug of new Set(slugs)) {
    revalidatePath(`/recettes/${slug}`);
  }

  if (body?.lists === true) {
    revalidateTag(RECIPE_LISTS_TAG);
  }

  return NextResponse.json({ success: true });
}
