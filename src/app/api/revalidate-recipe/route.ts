import { NextRequest, NextResponse, after } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { RECIPE_LISTS_TAG } from '@/lib/server/listings';
import { getFirebaseAdminAuth, getFirebaseAdminDb } from '@/lib/config/firebase-admin';
import { getDepartementPath, getRegionByDepartement } from '@/constants/regions';
import { notifyIndexNow } from '@/lib/server/indexnow';
import { checkRateLimit } from '@/lib/server/rate-limit';

/** Slug ou id de recette : lettres, chiffres, tirets et underscores uniquement. */
const SEGMENT_REGEX = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * Invalide le cache de la fiche d'une recette (page /recettes/[slug], en cache 10 min),
 * après un like, un avis, une modification ou une suppression. Avec `lists`, invalide aussi
 * les listes de recettes (/recettes, pages régions) et le sitemap, et signale les pages concernées
 * aux moteurs via IndexNow : après une publication, une modification ou une suppression.
 *
 * Requiert un ID token Firebase (header Authorization: Bearer <token>).
 * Corps : { slugs: string[], lists?: boolean } — le slug de la recette et/ou son id (les deux URL existent).
 */
/**
 * Pages à faire réexplorer : la fiche, la liste des recettes, et les pages de sa région et de son
 * département. Recette supprimée : son ancienne adresse (les moteurs constatent alors la 404).
 */
async function pagesToReindex(slugs: string[]): Promise<string[]> {
  const paths = ['/recettes', ...slugs.map((slug) => `/recettes/${slug}`)];
  try {
    const db = getFirebaseAdminDb();
    const snapshots = await db.getAll(...slugs.map((slug) => db.collection('recipes').doc(slug)));
    const recipe = snapshots.find((snapshot) => snapshot.exists)?.data();
    if (recipe) {
      // Adresse publique de la fiche : le slug (l'adresse par id redirige vers lui)
      if (typeof recipe.url === 'string' && recipe.url) paths.splice(1, slugs.length, `/recettes/${recipe.url}`);
      const region = getRegionByDepartement(recipe.position);
      const departementPath = getDepartementPath(recipe.position);
      if (region) paths.push(`/regions/${region.slug}`);
      if (departementPath) paths.push(departementPath);
    }
  } catch (error) {
    console.error('Pages à signaler indisponibles :', error);
  }
  return paths;
}

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
    revalidatePath('/sitemap.xml');
    // Après la réponse : le signalement aux moteurs ne doit pas ralentir l'enregistrement
    after(async () => notifyIndexNow(await pagesToReindex(slugs)));
  }

  return NextResponse.json({ success: true });
}
